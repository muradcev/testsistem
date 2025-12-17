import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'package:dio/dio.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:call_log/call_log.dart' as call_log_pkg;
import 'package:permission_handler/permission_handler.dart';
import 'dart:ui';

import '../config/constants.dart';

// Sabitler
const String _workManagerTaskName = 'nakliyeo_location_check';
const String _workManagerTaskTag = 'location';
const double _speedThresholdKmh = 30.0; // 30 km/s üzeri = Foreground mod (bildirim göster)
const double _speedStopThresholdKmh = 25.0; // 25 km/s altı = WorkManager moduna dön (bildirim gizle)
const int _workManagerIntervalMinutes = 15; // WorkManager aralığı (hareketsiz)
const int _foregroundIntervalSeconds = 30; // 30 saniye = Foreground mod aralığı (hızlı sürüş)
const int _slowSpeedCheckCount = 2; // 2 x 30sn = 1 dakika düşük hız = WorkManager'a dön

/// Hibrit Konum Servisi
/// - Hız < 30 km/s: WorkManager modu (15 dk'da bir, bildirim yok)
/// - Hız >= 30 km/s: Foreground modu (30 sn'de bir, bildirim var)
/// - Hız 25-30 arası: Histerezis bölgesi (ani mod değişimi engellenir)
class HybridLocationService {
  static bool _isInitialized = false;
  static bool _isForegroundMode = false;

  /// Servisi başlat
  static Future<void> initialize() async {
    if (_isInitialized) return;

    debugPrint('[HybridLocation] Initializing...');

    // WorkManager'ı başlat
    await Workmanager().initialize(
      workManagerCallbackDispatcher,
      isInDebugMode: false,
    );

    // Foreground Service'i yapılandır (ama başlatma)
    await _configureForegroundService();

    // Önceki oturumdan kalmış olabilecek foreground servisi temizle
    final service = FlutterBackgroundService();
    final isRunning = await service.isRunning();
    if (isRunning) {
      debugPrint('[HybridLocation] Found running service from previous session, stopping...');
      service.invoke('stop');
      await Future.delayed(const Duration(milliseconds: 500));
    }

    // Flag'i de temizle
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('should_start_foreground', false);

    _isInitialized = true;
    _isForegroundMode = false;
    debugPrint('[HybridLocation] Initialized');
  }

  /// WorkManager modunu başlat (varsayılan mod)
  static Future<void> startWorkManagerMode() async {
    debugPrint('[HybridLocation] Starting WorkManager mode...');

    // Önce foreground service'i durdur (eğer çalışıyorsa)
    await stopForegroundMode();

    // WorkManager periyodik görevini kaydet
    await Workmanager().registerPeriodicTask(
      _workManagerTaskName,
      _workManagerTaskName,
      frequency: const Duration(minutes: _workManagerIntervalMinutes),
      tag: _workManagerTaskTag,
      constraints: Constraints(
        networkType: NetworkType.not_required,
        requiresBatteryNotLow: false,
        requiresCharging: false,
        requiresDeviceIdle: false,
        requiresStorageNotLow: false,
      ),
      existingWorkPolicy: ExistingWorkPolicy.replace,
    );

    _isForegroundMode = false;
    debugPrint('[HybridLocation] WorkManager mode started (every $_workManagerIntervalMinutes min)');
  }

  /// Foreground modunu başlat (hızlı sürüş için)
  static Future<void> startForegroundMode() async {
    if (_isForegroundMode) {
      debugPrint('[HybridLocation] Already in foreground mode');
      return;
    }

    debugPrint('[HybridLocation] Starting Foreground mode...');

    final service = FlutterBackgroundService();
    var isRunning = await service.isRunning();
    if (!isRunning) {
      await service.startService();
    }

    _isForegroundMode = true;
    debugPrint('[HybridLocation] Foreground mode started');
  }

