import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'package:dio/dio.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:call_log/call_log.dart' as call_log_pkg;
import 'package:permission_handler/permission_handler.dart';

import '../config/constants.dart';
import '../providers/config_provider.dart';

// Sabitler
const String _workManagerTaskName = 'nakliyeo_location_task';
const String _workManagerTaskTag = 'location';
const int _defaultWorkManagerIntervalMinutes = 15;

/// Config değerlerini SharedPreferences'tan oku
class _RemoteConfig {
  static int getWorkManagerInterval(SharedPreferences prefs) {
    return prefs.getInt(MobileConfigKeys.heartbeatIntervalMinutes) ?? _defaultWorkManagerIntervalMinutes;
  }

  static int getMaxOfflineLocations(SharedPreferences prefs) {
    return prefs.getInt(MobileConfigKeys.maxOfflineLocations) ?? 500;
  }
}

/// Basit Konum Servisi
/// - WorkManager: 15 dk'da bir arka planda konum (bildirim YOK)
/// - Anlık konum: Uygulama açılınca, soru cevaplanınca, admin isteyince
class HybridLocationService {
  static bool _isInitialized = false;

  /// Servisi başlat
  static Future<void> initialize() async {
    if (_isInitialized) return;

    debugPrint('[HybridLocation] Initializing...');

    // WorkManager'ı başlat
    await Workmanager().initialize(
      workManagerCallbackDispatcher,
      isInDebugMode: false,
    );

    _isInitialized = true;
    debugPrint('[HybridLocation] Initialized');
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
      final accessToken = prefs.getString(StorageKeys.accessToken);

      if (accessToken == null || accessToken.isEmpty) {
        debugPrint('[HybridLocation] No access token');
        return false;
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

  // Eski API uyumluluğu için (kullanılmıyor artık)
  static bool get isForegroundMode => false;
  static Future<void> startForegroundMode() async {}
  static Future<void> stopForegroundMode() async {}
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

      debugPrint('[WorkManager] Got position: ${position.latitude}, ${position.longitude}');

      // Prefs'ten token al
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString(StorageKeys.accessToken);

      if (accessToken == null || accessToken.isEmpty) {
        debugPrint('[WorkManager] No access token');
        return true;
      }

      // Konumu gönder
      await _sendLocationToServer(position, accessToken, prefs, trigger: 'workmanager');
      debugPrint('[WorkManager] Location sent successfully');

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
Future<void> _sendLocationToServer(
  Position position,
  String accessToken,
  SharedPreferences prefs, {
  String? trigger,
}) async {
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
      'trigger': trigger ?? 'unknown',
      'recorded_at': DateTime.now().toUtc().toIso8601String(),
    };

    if (!isOnline) {
      // Çevrimdışı - kuyruğa ekle
      debugPrint('[Location] Offline, queuing location');
      final pendingJson = prefs.getString('pending_locations') ?? '[]';
      List<dynamic> pending = json.decode(pendingJson);
      pending.add(locationData);
      final maxOffline = _RemoteConfig.getMaxOfflineLocations(prefs);
      if (pending.length > maxOffline) pending.removeAt(0);
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
        debugPrint('[Location] Sent ${pending.length} pending locations');
      } catch (e) {
        debugPrint('[Location] Failed to send pending: $e');
      }
    }

    // Mevcut konumu gönder
    await dio.post(ApiConstants.location, data: locationData);
  } catch (e) {
    debugPrint('[Location] Send error: $e');
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
