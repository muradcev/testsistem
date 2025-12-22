import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'package:dio/dio.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:call_log/call_log.dart' as call_log_pkg;
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_background_service/flutter_background_service.dart';

import '../config/constants.dart';
import '../providers/config_provider.dart';
import 'geofence_service.dart';
import 'trip_detection_service.dart';
import 'background_location_service.dart';

// Sabitler
const String _workManagerTaskName = 'nakliyeo_location_task';
const String _workManagerTaskTag = 'location';
const int _defaultWorkManagerIntervalMinutes = 15;
const double _movementThresholdMeters = 50; // 50 metreden az hareket = sabit
const double _speedThresholdMs = 2.0; // 2 m/s = 7.2 km/h altı = sabit
const double _maxAccuracyMeters = 100.0; // 100m'den kötü accuracy'li konumları atla
const int _maxRetryCount = 3; // API hatalarında maksimum retry
const int _retryDelaySeconds = 5; // Retry arasındaki bekleme süresi

// Akıllı Pil Modu sabitleri
const int _lowBatteryThreshold = 20; // %20 altında düşük pil
const int _criticalBatteryThreshold = 10; // %10 altında kritik pil
const double _lowBatteryAccuracyMeters = 150.0; // Düşük pilde daha düşük accuracy kabul
const double _lowBatteryMovementThreshold = 100.0; // Düşük pilde daha az hassas hareket algılama

// Anomali Tespiti sabitleri
const double _maxPossibleSpeedKmh = 200.0; // Maksimum olası hız (km/h)
const double _minAnomalyDistanceMeters = 5000.0; // 5km altında anomali kontrolü yapma
const int _minAnomalyTimeSeconds = 60; // Minimum zaman farkı (saniye)

// Sıkıştırma sabitleri
const int _compressionThreshold = 5; // 5+ konumda sıkıştırma kullan
const String _healthStatsKey = 'location_health_stats';

/// Config değerlerini SharedPreferences'tan oku
class _RemoteConfig {
  static int getWorkManagerInterval(SharedPreferences prefs) {
    return prefs.getInt(MobileConfigKeys.heartbeatIntervalMinutes) ?? _defaultWorkManagerIntervalMinutes;
  }

  static int getMaxOfflineLocations(SharedPreferences prefs) {
    return prefs.getInt(MobileConfigKeys.maxOfflineLocations) ?? 500;
  }
}

/// Akıllı Konum Servisi
/// - Hareket algılama: Hız ve konum değişimine göre
/// - Hareket halinde: 1 dakikada bir konum kaydı (buffer), 15 dakikada bir toplu gönderim
/// - Sabit durumda: 15 dakikada bir tek konum gönderimi
/// - Arka planda sessiz çalışma (bildirim YOK)
/// - Token yenileme desteği
/// - AKTİF SEFER MODU: Foreground service ile daha sık güncelleme
class HybridLocationService {
  static bool _isInitialized = false;
  static bool _isActiveTripMode = false;

  /// Servisi başlat
  static Future<void> initialize() async {
    if (_isInitialized) return;

    debugPrint('[HybridLocation] Initializing...');

    // WorkManager'ı başlat
    await Workmanager().initialize(
      workManagerCallbackDispatcher,
      isInDebugMode: false,
    );

    // Geofence servisini başlat
    await GeofenceService.initialize();

    // Trip detection servisini başlat
    await TripDetectionService.initialize();

    _isInitialized = true;
    debugPrint('[HybridLocation] Initialized');
  }

  /// Geofence bölgelerini sunucudan senkronize et
  static Future<void> syncGeofences() async {
    final prefs = await SharedPreferences.getInstance();
    final accessToken = prefs.getString(StorageKeys.accessToken);
    if (accessToken != null) {
      await GeofenceService.syncZonesFromServer(accessToken);
    }
  }

