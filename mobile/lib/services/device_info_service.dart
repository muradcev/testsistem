import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'battery_optimization_service.dart';

/// Merkezi cihaz bilgisi ve izin yonetimi servisi
/// Tum cihaz bilgisi, izinler ve FCM token tek noktadan yonetilir
class DeviceInfoService {
  static DeviceInfoService? _instance;
  static DeviceInfoService get instance => _instance ??= DeviceInfoService._();

  DeviceInfoService._();

  // Native permission channel for Android READ_CALL_LOG
  static const _permissionChannel = MethodChannel('com.nakliyeo.permissions');

  ApiService? _apiService;
  String? _fcmToken;
  bool _isSending = false;
  Timer? _retryTimer;
  int _retryCount = 0;
  static const int _maxRetries = 3;

  // Cache
  String? _deviceBrand;
  String? _deviceModel;
  String? _deviceOS;
  String? _deviceOSVersion;
  String? _appVersion;
  int? _appBuildNumber;

  // Son gonderim zamani
  DateTime? _lastSentAt;
  static const Duration _minSendInterval = Duration(minutes: 5);

  /// ApiService'i ayarla
  void setApiService(ApiService apiService) {
    _apiService = apiService;
    debugPrint('[DeviceInfo] ApiService set');
  }

  /// FCM Token'i ayarla ve gonder
  Future<void> setFcmToken(String token) async {
    debugPrint('[DeviceInfo] FCM token received: ${token.substring(0, 20)}...');
    _fcmToken = token;

    // Token alindiktan sonra tum bilgileri gonder
    await sendAllInfo();
  }

  /// FCM Token'i getir
  String? get fcmToken => _fcmToken;

  /// Tum cihaz bilgisi + izinler + FCM token'i gonder
  Future<bool> sendAllInfo({bool force = false}) async {
    // Zaten gonderiliyorsa bekle
    if (_isSending) {
      debugPrint('[DeviceInfo] Already sending, skipping...');
      return false;
    }

    // Son gonderimden bu yana yeterli sure gecmediyse atlat (force degilse)
    if (!force && _lastSentAt != null) {
      final elapsed = DateTime.now().difference(_lastSentAt!);
      if (elapsed < _minSendInterval) {
        debugPrint('[DeviceInfo] Sent recently (${elapsed.inSeconds}s ago), skipping...');
        return true;
      }
    }

    if (_apiService == null) {
      debugPrint('[DeviceInfo] ERROR: ApiService not set');
      _scheduleRetry();
      return false;
    }

    _isSending = true;

    try {
      debugPrint('[DeviceInfo] ========== COLLECTING ALL INFO ==========');

      // 1. Paket bilgisi
      final packageInfo = await PackageInfo.fromPlatform();
      _appVersion = packageInfo.version;
      _appBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;

      // 2. Cihaz bilgisi
      await _collectDeviceInfo();

      // 3. Tum izinleri topla
      final permissions = await _collectAllPermissions();

      // 4. Pil optimizasyonu durumunu kontrol et
      final batteryOptDisabled = await BatteryOptimizationService.isIgnoringBatteryOptimizations();
      debugPrint('[DeviceInfo] Battery optimization disabled: $batteryOptDisabled');

      // 5. Veriyi hazirla
      final data = <String, dynamic>{
        'app_version': _appVersion,
        'app_build_number': _appBuildNumber,
        'device_model': '$_deviceBrand $_deviceModel',
        'device_os': _deviceOS,
        'device_os_version': _deviceOSVersion,
        'push_enabled': permissions['notification'] == 'granted',
        'location_permission': permissions['location'] ?? 'unknown',
        'background_location_enabled': permissions['location_always'] == 'granted',
        'contacts_permission': permissions['contacts'] ?? 'unknown',
        'phone_permission': permissions['phone'] ?? 'unknown',
        'call_log_permission': permissions['call_log'] ?? 'unknown', // Android 9+ için READ_CALL_LOG
        'notification_permission': permissions['notification'] ?? 'unknown',
        'battery_optimization_disabled': batteryOptDisabled,
      };

      // 6. FCM token varsa ekle
      if (_fcmToken != null && _fcmToken!.isNotEmpty) {
        data['fcm_token'] = _fcmToken;
        debugPrint('[DeviceInfo] FCM token included');
      } else {
        debugPrint('[DeviceInfo] WARNING: No FCM token available');
      }

      debugPrint('[DeviceInfo] Sending data: $data');

      // 7. Gonder
      final response = await _apiService!.sendDeviceInfo(data);

      if (response.statusCode == 200 || response.statusCode == 201) {
        _lastSentAt = DateTime.now();
        _retryCount = 0;
        _retryTimer?.cancel();
        debugPrint('[DeviceInfo] SUCCESS: All info sent');

        // Basarili gonderimi kaydet
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('last_device_info_sent', _lastSentAt!.toIso8601String());

        _isSending = false;
        return true;
      } else {
        debugPrint('[DeviceInfo] ERROR: Response ${response.statusCode}');
        _scheduleRetry();
        _isSending = false;
        return false;
      }
    } catch (e, stackTrace) {
      debugPrint('[DeviceInfo] ERROR: $e');
      debugPrint('[DeviceInfo] StackTrace: $stackTrace');
      _scheduleRetry();
      _isSending = false;
      return false;
    }
  }

