import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'api_service.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message received: ${message.messageId}');
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
        _handleNotificationTap(initialMessage);
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
  }

  // Navigation callback
  Function(String route)? onNavigate;

  void setNavigationCallback(Function(String route) callback) {
    onNavigate = callback;
  }

  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('Notification tapped: ${message.data}');
    final type = message.data['type'];

    if (type == 'question') {
      onNavigate?.call('/questions');
    } else if (type == 'survey') {
      final surveyId = message.data['survey_id'];
      if (surveyId != null) {
        onNavigate?.call('/survey/$surveyId');
      }
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      debugPrint('Local notification tapped: $payload');

      if (payload.startsWith('question:')) {
        onNavigate?.call('/questions');
      } else if (payload.startsWith('survey:')) {
        final surveyId = payload.replaceFirst('survey:', '');
        onNavigate?.call('/survey/$surveyId');
      }
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