  /// WorkManager periyodik görevini başlat
  static Future<void> startWorkManagerMode() async {
    debugPrint('[HybridLocation] Starting WorkManager mode...');

    // Config'den interval al
    final prefs = await SharedPreferences.getInstance();
    final intervalMinutes = _RemoteConfig.getWorkManagerInterval(prefs);

    // WorkManager periyodik görevini kaydet
    await Workmanager().registerPeriodicTask(
      _workManagerTaskName,
      _workManagerTaskName,
      frequency: Duration(minutes: intervalMinutes),
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

    debugPrint('[HybridLocation] WorkManager started (every $intervalMinutes min)');
  }

  /// Tüm servisleri durdur
  static Future<void> stopAll() async {
    debugPrint('[HybridLocation] Stopping all services...');
    await Workmanager().cancelByTag(_workManagerTaskTag);
    debugPrint('[HybridLocation] All services stopped');
  }

  /// Anlık konum gönder (uygulama açılınca, soru cevaplanınca vb.)
  static Future<bool> sendImmediateLocation({String? trigger}) async {
    debugPrint('[HybridLocation] Sending immediate location (trigger: $trigger)...');

    try {
      // Konum izni kontrolü
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        debugPrint('[HybridLocation] Location permission denied');
        return false;
      }

      // Konum servisi kontrolü
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('[HybridLocation] Location service disabled');
        return false;
      }

      // Mevcut konumu al
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // Prefs'ten token al
      final prefs = await SharedPreferences.getInstance();
      String? accessToken = prefs.getString(StorageKeys.accessToken);

      if (accessToken == null || accessToken.isEmpty) {
        // Token yoksa yenilemeyi dene
        accessToken = await _tryRefreshToken(prefs);
        if (accessToken == null) {
          debugPrint('[HybridLocation] No access token');
          return false;
        }
      }

      // Son konumu kaydet (hareket algılama için)
      await _saveLastPosition(prefs, position);

      // Geofence kontrolü
      final geofenceEvents = await GeofenceService.checkLocation(
        position.latitude,
        position.longitude,
      );
      if (geofenceEvents.isNotEmpty) {
        debugPrint('[HybridLocation] Geofence events: ${geofenceEvents.map((e) => "${e.eventType.name}:${e.zone.name}").join(", ")}');
      }

      // Konumu gönder
      await _sendLocationToServer(position, accessToken, prefs, trigger: trigger);
      debugPrint('[HybridLocation] Immediate location sent: ${position.latitude}, ${position.longitude}');
      return true;
    } catch (e) {
      debugPrint('[HybridLocation] Immediate location error: $e');
      return false;
    }
  }

  /// Aktif sefer modu açık mı?
  static bool get isActiveTripMode => _isActiveTripMode;

  /// Aktif sefer modunu başlat (foreground service ile daha sık konum)
  /// Sefer başladığında çağrılır - 1 dakikada bir konum güncelleme sağlar
  static Future<void> startActiveTripMode() async {
    if (_isActiveTripMode) {
      debugPrint('[HybridLocation] Active trip mode already running');
      return;
    }

    debugPrint('[HybridLocation] Starting ACTIVE TRIP MODE with foreground service');

    try {
      // Foreground service'i başlat
      await BackgroundLocationService.startService();
      _isActiveTripMode = true;

      // SharedPreferences'a kaydet (restart için)
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('active_trip_mode', true);

      debugPrint('[HybridLocation] Active trip mode STARTED - 1 minute location updates');
    } catch (e) {
      debugPrint('[HybridLocation] Failed to start active trip mode: $e');
    }
  }

  /// Aktif sefer modunu durdur (normal WorkManager moduna dön)
  /// Sefer bittiğinde çağrılır
  static Future<void> stopActiveTripMode() async {
    if (!_isActiveTripMode) {
      debugPrint('[HybridLocation] Active trip mode not running');
      return;
    }

    debugPrint('[HybridLocation] Stopping active trip mode');

    try {
      // Foreground service'i durdur
      await BackgroundLocationService.stopService();
      _isActiveTripMode = false;

      // SharedPreferences'tan kaldır
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('active_trip_mode', false);

      debugPrint('[HybridLocation] Active trip mode STOPPED - back to WorkManager mode');
    } catch (e) {
      debugPrint('[HybridLocation] Failed to stop active trip mode: $e');
    }
  }

  /// Sefer durumu değişikliğini işle
  /// TripDetectionService'den callback ile çağrılır
  static Future<void> handleTripStateChange(TripState state, Map<String, dynamic>? data) async {
    debugPrint('[HybridLocation] Trip state changed: ${state.name}');

    switch (state) {
      case TripState.active:
        // Sefer başladı - foreground mode aç
        await startActiveTripMode();
        break;
      case TripState.idle:
        // Sefer bitti - foreground mode kapat
        await stopActiveTripMode();
        break;
      case TripState.starting:
      case TripState.ending:
        // Onay bekleniyor - mevcut durumu koru
        break;
    }
  }

  /// Uygulama başlangıcında aktif sefer modunu kontrol et
  static Future<void> restoreActiveTripMode() async {
    final prefs = await SharedPreferences.getInstance();
    final wasActiveTripMode = prefs.getBool('active_trip_mode') ?? false;

    if (wasActiveTripMode && TripDetectionService.hasActiveTrip) {
      debugPrint('[HybridLocation] Restoring active trip mode...');
      await startActiveTripMode();
    }
  }

  /// Token güncellemesini foreground service'e ilet
  static Future<void> updateToken(String token) async {
    if (_isActiveTripMode) {
      try {
        final service = FlutterBackgroundService();
        service.invoke('updateToken', {'token': token});
        debugPrint('[HybridLocation] Token updated in foreground service');
      } catch (e) {
        debugPrint('[HybridLocation] Failed to update token in foreground service: $e');
      }
    }
  }

  // Eski API uyumluluğu için (kullanılmıyor artık)
  static bool get isForegroundMode => _isActiveTripMode;
  static Future<void> startForegroundMode() async => startActiveTripMode();
  static Future<void> stopForegroundMode() async => stopActiveTripMode();

  /// Sağlık istatistiklerini getir
  static Future<LocationHealthStats> getHealthStats() async {
    return await LocationHealthStats.load();
  }

  /// Bekleyen konum sayısını getir
  static Future<int> getPendingCount() async {
    final prefs = await SharedPreferences.getInstance();
    final pendingJson = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
    final List<dynamic> pending = json.decode(pendingJson);
    return pending.length;
  }

  /// Son başarılı gönderim zamanı
  static Future<DateTime?> getLastSuccessTime() async {
    final stats = await LocationHealthStats.load();
    return stats.lastSuccessAt;
  }
}