  /// Foreground modunu durdur
  static Future<void> stopForegroundMode() async {
    debugPrint('[HybridLocation] Stopping Foreground mode...');

    final service = FlutterBackgroundService();
    var isRunning = await service.isRunning();

    // Servis çalışıyorsa durdur (flag'e bakmadan)
    if (isRunning) {
      debugPrint('[HybridLocation] Service is running, stopping...');
      service.invoke('stop');

      // Servisin durmasını bekle
      await Future.delayed(const Duration(milliseconds: 500));

      // Tekrar kontrol et
      isRunning = await service.isRunning();
      if (isRunning) {
        debugPrint('[HybridLocation] Service still running, trying stopSelf...');
        service.invoke('stopSelf');
      }
    }

    _isForegroundMode = false;

    // Flag'i de temizle
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('should_start_foreground', false);

    debugPrint('[HybridLocation] Foreground mode stopped');
  }

  /// Tüm servisleri durdur
  static Future<void> stopAll() async {
    debugPrint('[HybridLocation] Stopping all services...');

    await stopForegroundMode();
    await Workmanager().cancelByTag(_workManagerTaskTag);

    debugPrint('[HybridLocation] All services stopped');
  }

  /// Mevcut modu kontrol et
  static bool get isForegroundMode => _isForegroundMode;

  /// Foreground Service yapılandırması
  static Future<void> _configureForegroundService() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onForegroundStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'nakliyeo_location',
        initialNotificationTitle: 'Nakliyeo',
        initialNotificationContent: 'Seyahat kaydediliyor',
        foregroundServiceNotificationId: 888,
        foregroundServiceTypes: [AndroidForegroundType.location],
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: _onForegroundStart,
        onBackground: _onIosBackground,
      ),
    );
  }
}

/// WorkManager callback - her 15 dakikada çalışır
@pragma('vm:entry-point')
void workManagerCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    debugPrint('[WorkManager] Task executed: $task');

    try {
      // Konum izni kontrolü
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        debugPrint('[WorkManager] Location permission denied');
        return true;
      }

      // Konum servisi kontrolü
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('[WorkManager] Location service disabled');
        return true;
      }

      // Mevcut konumu al
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // Hızı km/s'e çevir (m/s -> km/h)
      double speedKmh = position.speed * 3.6;
      debugPrint('[WorkManager] Current speed: ${speedKmh.toStringAsFixed(1)} km/h, accuracy: ${position.accuracy.toStringAsFixed(1)}m');

      // Prefs'ten token ve ayarları al
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString(StorageKeys.accessToken);

      if (accessToken == null || accessToken.isEmpty) {
        debugPrint('[WorkManager] No access token');
        return true;
      }

      // GPS doğruluk kontrolü - düşük doğrulukta hız verisi güvenilmez
      // 50m üzeri doğruluk = GPS gürültüsü olabilir, foreground başlatma
      if (position.accuracy > 50) {
        debugPrint('[WorkManager] GPS accuracy too low (${position.accuracy.toStringAsFixed(1)}m), skipping foreground check');
        await _sendLocation(position, accessToken, prefs);
        return true;
      }

      // Hız kontrolü - 35 km/s üzerinde mi? (GPS gürültüsünü önlemek için biraz yüksek eşik)
      if (speedKmh >= _speedThresholdKmh) {
        debugPrint('[WorkManager] Speed >= $_speedThresholdKmh km/h, switching to Foreground mode');
        // Foreground moduna geç (bu WorkManager içinden yapılamaz, flag kaydet)
        await prefs.setBool('should_start_foreground', true);
        // Konumu yine de gönder
        await _sendLocation(position, accessToken, prefs);
        return true;
      }

      // Yavaş hız - normal WorkManager modunda devam
      await _sendLocation(position, accessToken, prefs);
      debugPrint('[WorkManager] Location sent in WorkManager mode');

      // Arama kayıtlarını da senkronize et (her 15 dakikada bir)
      await _syncCallLogsInBackground(accessToken);

      return true;
    } catch (e) {
      debugPrint('[WorkManager] Error: $e');
      return true;
    }
  });
}

