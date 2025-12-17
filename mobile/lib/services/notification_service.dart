import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'api_service.dart';
import 'device_info_service.dart';
import 'hybrid_location_service.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message received: ${message.messageId}');

  // Handle location request in background - Admin "Konum İste" dediğinde
  if (message.data['type'] == 'location_request') {
    debugPrint('[FCM] Admin location request received in background');
    await HybridLocationService.sendImmediateLocation(trigger: 'admin_request_background');
  }
}

class NotificationService {
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  FirebaseMessaging? _firebaseMessaging;
  String? _fcmToken;
  String? _fcmError;
  ApiService? _apiService;
  DeviceInfoService? _deviceInfoService;

  String? get fcmToken => _fcmToken;
  String? get fcmError => _fcmError;

  void setApiService(ApiService apiService) {
    _apiService = apiService;
  }

  /// DeviceInfoService'i ayarla - FCM token bu servis uzerinden gonderilecek
  void setDeviceInfoService(DeviceInfoService deviceInfoService) {
    _deviceInfoService = deviceInfoService;
    debugPrint('[FCM] DeviceInfoService set');
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
      debugPrint('[FCM] Getting FCM token from Firebase...');
      try {
        _fcmToken = await _firebaseMessaging?.getToken();
        debugPrint('[FCM] FCM Token received: ${_fcmToken != null ? _fcmToken!.substring(0, 30) + "..." : "NULL"}');
      } catch (tokenError) {
        _fcmError = 'Token alma hatası: $tokenError';
        debugPrint('[FCM] ERROR getting token: $tokenError');
      }

      // Send token to server immediately after getting it
      if (_fcmToken != null) {
        debugPrint('[FCM] Attempting to send token to server...');
        await _sendFcmTokenToServer(_fcmToken!);
      } else {
        if (_fcmError == null) {
          _fcmError = 'FCM token alınamadı (null döndü)';
        }
        debugPrint('[FCM] WARNING: Could not get FCM token from Firebase');
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

      // Check if app was opened from a notification (terminated state)
      final initialMessage = await _firebaseMessaging?.getInitialMessage();
      if (initialMessage != null) {
        debugPrint('[FCM] App opened from terminated state via notification');
        debugPrint('[FCM] Initial message data: ${initialMessage.data}');
        // Store as pending - will be processed when navigation callback is set
        _pendingNavigationMessage = initialMessage;
      }

    } catch (e, stackTrace) {
      _fcmError = 'Firebase init error: $e';
      debugPrint('[FCM] ERROR: Firebase Messaging initialization failed: $e');
      debugPrint('[FCM] Stack trace: $stackTrace');
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    debugPrint('Foreground message received: ${message.data}');

    final notification = message.notification;
    final type = message.data['type'];

    // Handle different notification types
    if (type == 'question') {
      // Soru bildirimi - özel kanal ve payload formatı
      final questionId = message.data['question_id'] ?? '';
      await showQuestionNotification(questionId, notification?.body ?? 'Yeni bir soru var');
    } else if (type == 'location_request') {
      // Konum isteği - sessiz, bildirim gösterme
      debugPrint('[FCM] Admin location request received in foreground');
      await HybridLocationService.sendImmediateLocation(trigger: 'admin_request_foreground');
    } else if (notification != null) {
      // Diğer bildirimler
      await showNotification(
        id: message.hashCode,
        title: notification.title ?? 'Nakliyeo',
        body: notification.body ?? '',
        payload: type ?? '',
      );
    }
  }

  // Navigation callback
  Function(String route)? onNavigate;
  RemoteMessage? _pendingNavigationMessage;
  String? _pendingRoute;

  /// Pending route'u al - uygulama başlarken kontrol edilir
  String? get pendingRoute => _pendingRoute;

  /// Pending route'u temizle
  void clearPendingRoute() {
    _pendingRoute = null;
  }

  void setNavigationCallback(Function(String route) callback) {
    onNavigate = callback;
    // If there's a pending message, process it immediately and set pending route
    if (_pendingNavigationMessage != null) {
      debugPrint('[FCM] Pending notification found, setting pending route');
      final message = _pendingNavigationMessage!;
      _pendingNavigationMessage = null;
      _pendingRoute = _getRouteForMessage(message);
      debugPrint('[FCM] Pending route set to: $_pendingRoute');
    }
  }

  /// Message'dan route belirle
  String _getRouteForMessage(RemoteMessage message) {
    final type = message.data['type'];
    if (type == 'question') {
      return '/questions';
    } else if (type == 'survey') {
      final surveyId = message.data['survey_id'];
      if (surveyId != null) {
        return '/survey/$surveyId';
      }
    }
    return '/home';
  }

  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('[FCM] Notification tapped: ${message.data}');
    final type = message.data['type'];

    // If navigation callback is not set yet, store the message for later
    if (onNavigate == null) {
      debugPrint('[FCM] Navigation callback not set, storing message for later');
      _pendingNavigationMessage = message;
      return;
    }

    try {
      if (type == 'question') {
        debugPrint('[FCM] Navigating to /questions');
        onNavigate?.call('/questions');
      } else if (type == 'survey') {
        final surveyId = message.data['survey_id'];
        if (surveyId != null) {
          debugPrint('[FCM] Navigating to /survey/$surveyId');
          onNavigate?.call('/survey/$surveyId');
        } else {
          debugPrint('[FCM] Survey ID missing, navigating to home');
          onNavigate?.call('/');
        }
      } else {
        // Unknown type or no type - just open the app (home screen)
        debugPrint('[FCM] Unknown notification type: $type, navigating to home');
        onNavigate?.call('/');
      }
    } catch (e) {
      debugPrint('[FCM] Navigation error: $e');
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
    debugPrint('[Notification] Processing payload: $payload');

    if (payload.startsWith('question:') || payload == 'question') {
      debugPrint('[Notification] Navigating to /questions');
      onNavigate?.call('/questions');
    } else if (payload.startsWith('survey:')) {
      final surveyId = payload.replaceFirst('survey:', '');
      debugPrint('[Notification] Navigating to /survey/$surveyId');
      onNavigate?.call('/survey/$surveyId');
    } else if (payload == 'survey') {
      debugPrint('[Notification] Navigating to /home (survey without id)');
      onNavigate?.call('/');
    } else {
      debugPrint('[Notification] Unknown payload, navigating to /home');
      onNavigate?.call('/');
    }
  }

  Future<void> sendFcmTokenToServer() async {
    debugPrint('[FCM] sendFcmTokenToServer called, token: ${_fcmToken != null ? "EXISTS" : "NULL"}');

    // Token yoksa Firebase'den tekrar almayı dene
    if (_fcmToken == null) {
      debugPrint('[FCM] Token is null, trying to get from Firebase again...');
      try {
        _fcmToken = await _firebaseMessaging?.getToken();
        if (_fcmToken != null) {
          debugPrint('[FCM] Got token on retry: ${_fcmToken!.substring(0, 30)}...');
        }
      } catch (e) {
        debugPrint('[FCM] Failed to get token on retry: $e');
      }
    }

    if (_fcmToken != null) {
      await _sendFcmTokenToServer(_fcmToken!);
    } else {
      _fcmError = 'FCM token alınamadı';
      debugPrint('[FCM] WARNING: FCM token is still null after retry');
    }
  }

  Future<void> _sendFcmTokenToServer(String token) async {
    debugPrint('[FCM] _sendFcmTokenToServer called with token: ${token.substring(0, 20)}...');
    bool success = false;

    // 1. Oncelikle DeviceInfoService uzerinden gonder (tum bilgilerle birlikte)
    if (_deviceInfoService != null) {
      try {
        debugPrint('[FCM] Sending via DeviceInfoService (with all device info)...');
        await _deviceInfoService!.setFcmToken(token);
        success = true;
        _fcmError = null;
        debugPrint('[FCM] SUCCESS via DeviceInfoService');
      } catch (e) {
        debugPrint('[FCM] DeviceInfoService failed: $e, trying direct API...');
      }
    }

    // 2. Fallback: Direkt API ile gonder (DeviceInfoService basarisiz olduysa)
    if (!success && _apiService != null) {
      try {
        debugPrint('[FCM] Fallback: Calling API to update FCM token directly...');
        final response = await _apiService!.updateFcmToken(token);
        if (response.statusCode == 200) {
          success = true;
          _fcmError = null;
          debugPrint('[FCM] SUCCESS: FCM token sent via direct API. Response: ${response.statusCode}');
        } else {
          _fcmError = 'API hatası: ${response.statusCode}';
          debugPrint('[FCM] API returned non-200: ${response.statusCode}');
        }
      } catch (e) {
        _fcmError = 'Token gönderme hatası: $e';
        debugPrint('[FCM] ERROR: Failed to send FCM token via direct API: $e');
      }
    }

    if (!success && _apiService == null && _deviceInfoService == null) {
      _fcmError = 'ApiService ve DeviceInfoService bulunamadı';
      debugPrint('[FCM] ERROR: Neither DeviceInfoService nor ApiService set');
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