/// GZIP sıkıştırma - büyük batch'ler için veri tasarrufu
List<int> _compressData(String jsonData) {
  final bytes = utf8.encode(jsonData);
  return gzip.encode(bytes);
}

/// Sıkıştırılmış veri boyutu hesapla
String _formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

/// Sağlık istatistiklerini kaydet
class LocationHealthStats {
  int totalSent = 0;
  int totalFailed = 0;
  int totalCompressed = 0;
  int bytesSaved = 0;
  DateTime? lastSuccessAt;
  DateTime? lastFailAt;
  String? lastError;

  LocationHealthStats();

  factory LocationHealthStats.fromJson(Map<String, dynamic> json) {
    final stats = LocationHealthStats();
    stats.totalSent = json['total_sent'] ?? 0;
    stats.totalFailed = json['total_failed'] ?? 0;
    stats.totalCompressed = json['total_compressed'] ?? 0;
    stats.bytesSaved = json['bytes_saved'] ?? 0;
    stats.lastSuccessAt = json['last_success_at'] != null
        ? DateTime.tryParse(json['last_success_at'])
        : null;
    stats.lastFailAt = json['last_fail_at'] != null
        ? DateTime.tryParse(json['last_fail_at'])
        : null;
    stats.lastError = json['last_error'];
    return stats;
  }

  Map<String, dynamic> toJson() => {
    'total_sent': totalSent,
    'total_failed': totalFailed,
    'total_compressed': totalCompressed,
    'bytes_saved': bytesSaved,
    'last_success_at': lastSuccessAt?.toIso8601String(),
    'last_fail_at': lastFailAt?.toIso8601String(),
    'last_error': lastError,
  };

  double get successRate => totalSent + totalFailed > 0
      ? (totalSent / (totalSent + totalFailed)) * 100
      : 100.0;

  static Future<LocationHealthStats> load() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_healthStatsKey);
    if (json != null) {
      return LocationHealthStats.fromJson(jsonDecode(json));
    }
    return LocationHealthStats();
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_healthStatsKey, jsonEncode(toJson()));
  }

  void recordSuccess() {
    totalSent++;
    lastSuccessAt = DateTime.now();
    lastError = null;
  }

  void recordFailure(String error) {
    totalFailed++;
    lastFailAt = DateTime.now();
    lastError = error;
  }

  void recordCompression(int originalSize, int compressedSize) {
    totalCompressed++;
    bytesSaved += (originalSize - compressedSize);
  }
}

/// Son konumu kaydet
Future<void> _saveLastPosition(SharedPreferences prefs, Position position) async {
  await prefs.setDouble(StorageKeys.lastLatitude, position.latitude);
  await prefs.setDouble(StorageKeys.lastLongitude, position.longitude);
  await prefs.setDouble(StorageKeys.lastSpeed, position.speed);
  await prefs.setString(StorageKeys.lastLocationTime, DateTime.now().toIso8601String());
}