/// Konumu backend'e gönder
Future<void> _sendLocation(Position position, String accessToken, SharedPreferences prefs) async {
  try {
    // Bağlantı kontrolü
    final connectivity = Connectivity();
    final result = await connectivity.checkConnectivity();
    bool isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);

    // Batarya seviyesi
    int batteryLevel = 100;
    try {
      final battery = Battery();
      batteryLevel = await battery.batteryLevel;
    } catch (e) {
      // ignore
    }

    // Telefon kullanım durumunu kontrol et
    final phoneInUse = prefs.getBool('phone_in_use') ?? false;
    // Telefon kullanımı flag'ini sıfırla (bir kez gönderildi)
    if (phoneInUse) {
      await prefs.setBool('phone_in_use', false);
    }

    // Konum verisi
    final locationData = {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'speed': position.speed,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'heading': position.heading,
      'is_moving': position.speed > 2,
      'activity_type': position.speed * 3.6 > 30 ? 'driving' : (position.speed > 2 ? 'moving' : 'still'),
      'battery_level': batteryLevel,
      'phone_in_use': phoneInUse,
      'recorded_at': DateTime.now().toIso8601String(),
    };

    if (!isOnline) {
      // Çevrimdışı - kuyruğa ekle
      debugPrint('[WorkManager] Offline, queuing location');
      final pendingJson = prefs.getString('pending_locations') ?? '[]';
      List<dynamic> pending = json.decode(pendingJson);
      pending.add(locationData);
      if (pending.length > 500) pending.removeAt(0);
      await prefs.setString('pending_locations', json.encode(pending));
      return;
    }

    // Online - gönder
    final dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ));

    // Önce bekleyen konumları gönder
    final pendingJson = prefs.getString('pending_locations') ?? '[]';
    List<dynamic> pending = json.decode(pendingJson);
    if (pending.isNotEmpty) {
      try {
        await dio.post(ApiConstants.locationBatch, data: {'locations': pending});
        await prefs.setString('pending_locations', '[]');
        debugPrint('[WorkManager] Sent ${pending.length} pending locations');
      } catch (e) {
        debugPrint('[WorkManager] Failed to send pending: $e');
      }
    }

    // Mevcut konumu gönder
    await dio.post(ApiConstants.location, data: locationData);
    debugPrint('[WorkManager] Location sent: ${position.latitude}, ${position.longitude}');
  } catch (e) {
    debugPrint('[WorkManager] Send error: $e');
  }
}

/// Arka planda arama kayıtlarını senkronize et
Future<void> _syncCallLogsInBackground(String accessToken) async {
  try {
    // Son sync zamanını kontrol et
    final prefs = await SharedPreferences.getInstance();
    final lastSyncStr = prefs.getString('last_call_sync');
    final now = DateTime.now();

    if (lastSyncStr != null) {
      final lastSync = DateTime.tryParse(lastSyncStr);
      if (lastSync != null && now.difference(lastSync).inMinutes < 30) {
        // Son 30 dakika içinde sync yapıldıysa atla
        debugPrint('[WorkManager] Call sync skipped (last sync < 30 min ago)');
        return;
      }
    }

    // Arama geçmişi izni kontrolü
    final phonePermission = await Permission.phone.isGranted;
    if (!phonePermission) {
      debugPrint('[WorkManager] Call sync skipped (no phone permission)');
      return;
    }

    // Son 24 saatteki aramaları al
    final threshold = DateTime.now().subtract(const Duration(hours: 24));
    final entries = await call_log_pkg.CallLog.query(
      dateFrom: threshold.millisecondsSinceEpoch,
    );

    final calls = <Map<String, dynamic>>[];
    for (final entry in entries) {
      calls.add({
        'phone_number': entry.number ?? '',
        'call_type': _getCallTypeName(entry.callType),
        'duration_seconds': entry.duration ?? 0,
        'timestamp': DateTime.fromMillisecondsSinceEpoch(entry.timestamp ?? 0).toIso8601String(),
        'contact_name': entry.name,
      });
    }

    if (calls.isEmpty) {
      debugPrint('[WorkManager] No calls to sync');
      return;
    }

    // API'ye gönder
    final dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ));

    await dio.post('/driver/call-logs', data: {'calls': calls});
    await prefs.setString('last_call_sync', now.toIso8601String());
    debugPrint('[WorkManager] Synced ${calls.length} call logs');
  } catch (e) {
    debugPrint('[WorkManager] Call sync error: $e');
  }
}