  /// Cihaz bilgisini topla
  Future<void> _collectDeviceInfo() async {
    if (_deviceBrand != null) return; // Zaten toplanmis

    final deviceInfo = DeviceInfoPlugin();

    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      _deviceBrand = androidInfo.brand;
      _deviceModel = androidInfo.model;
      _deviceOS = 'android';
      _deviceOSVersion = androidInfo.version.release;
      debugPrint('[DeviceInfo] Android: $_deviceBrand $_deviceModel (Android $_deviceOSVersion)');
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      _deviceBrand = 'Apple';
      _deviceModel = iosInfo.model;
      _deviceOS = 'ios';
      _deviceOSVersion = iosInfo.systemVersion;
      debugPrint('[DeviceInfo] iOS: $_deviceBrand $_deviceModel (iOS $_deviceOSVersion)');
    }
  }

  /// Tum izinleri topla
  Future<Map<String, String>> _collectAllPermissions() async {
    final permissions = <String, String>{};

    // Location permission (Geolocator ile)
    try {
      final locationPerm = await Geolocator.checkPermission();
      switch (locationPerm) {
        case LocationPermission.always:
          permissions['location'] = 'always';
          permissions['location_always'] = 'granted';
          break;
        case LocationPermission.whileInUse:
          permissions['location'] = 'while_in_use';
          permissions['location_always'] = 'denied';
          break;
        case LocationPermission.denied:
          permissions['location'] = 'denied';
          permissions['location_always'] = 'denied';
          break;
        case LocationPermission.deniedForever:
          permissions['location'] = 'permanently_denied';
          permissions['location_always'] = 'permanently_denied';
          break;
        default:
          permissions['location'] = 'unknown';
          permissions['location_always'] = 'unknown';
      }
    } catch (e) {
      debugPrint('[DeviceInfo] Location permission check failed: $e');
      permissions['location'] = 'unknown';
    }

    // Contacts permission
    try {
      final contactsStatus = await Permission.contacts.status;
      permissions['contacts'] = _permissionToString(contactsStatus);
    } catch (e) {
      permissions['contacts'] = 'unknown';
    }

    // Phone permission (CALL_PHONE)
    try {
      final phoneStatus = await Permission.phone.status;
      permissions['phone'] = _permissionToString(phoneStatus);
    } catch (e) {
      permissions['phone'] = 'unknown';
    }

    // Call log permission (Android 9+ için READ_CALL_LOG - CALL_PHONE'dan ayrı izin)
    try {
      if (Platform.isAndroid) {
        final callLogGranted = await _checkCallLogPermission();
        permissions['call_log'] = callLogGranted ? 'granted' : 'denied';
        debugPrint('[DeviceInfo] READ_CALL_LOG permission: ${permissions['call_log']}');
      } else {
        // iOS'ta call log erişimi yok, phone izni yeterli
        permissions['call_log'] = permissions['phone'] ?? 'unknown';
      }
    } catch (e) {
      debugPrint('[DeviceInfo] Call log permission check failed: $e');
      permissions['call_log'] = 'unknown';
    }

    // Notification permission
    try {
      final notificationStatus = await Permission.notification.status;
      permissions['notification'] = _permissionToString(notificationStatus);
    } catch (e) {
      permissions['notification'] = 'unknown';
    }

    debugPrint('[DeviceInfo] Permissions: $permissions');
    return permissions;
  }

  /// Android için READ_CALL_LOG iznini native olarak kontrol et
  Future<bool> _checkCallLogPermission() async {
    if (!Platform.isAndroid) return true;
    try {
      final bool result = await _permissionChannel.invokeMethod('checkCallLogPermission');
      return result;
    } on PlatformException catch (e) {
      debugPrint('[DeviceInfo] Failed to check call log permission: $e');
      return false;
    }
  }

  String _permissionToString(PermissionStatus status) {
    switch (status) {
      case PermissionStatus.granted:
        return 'granted';
      case PermissionStatus.denied:
        return 'denied';
      case PermissionStatus.permanentlyDenied:
        return 'permanently_denied';
      case PermissionStatus.restricted:
        return 'restricted';
      case PermissionStatus.limited:
        return 'limited';
      case PermissionStatus.provisional:
        return 'provisional';
    }
  }

  /// Izinler degistiginde yeniden gonder
  Future<void> onPermissionsChanged() async {
    debugPrint('[DeviceInfo] Permissions changed, refreshing...');
    await sendAllInfo(force: true);
  }

  /// Uygulama on plana geldiginde kontrol et
  Future<void> onAppResumed() async {
    debugPrint('[DeviceInfo] App resumed, checking if refresh needed...');
    await sendAllInfo(); // force=false, interval kontrolu yapilacak
  }

  /// Retry mekanizmasi
  void _scheduleRetry() {
    if (_retryCount >= _maxRetries) {
      debugPrint('[DeviceInfo] Max retries reached, giving up');
      return;
    }

    _retryCount++;
    final delay = Duration(seconds: 30 * _retryCount); // 30s, 60s, 90s
    debugPrint('[DeviceInfo] Scheduling retry #$_retryCount in ${delay.inSeconds}s');

    _retryTimer?.cancel();
    _retryTimer = Timer(delay, () {
      sendAllInfo(force: true);
    });
  }

  /// Servisi temizle
  void dispose() {
    _retryTimer?.cancel();
  }

  /// Debug bilgisi
  Map<String, dynamic> getDebugInfo() {
    return {
      'fcm_token': _fcmToken != null ? '${_fcmToken!.substring(0, 20)}...' : null,
      'device': '$_deviceBrand $_deviceModel',
      'os': '$_deviceOS $_deviceOSVersion',
      'app_version': '$_appVersion+$_appBuildNumber',
      'last_sent': _lastSentAt?.toIso8601String(),
      'retry_count': _retryCount,
    };
  }
}