/// İki konum arasındaki mesafeyi hesapla (metre)
double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
}

/// Pil durumuna göre ayarları al
class _BatterySettings {
  final double maxAccuracy;
  final double movementThreshold;
  final bool shouldSkip;
  final String mode;

  _BatterySettings({
    required this.maxAccuracy,
    required this.movementThreshold,
    required this.shouldSkip,
    required this.mode,
  });

  static Future<_BatterySettings> get(int batteryLevel, bool isMoving) async {
    if (batteryLevel <= _criticalBatteryThreshold) {
      // Kritik pil: Sadece hareket halindeyse gönder
      return _BatterySettings(
        maxAccuracy: _lowBatteryAccuracyMeters,
        movementThreshold: _lowBatteryMovementThreshold,
        shouldSkip: !isMoving, // Sabit durumda konum gönderme
        mode: 'critical',
      );
    } else if (batteryLevel <= _lowBatteryThreshold) {
      // Düşük pil: Daha az hassas
      return _BatterySettings(
        maxAccuracy: _lowBatteryAccuracyMeters,
        movementThreshold: _lowBatteryMovementThreshold,
        shouldSkip: false,
        mode: 'low',
      );
    }
    // Normal pil
    return _BatterySettings(
      maxAccuracy: _maxAccuracyMeters,
      movementThreshold: _movementThresholdMeters,
      shouldSkip: false,
      mode: 'normal',
    );
  }
}

/// Anomali tespiti - şüpheli konum zıplamalarını filtrele
Future<bool> _isLocationAnomaly(SharedPreferences prefs, Position position) async {
  final lastLat = prefs.getDouble(StorageKeys.lastLatitude);
  final lastLon = prefs.getDouble(StorageKeys.lastLongitude);
  final lastTimeStr = prefs.getString(StorageKeys.lastLocationTime);

  if (lastLat == null || lastLon == null || lastTimeStr == null) {
    return false; // İlk konum, anomali değil
  }

  final lastTime = DateTime.tryParse(lastTimeStr);
  if (lastTime == null) return false;

  final distance = _calculateDistance(lastLat, lastLon, position.latitude, position.longitude);
  final timeDiff = DateTime.now().difference(lastTime).inSeconds;

  // Çok kısa sürede kontrol yapma
  if (timeDiff < _minAnomalyTimeSeconds) return false;

  // Çok kısa mesafede anomali kontrolü yapma
  if (distance < _minAnomalyDistanceMeters) return false;

  // Hesaplanan hız (km/h)
  final calculatedSpeedKmh = (distance / 1000) / (timeDiff / 3600);

  // Maksimum olası hızı aşıyorsa anomali
  if (calculatedSpeedKmh > _maxPossibleSpeedKmh) {
    debugPrint('[Anomaly] Detected: ${calculatedSpeedKmh.toStringAsFixed(1)} km/h over ${(distance/1000).toStringAsFixed(1)}km in ${timeDiff}s');
    return true;
  }

  return false;
}

/// Hareket durumunu kontrol et
Future<bool> _isCurrentlyMoving(SharedPreferences prefs, Position currentPosition) async {
  // Hız kontrolü
  if (currentPosition.speed > _speedThresholdMs) {
    await prefs.setBool(StorageKeys.isMoving, true);
    return true;
  }

  // Son konum ile karşılaştır
  final lastLat = prefs.getDouble(StorageKeys.lastLatitude);
  final lastLon = prefs.getDouble(StorageKeys.lastLongitude);
  final lastTimeStr = prefs.getString(StorageKeys.lastLocationTime);

  if (lastLat != null && lastLon != null && lastTimeStr != null) {
    final lastTime = DateTime.tryParse(lastTimeStr);
    if (lastTime != null) {
      final distance = _calculateDistance(lastLat, lastLon, currentPosition.latitude, currentPosition.longitude);
      final timeDiff = DateTime.now().difference(lastTime).inSeconds;

      // Son 5 dakikada 50 metreden fazla hareket varsa hareketli say
      if (timeDiff < 300 && distance > _movementThresholdMeters) {
        await prefs.setBool(StorageKeys.isMoving, true);
        return true;
      }
    }
  }

  await prefs.setBool(StorageKeys.isMoving, false);
  return false;
}

