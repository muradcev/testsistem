import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'api_service.dart';
import '../config/constants.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message received: ${message.messageId}');

  // Handle location request in background
  if (message.data['type'] == 'location_request') {
    debugPrint('Location request received in background');
    await _handleLocationRequestBackground(message.data['request_id'] ?? '');
  }
}

// Handle location request in background
Future<void> _handleLocationRequestBackground(String requestId) async {
  try {
    // Check permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      debugPrint('Location permission denied');
      return;
    }

    // Get current position
    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    debugPrint('Background location: ${position.latitude}, ${position.longitude}');

    // Send to server using direct HTTP call (background handler can't use ApiService)
    await _sendLocationToServer(position);
  } catch (e) {
    debugPrint('Background location request failed: $e');
  }
}

// Send location to server (for background use)
Future<void> _sendLocationToServer(Position position) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(StorageKeys.accessToken);

    if (token == null || token.isEmpty) {
      debugPrint('No auth token available for background location send');
      return;
    }

    final locationData = {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'speed': position.speed,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'heading': position.heading,
      'is_moving': position.speed > 1,
      'activity_type': position.speed > 5 ? 'driving' : 'still',
      'recorded_at': DateTime.now().toIso8601String(),
    };

    final response = await http.post(
      Uri.parse('${ApiConstants.baseUrl}${ApiConstants.location}'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(locationData),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      debugPrint('Background location sent successfully');
    } else {
      debugPrint('Background location send failed: ${response.statusCode}');
    }
  } catch (e) {
    debugPrint('Background location send error: $e');
  }
}

class NotificationService {
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  FirebaseMessaging? _firebaseMessaging;
  String? _fcmToken;
  ApiService? _apiService;

  String? get fcmToken => _fcmToken;

  void setApiService(ApiService apiService) {
    _apiService = apiService;
  }

  Future<void> initialize() async {
    // Initialize local notifications
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Create notification channels for Android
    if (Platform.isAndroid) {
      await _createNotificationChannels();
    }

    // Initialize Firebase Messaging
    await _initializeFirebaseMessaging();
  }

  Future<void> _createNotificationChannels() async {
    final androidPlugin = _notifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

    if (androidPlugin == null) return;

    // Background location channel
    const locationChannel = AndroidNotificationChannel(
      'nakliyeo_location',
      'Konum Takibi',
      description: 'Arka planda konum takibi için bildirim kanalı',
      importance: Importance.low,
      playSound: false,
      enableVibration: false,
      showBadge: false,
    );
    await androidPlugin.createNotificationChannel(locationChannel);

    // General notifications channel
    const generalChannel = AndroidNotificationChannel(
      'nakliyeo_channel',
      'Nakliyeo Bildirimleri',
      description: 'Nakliyeo uygulama bildirimleri',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );
    await androidPlugin.createNotificationChannel(generalChannel);

    // Questions channel
    const questionsChannel = AndroidNotificationChannel(
      'nakliyeo_questions',
      'Sorular',
      description: 'Yeni soru bildirimleri',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );
    await androidPlugin.createNotificationChannel(questionsChannel);
  }

  Future<void> _initializeFirebaseMessaging() async {
    try {
      // Firebase should already be initialized in main.dart
      _firebaseMessaging = FirebaseMessaging.instance;

      // Request permission for iOS
      await _firebaseMessaging?.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      // Set background message handler
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Get FCM token
      _fcmToken = await _firebaseMessaging?.getToken();
      debugPrint('FCM Token: $_fcmToken');

      // Send token to server immediately after getting it
      if (_fcmToken != null) {
        await _sendFcmTokenToServer(_fcmToken!);
      }

      // Listen for token refresh
      _firebaseMessaging?.onTokenRefresh.listen((newToken) {
        _fcmToken = newToken;
        debugPrint('FCM Token refreshed: $newToken');
        _sendFcmTokenToServer(newToken);
      });

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Handle notification tap when app is in background
      FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

      // Check if app was opened from a notification
      final initialMessage = await _firebaseMessaging?.getInitialMessage();
      if (initialMessage != null) {
        // Delay to ensure navigation callback is set
        Future.delayed(const Duration(milliseconds: 1500), () {
          _handleNotificationTap(initialMessage);
        });
      }

    } catch (e) {
      debugPrint('Firebase Messaging initialization failed: $e');
      // Firebase may not be configured yet - this is OK during development
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    debugPrint('Foreground message received: ${message.data}');

    final notification = message.notification;
    if (notification != null) {
      // Show local notification
      await showNotification(
        id: message.hashCode,
        title: notification.title ?? 'Nakliyeo',
        body: notification.body ?? '',
        payload: message.data['type'] ?? '',
      );
    }

    // Handle question notification
    if (message.data['type'] == 'question') {
      final questionId = message.data['question_id'];
      await showQuestionNotification(questionId, notification?.body ?? 'Yeni bir soru var');
    }

    // Handle location request (silent - no notification shown)
    if (message.data['type'] == 'location_request') {
      debugPrint('Location request received in foreground');
      await _handleLocationRequest(message.data['request_id'] ?? '');
    }
  }

  // Handle location request - get current location and send to server
  Future<void> _handleLocationRequest(String requestId) async {
    try {
      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        debugPrint('Location permission denied for location request');
        return;
      }

      // Get current position with high accuracy
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      debugPrint('Location request - Got position: ${position.latitude}, ${position.longitude}');

      // Send to server
      if (_apiService != null) {
        await _apiService!.sendLocation({
          'latitude': position.latitude,
          'longitude': position.longitude,
          'speed': position.speed,
          'accuracy': position.accuracy,
          'altitude': position.altitude,
          'heading': position.heading,
          'is_moving': position.speed > 1,
          'activity_type': position.speed > 5 ? 'driving' : 'still',
          'recorded_at': DateTime.now().toIso8601String(),
        });
        debugPrint('Location request - Sent to server successfully');
      } else {
        debugPrint('Location request - ApiService not available');
      }
    } catch (e) {
      debugPrint('Location request failed: $e');
    }
  }