String _getCallTypeName(call_log_pkg.CallType? type) {
  switch (type) {
    case call_log_pkg.CallType.outgoing:
      return 'outgoing';
    case call_log_pkg.CallType.incoming:
      return 'incoming';
    case call_log_pkg.CallType.missed:
      return 'missed';
    case call_log_pkg.CallType.rejected:
      return 'rejected';
    default:
      return 'unknown';
  }
}

/// iOS background handler
@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

/// Foreground Service ana fonksiyonu
@pragma('vm:entry-point')
void _onForegroundStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  debugPrint('[Foreground] Service started');

  Dio? dio;
  String? accessToken;
  Timer? locationTimer;
  int slowSpeedCount = 0; // Yavaş hız sayacı

  // Prefs'ten token al
  final prefs = await SharedPreferences.getInstance();
  accessToken = prefs.getString(StorageKeys.accessToken);

  if (accessToken != null && accessToken.isNotEmpty) {
    dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ));
  }

  // Stop komutu dinle
  if (service is AndroidServiceInstance) {
    service.on('stop').listen((event) {
      debugPrint('[Foreground] Stop command received');
      locationTimer?.cancel();
      service.stopSelf();
    });
  }

  // Token güncelleme dinle
  service.on('updateToken').listen((event) async {
    final newToken = event?['token'] as String?;
    if (newToken != null && newToken.isNotEmpty) {
      accessToken = newToken;
      dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $newToken',
        },
      ));
      debugPrint('[Foreground] Token updated');
    }
  });

  // Konum gönderme fonksiyonu
  Future<void> sendLocation() async {
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      double speedKmh = position.speed * 3.6;
      debugPrint('[Foreground] Speed: ${speedKmh.toStringAsFixed(1)} km/h');

      // Hız kontrolü - durdurma için daha düşük eşik kullan (histerezis)
      if (speedKmh < _speedStopThresholdKmh) {
        slowSpeedCount++;
        debugPrint('[Foreground] Slow speed count: $slowSpeedCount (speed: ${speedKmh.toStringAsFixed(1)} < $_speedStopThresholdKmh)');

        // 1 dakika (2 x 30sn) yavaş hız = WorkManager'a dön
        if (slowSpeedCount >= _slowSpeedCheckCount) {
          debugPrint('[Foreground] Speed low for 1 min, switching to WorkManager mode');
          await prefs.setBool('should_start_foreground', false);
          locationTimer?.cancel();
          service.invoke('stop');
          return;
        }
      } else {
        slowSpeedCount = 0; // Hızlandı, sayacı sıfırla
      }

      // Batarya seviyesi
      int batteryLevel = 100;
      try {
        final battery = Battery();
        batteryLevel = await battery.batteryLevel;
      } catch (e) {
        // ignore
      }

      final locationData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'speed': position.speed,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'heading': position.heading,
        'is_moving': speedKmh > 5,
        'activity_type': 'driving',
        'battery_level': batteryLevel,
        'phone_in_use': false, // Foreground modunda telefon kullanılmıyor (sürüş halinde)
        'recorded_at': DateTime.now().toIso8601String(),
      };

      if (dio != null) {
        await dio!.post(ApiConstants.location, data: locationData);
        debugPrint('[Foreground] Location sent');
      }

      // Bildirim güncelle
      if (service is AndroidServiceInstance) {
        service.setForegroundNotificationInfo(
          title: 'Nakliyeo',
          content: 'Seyahat: ${speedKmh.toStringAsFixed(0)} km/s',
        );
      }
    } catch (e) {
      debugPrint('[Foreground] Error: $e');
    }
  }

  // Her 5 dakikada konum gönder (Foreground modunda)
  locationTimer = Timer.periodic(const Duration(seconds: _foregroundIntervalSeconds), (_) {
    sendLocation();
  });

  // İlk konumu hemen gönder
  sendLocation();
}