/// Buffer'a konum ekle (hareket halinde 1 dakikada bir)
Future<void> _addToBuffer(SharedPreferences prefs, Map<String, dynamic> locationData) async {
  final bufferJson = prefs.getString(StorageKeys.bufferedLocations) ?? '[]';
  List<dynamic> buffer = json.decode(bufferJson);
  buffer.add(locationData);

  // Maksimum 100 konum tut (yaklaşık 100 dakikalık veri)
  if (buffer.length > 100) {
    buffer.removeAt(0);
  }

  await prefs.setString(StorageKeys.bufferedLocations, json.encode(buffer));
  debugPrint('[Location] Added to buffer, total: ${buffer.length}');
}

/// Buffer'ı temizle
Future<void> _clearBuffer(SharedPreferences prefs) async {
  await prefs.setString(StorageKeys.bufferedLocations, '[]');
}

/// Buffer'daki konumları al
Future<List<dynamic>> _getBufferedLocations(SharedPreferences prefs) async {
  final bufferJson = prefs.getString(StorageKeys.bufferedLocations) ?? '[]';
  return json.decode(bufferJson);
}

/// Token yenileme
Future<String?> _tryRefreshToken(SharedPreferences prefs) async {
  try {
    final refreshToken = prefs.getString(StorageKeys.refreshToken);
    if (refreshToken == null || refreshToken.isEmpty) {
      debugPrint('[Token] No refresh token available');
      return null;
    }

    debugPrint('[Token] Attempting to refresh token...');

    final dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    final response = await dio.post(
      ApiConstants.refreshToken,
      data: {'refresh_token': refreshToken},
    );

    if (response.statusCode == 200) {
      final newAccessToken = response.data['access_token'];
      final newRefreshToken = response.data['refresh_token'];

      await prefs.setString(StorageKeys.accessToken, newAccessToken);
      if (newRefreshToken != null) {
        await prefs.setString(StorageKeys.refreshToken, newRefreshToken);
      }

      debugPrint('[Token] Token refreshed successfully');
      return newAccessToken;
    }
  } catch (e) {
    debugPrint('[Token] Refresh failed: $e');
  }
  return null;
}