  // Navigation callback
  Function(String route)? onNavigate;
  RemoteMessage? _pendingNavigationMessage;

  void setNavigationCallback(Function(String route) callback) {
    onNavigate = callback;
    // If there's a pending message, handle it now
    if (_pendingNavigationMessage != null) {
      debugPrint('Processing pending notification message');
      _handleNotificationTap(_pendingNavigationMessage!);
      _pendingNavigationMessage = null;
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('Notification tapped: ${message.data}');
    final type = message.data['type'];

    // If navigation callback is not set yet, store the message for later
    if (onNavigate == null) {
      debugPrint('Navigation callback not set, storing message for later');
      _pendingNavigationMessage = message;
      return;
    }

    if (type == 'question') {
      debugPrint('Navigating to /questions');
      onNavigate?.call('/questions');
    } else if (type == 'survey') {
      final surveyId = message.data['survey_id'];
      if (surveyId != null) {
        debugPrint('Navigating to /survey/$surveyId');
        onNavigate?.call('/survey/$surveyId');
      }
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      debugPrint('Local notification tapped: $payload');

      // If navigation callback is not set yet, wait and retry
      if (onNavigate == null) {
        debugPrint('Navigation callback not set, waiting...');
        Future.delayed(const Duration(milliseconds: 1000), () {
          _processLocalNotificationPayload(payload);
        });
        return;
      }

      _processLocalNotificationPayload(payload);
    }
  }

  void _processLocalNotificationPayload(String payload) {
    if (payload.startsWith('question:')) {
      debugPrint('Navigating to /questions from local notification');
      onNavigate?.call('/questions');
    } else if (payload.startsWith('survey:')) {
      final surveyId = payload.replaceFirst('survey:', '');
      debugPrint('Navigating to /survey/$surveyId from local notification');
      onNavigate?.call('/survey/$surveyId');
    }
  }

  Future<void> sendFcmTokenToServer() async {
    if (_fcmToken != null) {
      await _sendFcmTokenToServer(_fcmToken!);
    }
  }

  Future<void> _sendFcmTokenToServer(String token) async {
    if (_apiService == null) {
      debugPrint('ApiService not set, cannot send FCM token');
      return;
    }

    try {
      await _apiService!.updateFcmToken(token);
      debugPrint('FCM token sent to server');
    } catch (e) {
      debugPrint('Failed to send FCM token: $e');
    }
  }

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'nakliyeo_channel',
      'Nakliyeo Bildirimleri',
      channelDescription: 'Nakliyeo uygulama bildirimleri',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(id, title, body, details, payload: payload);
  }

  Future<void> showQuestionNotification(String questionId, String questionText) async {
    const androidDetails = AndroidNotificationDetails(
      'nakliyeo_questions',
      'Sorular',
      channelDescription: 'Yeni soru bildirimleri',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      questionId.hashCode,
      'Yeni Soru',
      questionText,
      details,
      payload: 'question:$questionId',
    );
  }

  Future<void> showSurveyNotification(String surveyId, String title) async {
    await showNotification(
      id: surveyId.hashCode,
      title: 'Yeni Anket',
      body: title,
      payload: 'survey:$surveyId',
    );
  }
}