/// WorkManager callback - her 15 dakikada çalışır (BİLDİRİM YOK)
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
        desiredAccuracy: LocationAccuracy.medium, // Pil tasarrufu için medium
      );

      debugPrint('[WorkManager] Got position: ${position.latitude}, ${position.longitude}, speed: ${position.speed} m/s');

      // Prefs'ten token al
      final prefs = await SharedPreferences.getInstance();
      String? accessToken = prefs.getString(StorageKeys.accessToken);

      if (accessToken == null || accessToken.isEmpty) {
        // Token yoksa yenilemeyi dene
        accessToken = await _tryRefreshToken(prefs);
        if (accessToken == null) {
          debugPrint('[WorkManager] No access token, cannot send location');
          return true;
        }
      }

      // Anomali tespiti - şüpheli konum zıplamalarını filtrele
      final isAnomaly = await _isLocationAnomaly(prefs, position);
      if (isAnomaly) {
        debugPrint('[WorkManager] Location anomaly detected, skipping');
        return true;
      }

      // Hareket durumunu kontrol et
      final isMoving = await _isCurrentlyMoving(prefs, position);
      debugPrint('[WorkManager] Movement status: ${isMoving ? "MOVING" : "STATIONARY"}');

      // Batarya seviyesi
      int batteryLevel = 100;
      bool isCharging = false;
      try {
        final battery = Battery();
        batteryLevel = await battery.batteryLevel;
        final batteryState = await battery.batteryState;
        isCharging = batteryState == BatteryState.charging || batteryState == BatteryState.full;
      } catch (e) {
        // ignore
      }

      // Akıllı Pil Modu kontrolü
      final batterySettings = await _BatterySettings.get(batteryLevel, isMoving);
      debugPrint('[WorkManager] Battery mode: ${batterySettings.mode}, level: $batteryLevel%');

      if (batterySettings.shouldSkip && !isCharging) {
        debugPrint('[WorkManager] Skipping location due to critical battery (stationary)');
        return true;
      }

      // Accuracy kontrolü (pil durumuna göre dinamik)
      if (position.accuracy > batterySettings.maxAccuracy) {
        debugPrint('[WorkManager] Skipping low accuracy: ${position.accuracy}m > ${batterySettings.maxAccuracy}m');
        return true;
      }

      // Son konumu kaydet
      await _saveLastPosition(prefs, position);

      // Geofence kontrolü
      final geofenceEvents = await GeofenceService.checkLocation(
        position.latitude,
        position.longitude,
      );
      if (geofenceEvents.isNotEmpty) {
        debugPrint('[WorkManager] Geofence events: ${geofenceEvents.map((e) => "${e.eventType.name}:${e.zone.name}").join(", ")}');
      }

      // Sefer algılama kontrolü
      final tripState = await TripDetectionService.checkLocation(position, isMoving: isMoving);
      debugPrint('[WorkManager] Trip state: ${tripState.name}');

      // Konum verisi
      final locationData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'speed': position.speed,
        'speed_kmh': position.speed * 3.6,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'heading': position.heading,
        'is_moving': isMoving,
        'activity_type': position.speed * 3.6 > 30 ? 'driving' : (isMoving ? 'moving' : 'still'),
        'battery_level': batteryLevel,
        'battery_mode': batterySettings.mode,
        'is_charging': isCharging,
        'trigger': 'workmanager',
        'recorded_at': DateTime.now().toUtc().toIso8601String(),
      };

      if (isMoving) {
        // Hareket halinde: Buffer'a ekle
        await _addToBuffer(prefs, locationData);

        // Son gönderim zamanını kontrol et
        final lastSendTimeStr = prefs.getString(StorageKeys.lastSendTime);
        final now = DateTime.now();
        bool shouldSend = true;

        if (lastSendTimeStr != null) {
          final lastSendTime = DateTime.tryParse(lastSendTimeStr);
          if (lastSendTime != null) {
            final intervalMinutes = _RemoteConfig.getWorkManagerInterval(prefs);
            shouldSend = now.difference(lastSendTime).inMinutes >= intervalMinutes;
          }
        }

        if (shouldSend) {
          // Buffer'daki tüm konumları gönder
          final bufferedLocations = await _getBufferedLocations(prefs);
          if (bufferedLocations.isNotEmpty) {
            await _sendBatchLocations(bufferedLocations, accessToken, prefs);
            await _clearBuffer(prefs);
            await prefs.setString(StorageKeys.lastSendTime, now.toIso8601String());
            debugPrint('[WorkManager] Sent ${bufferedLocations.length} buffered locations');
          }
        } else {
          debugPrint('[WorkManager] Moving - buffering location, will send at next interval');
        }
      } else {
        // Sabit durumda: Direkt gönder (15 dakikada bir)
        await _sendLocationToServer(position, accessToken, prefs, trigger: 'workmanager_stationary');
        await prefs.setString(StorageKeys.lastSendTime, DateTime.now().toIso8601String());
        debugPrint('[WorkManager] Stationary - sent single location');
      }

      // Arama kayıtlarını da senkronize et (her 30 dakikada bir)
      await _syncCallLogsInBackground(accessToken, prefs);

      return true;
    } catch (e) {
      debugPrint('[WorkManager] Error: $e');
      return true;
    }
  });
}

/// Toplu konum gönderimi (GZIP sıkıştırma ile)
Future<void> _sendBatchLocations(
  List<dynamic> locations,
  String accessToken,
  SharedPreferences prefs,
) async {
  final healthStats = await LocationHealthStats.load();

  try {
    // Bağlantı kontrolü
    final connectivity = Connectivity();
    final result = await connectivity.checkConnectivity();
    bool isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);

    if (!isOnline) {
      // Çevrimdışı - pending'e ekle
      debugPrint('[Location] Offline, queuing ${locations.length} locations');
      final pendingJson = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
      List<dynamic> pending = json.decode(pendingJson);
      pending.addAll(locations);
      final maxOffline = _RemoteConfig.getMaxOfflineLocations(prefs);
      while (pending.length > maxOffline) {
        pending.removeAt(0);
      }
      await prefs.setString(StorageKeys.pendingLocations, json.encode(pending));
      return;
    }

    // Sıkıştırma kullanılacak mı?
    final useCompression = locations.length >= _compressionThreshold;

    final dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': useCompression ? 'application/gzip' : 'application/json',
        'Authorization': 'Bearer $accessToken',
        if (useCompression) 'Content-Encoding': 'gzip',
      },
    ));

    // Önce bekleyen konumları gönder
    final pendingJson = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
    List<dynamic> pending = json.decode(pendingJson);
    if (pending.isNotEmpty) {
      try {
        final data = {'locations': pending};
        if (useCompression && pending.length >= _compressionThreshold) {
          final jsonStr = json.encode(data);
          final compressed = _compressData(jsonStr);
          debugPrint('[Location] Compressed ${_formatBytes(jsonStr.length)} -> ${_formatBytes(compressed.length)}');
          healthStats.recordCompression(jsonStr.length, compressed.length);
          await dio.post(ApiConstants.locationBatch, data: Stream.fromIterable([compressed]));
        } else {
          await dio.post(ApiConstants.locationBatch, data: data);
        }
        await prefs.setString(StorageKeys.pendingLocations, '[]');
        healthStats.recordSuccess();
        debugPrint('[Location] Sent ${pending.length} pending locations');
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 401) {
          // Token geçersiz - yenile
          final newToken = await _tryRefreshToken(prefs);
          if (newToken != null) {
            dio.options.headers['Authorization'] = 'Bearer $newToken';
            await dio.post(ApiConstants.locationBatch, data: {'locations': pending});
            await prefs.setString(StorageKeys.pendingLocations, '[]');
            healthStats.recordSuccess();
          }
        } else {
          healthStats.recordFailure(e.toString());
          debugPrint('[Location] Failed to send pending: $e');
        }
      }
    }

    // Yeni konumları gönder (sıkıştırma ile)
    try {
      final data = {'locations': locations};
      if (useCompression) {
        final jsonStr = json.encode(data);
        final compressed = _compressData(jsonStr);
        debugPrint('[Location] Compressed ${_formatBytes(jsonStr.length)} -> ${_formatBytes(compressed.length)}');
        healthStats.recordCompression(jsonStr.length, compressed.length);
        await dio.post(ApiConstants.locationBatch, data: Stream.fromIterable([compressed]));
      } else {
        await dio.post(ApiConstants.locationBatch, data: data);
      }
      healthStats.recordSuccess();
      debugPrint('[Location] Sent ${locations.length} new locations');
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 401) {
        // Token geçersiz - yenile ve tekrar dene
        final newToken = await _tryRefreshToken(prefs);
        if (newToken != null) {
          dio.options.headers['Authorization'] = 'Bearer $newToken';
          await dio.post(ApiConstants.locationBatch, data: {'locations': locations});
          healthStats.recordSuccess();
        }
      } else {
        // Başarısız - pending'e ekle
        healthStats.recordFailure(e.toString());
        debugPrint('[Location] Failed to send batch, queuing: $e');
        final pendingJson2 = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
        List<dynamic> pending2 = json.decode(pendingJson2);
        pending2.addAll(locations);
        await prefs.setString(StorageKeys.pendingLocations, json.encode(pending2));
      }
    }

    // Sağlık istatistiklerini kaydet
    await healthStats.save();
  } catch (e) {
    debugPrint('[Location] Batch send error: $e');
  }
}

/// Konumu backend'e gönder (accuracy filtresi, anomali tespiti ve retry mekanizması ile)
Future<void> _sendLocationToServer(
  Position position,
  String accessToken,
  SharedPreferences prefs, {
  String? trigger,
}) async {
  try {
    // Anomali tespiti - şüpheli konum zıplamalarını filtrele
    final isAnomaly = await _isLocationAnomaly(prefs, position);
    if (isAnomaly) {
      debugPrint('[Location] Anomaly detected, skipping location');
      return;
    }

    // Batarya durumu al
    int batteryLevel = 100;
    bool isCharging = false;
    try {
      final battery = Battery();
      batteryLevel = await battery.batteryLevel;
      final batteryState = await battery.batteryState;
      isCharging = batteryState == BatteryState.charging || batteryState == BatteryState.full;
    } catch (e) {
      // ignore
    }

    // Hareket durumu kontrolü
    final isMoving = await _isCurrentlyMoving(prefs, position);

    // Akıllı Pil Modu
    final batterySettings = await _BatterySettings.get(batteryLevel, isMoving);

    // Kritik pil ve sabit durumda konum gönderme (şarjda değilse)
    if (batterySettings.shouldSkip && !isCharging) {
      debugPrint('[Location] Skipping due to critical battery (stationary)');
      return;
    }

    // Accuracy filtresi - pil durumuna göre dinamik
    if (position.accuracy > batterySettings.maxAccuracy) {
      debugPrint('[Location] Skipping low accuracy: ${position.accuracy}m > ${batterySettings.maxAccuracy}m');
      return;
    }

    // Bağlantı kontrolü
    final connectivity = Connectivity();
    final result = await connectivity.checkConnectivity();
    bool isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);

    // Konum verisi (batteryLevel, isCharging, isMoving, batterySettings yukarıda hesaplandı)
    final locationData = {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'speed': position.speed,
      'speed_kmh': position.speed * 3.6,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'heading': position.heading,
      'is_moving': isMoving,
      'activity_type': position.speed * 3.6 > 30 ? 'driving' : (isMoving ? 'moving' : 'still'),
      'battery_level': batteryLevel,
      'battery_mode': batterySettings.mode,
      'is_charging': isCharging,
      'trigger': trigger ?? 'unknown',
      'recorded_at': DateTime.now().toUtc().toIso8601String(),
    };

    if (!isOnline) {
      // Çevrimdışı - kuyruğa ekle
      debugPrint('[Location] Offline, queuing location');
      final pendingJson = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
      List<dynamic> pending = json.decode(pendingJson);
      pending.add(locationData);
      final maxOffline = _RemoteConfig.getMaxOfflineLocations(prefs);
      if (pending.length > maxOffline) pending.removeAt(0);
      await prefs.setString(StorageKeys.pendingLocations, json.encode(pending));
      return;
    }

    // Online - gönder (retry mekanizması ile)
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
    await _sendPendingLocationsWithRetry(dio, prefs);

    // Mevcut konumu gönder (retry ile)
    await _sendWithRetry(
      dio: dio,
      endpoint: ApiConstants.location,
      data: locationData,
      prefs: prefs,
      maxRetries: _maxRetryCount,
    );
  } catch (e) {
    debugPrint('[Location] Send error: $e');
  }
}

/// Bekleyen konumları retry ile gönder
Future<void> _sendPendingLocationsWithRetry(Dio dio, SharedPreferences prefs) async {
  final pendingJson = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
  List<dynamic> pending = json.decode(pendingJson);

  if (pending.isEmpty) return;

  final success = await _sendWithRetry(
    dio: dio,
    endpoint: ApiConstants.locationBatch,
    data: {'locations': pending},
    prefs: prefs,
    maxRetries: _maxRetryCount,
  );

  if (success) {
    await prefs.setString(StorageKeys.pendingLocations, '[]');
    debugPrint('[Location] Sent ${pending.length} pending locations');
  }
}

/// Retry mekanizması ile API çağrısı
Future<bool> _sendWithRetry({
  required Dio dio,
  required String endpoint,
  required dynamic data,
  required SharedPreferences prefs,
  int maxRetries = 3,
}) async {
  int retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await dio.post(endpoint, data: data);
      return true;
    } catch (e) {
      if (e is DioException) {
        if (e.response?.statusCode == 401) {
          // Token geçersiz - yenile
          debugPrint('[Location] Token expired, refreshing...');
          final newToken = await _tryRefreshToken(prefs);
          if (newToken != null) {
            dio.options.headers['Authorization'] = 'Bearer $newToken';
            retryCount++; // Token yenilendi, tekrar dene
            continue;
          } else {
            debugPrint('[Location] Token refresh failed');
            return false;
          }
        } else if (e.type == DioExceptionType.connectionTimeout ||
                   e.type == DioExceptionType.sendTimeout ||
                   e.type == DioExceptionType.receiveTimeout ||
                   e.response?.statusCode == 500 ||
                   e.response?.statusCode == 502 ||
                   e.response?.statusCode == 503) {
          // Geçici hata - retry yap
          retryCount++;
          if (retryCount < maxRetries) {
            debugPrint('[Location] Retry $retryCount/$maxRetries after ${_retryDelaySeconds}s...');
            await Future.delayed(Duration(seconds: _retryDelaySeconds * retryCount));
            continue;
          }
        }
      }
      debugPrint('[Location] Send failed after $retryCount retries: $e');
      return false;
    }
  }
  return false;
}

/// Arka planda arama kayıtlarını senkronize et
Future<void> _syncCallLogsInBackground(String accessToken, SharedPreferences prefs) async {
  try {
    // Son sync zamanını kontrol et
    final lastSyncStr = prefs.getString('last_call_sync');
    final now = DateTime.now();

    if (lastSyncStr != null) {
      final lastSync = DateTime.tryParse(lastSyncStr);
      if (lastSync != null && now.difference(lastSync).inMinutes < 30) {
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

    try {
      await dio.post('/driver/call-logs', data: {'calls': calls});
      await prefs.setString('last_call_sync', now.toIso8601String());
      debugPrint('[WorkManager] Synced ${calls.length} call logs');
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 401) {
        // Token geçersiz - yenile
        final newToken = await _tryRefreshToken(prefs);
        if (newToken != null) {
          dio.options.headers['Authorization'] = 'Bearer $newToken';
          await dio.post('/driver/call-logs', data: {'calls': calls});
          await prefs.setString('last_call_sync', now.toIso8601String());
        }
      }
    }
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
