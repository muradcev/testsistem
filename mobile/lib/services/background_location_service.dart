import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../config/constants.dart';

// Bu dosya arka planda konum takibi için gerekli servisi sağlar
// Uygulama kapatıldığında bile çalışmaya devam eder

class BackgroundLocationService {
  static Future<void> initialize() async {
    try {
      final service = FlutterBackgroundService();

      await service.configure(
        androidConfiguration: AndroidConfiguration(
          onStart: onStart,
          autoStart: false, // Don't auto-start, wait for explicit call after login
          isForegroundMode: true,
          notificationChannelId: 'nakliyeo_location',
          initialNotificationTitle: 'Nakliyeo',
          initialNotificationContent: 'Sefer takibi aktif',
          foregroundServiceNotificationId: 888,
          foregroundServiceTypes: [AndroidForegroundType.location],
        ),
        iosConfiguration: IosConfiguration(
          autoStart: false, // Don't auto-start
          onForeground: onStart,
          onBackground: onIosBackground,
        ),
      );
    } catch (e) {
      debugPrint('BackgroundLocationService configure error: $e');
    }
  }

  static Future<void> startService() async {
    final service = FlutterBackgroundService();
    var isRunning = await service.isRunning();
    if (!isRunning) {
      service.startService();
    }
  }

  static Future<void> stopService() async {
    final service = FlutterBackgroundService();
    var isRunning = await service.isRunning();
    if (isRunning) {
      service.invoke('stop');
    }
  }
}

// iOS background handler
@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

// Main service entry point
@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  // Dio instance for API calls
  Dio? dio;
  String? accessToken;
  Timer? locationTimer;
  Timer? syncTimer;
  Timer? notificationTimer;
  Timer? intervalCheckTimer;
  StreamSubscription<List<ConnectivityResult>>? connectivitySubscription;
  List<Map<String, dynamic>> pendingLocations = [];
  int batteryLevel = 100;
  bool isCharging = false;
  bool isOnline = true;
  bool isMoving = false;
  double? lastLat;
  double? lastLon;
  DateTime? lastLocationTime;
  int currentInterval = 900; // Default 15 minutes (stationary)

  // Telemetri verileri
  String connectionType = 'unknown';
  String? wifiSsid;
  String? ipAddress;
  double maxAccelerationG = 0;
  AccelerometerEvent? lastAccelerometer;
  GyroscopeEvent? lastGyroscope;
  bool powerSaveMode = false;
  StreamSubscription? accelerometerSub;
  StreamSubscription? gyroscopeSub;

  // Load saved data
  final prefs = await SharedPreferences.getInstance();
  accessToken = prefs.getString(StorageKeys.accessToken);

  // Load pending locations - HybridLocationService ile aynı key kullan
  final pendingJson = prefs.getString(StorageKeys.pendingLocations);
  if (pendingJson != null) {
    try {
      pendingLocations = List<Map<String, dynamic>>.from(
        (json.decode(pendingJson) as List).map((e) => Map<String, dynamic>.from(e))
      );
    } catch (e) {
      pendingLocations = [];
    }
  }

  // Initialize Dio if we have a token
  if (accessToken != null && accessToken.isNotEmpty) {
    dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ));
  }

  // Battery monitoring
  final battery = Battery();
  Future<void> updateBatteryInfo() async {
    try {
      batteryLevel = await battery.batteryLevel;
      final state = await battery.batteryState;
      isCharging = state == BatteryState.charging || state == BatteryState.full;
    } catch (e) {
      // Keep previous values
    }
  }
  await updateBatteryInfo();

  // Connectivity monitoring
  final connectivity = Connectivity();
  try {
    final result = await connectivity.checkConnectivity();
    isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);
  } catch (e) {
    isOnline = true;
  }

  connectivitySubscription = connectivity.onConnectivityChanged.listen((result) async {
    isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);

    // Bağlantı tipi güncelle
    if (result.contains(ConnectivityResult.wifi)) {
      connectionType = 'wifi';
      // WiFi SSID al
      try {
        final networkInfo = NetworkInfo();
        wifiSsid = await networkInfo.getWifiName();
        ipAddress = await networkInfo.getWifiIP();
      } catch (e) {
        debugPrint('Background: WiFi info error: $e');
      }
    } else if (result.contains(ConnectivityResult.mobile)) {
      connectionType = 'mobile';
      wifiSsid = null;
    } else {
      connectionType = 'none';
      wifiSsid = null;
    }

    if (isOnline && pendingLocations.isNotEmpty && dio != null) {
      _syncLocations(dio!, pendingLocations, prefs);
    }
  });

  // İlk bağlantı tipini al
  try {
    final initialResult = await connectivity.checkConnectivity();
    if (initialResult.contains(ConnectivityResult.wifi)) {
      connectionType = 'wifi';
      final networkInfo = NetworkInfo();
      wifiSsid = await networkInfo.getWifiName();
      ipAddress = await networkInfo.getWifiIP();
    } else if (initialResult.contains(ConnectivityResult.mobile)) {
      connectionType = 'mobile';
    }
  } catch (e) {
    debugPrint('Background: Initial network info error: $e');
  }

  // Sensör dinleme (ivmeölçer ve jiroskop)
  try {
    accelerometerSub = accelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 500),
    ).listen((event) {
      lastAccelerometer = event;
      // Toplam ivme hesapla (G cinsinden)
      final totalG = ((event.x * event.x + event.y * event.y + event.z * event.z) / 9.8).abs();
      if (totalG > maxAccelerationG) {
        maxAccelerationG = totalG;
      }
    });

    gyroscopeSub = gyroscopeEventStream(
      samplingPeriod: const Duration(milliseconds: 500),
    ).listen((event) {
      lastGyroscope = event;
    });

    debugPrint('Background: Sensor listening started');
  } catch (e) {
    debugPrint('Background: Sensor init error: $e');
  }

  // Save pending locations helper - HybridLocationService ile aynı key kullan
  Future<void> savePendingLocations() async {
    await prefs.setString(StorageKeys.pendingLocations, json.encode(pendingLocations));
  }

  // Hareket kontrolü - hız ve konum değişimine göre
  bool checkMovement(Position position) {
    // Hız kontrolü (7.2 km/h = 2 m/s üstü = hareket)
    if (position.speed > 2.0) {
      return true;
    }

    // Konum değişimi kontrolü
    if (lastLat != null && lastLon != null && lastLocationTime != null) {
      final distance = Geolocator.distanceBetween(
        lastLat!,
        lastLon!,
        position.latitude,
        position.longitude,
      );
      final timeDiff = DateTime.now().difference(lastLocationTime!).inMinutes;

      // Son 5 dakikada 100 metreden fazla hareket = hareket halinde
      if (timeDiff <= 5 && distance > 100) {
        return true;
      }
    }

    return false;
  }

  // Get location interval based on conditions
  // Hareket halinde: 5 dakika, Duruyorsa: 15 dakika, Düşük pil: 20 dakika
  int getLocationInterval() {
    // Kritik pil - çok uzun interval
    if (batteryLevel <= 10 && !isCharging) {
      return 1200; // 20 dakika (kritik pil)
    }
    // Düşük pil - uzun interval
    if (batteryLevel <= 20 && !isCharging) {
      return 900; // 15 dakika (düşük pil)
    }
    // Hareket halinde - sık interval
    if (isMoving) {
      return 300; // 5 dakika (hareket halinde)
    }
    // Duruyorsa - normal interval
    return 900; // 15 dakika (sabit)
  }

  // Late function reference for timer restart
  late Future<void> Function() fetchAndSendLocation;

  // Timer'ı yeniden başlat (interval değiştiğinde)
  void restartLocationTimer() {
    final newInterval = getLocationInterval();
    if (newInterval != currentInterval) {
      debugPrint('Background: Interval changed from ${currentInterval}s to ${newInterval}s (moving: $isMoving, battery: $batteryLevel%)');
      currentInterval = newInterval;
      locationTimer?.cancel();
      locationTimer = Timer.periodic(
        Duration(seconds: currentInterval),
        (_) => fetchAndSendLocation(),
      );
    }
  }

  // Fetch and send location
  fetchAndSendLocation = () async {
    try {
      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        debugPrint('Background: Location permission denied');
        return;
      }

      // Check if location service is enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Background: Location service disabled');
        return;
      }

      // Update battery info
      await updateBatteryInfo();

      // Get current position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: batteryLevel <= 20 && !isCharging
            ? LocationAccuracy.low
            : LocationAccuracy.medium,
      );

      // Hareket durumunu güncelle
      final wasMoving = isMoving;
      isMoving = checkMovement(position);

      // Hareket durumu değiştiyse interval'ı güncelle
      if (wasMoving != isMoving) {
        debugPrint('Background: Movement status changed - now ${isMoving ? "MOVING" : "STATIONARY"}');
        restartLocationTimer();
      }

      // Son konumu kaydet
      lastLat = position.latitude;
      lastLon = position.longitude;
      lastLocationTime = DateTime.now();

      // Accuracy filtresi - 150m'den kötü accuracy'li konumları atla
      // (HybridLocationService ile uyumlu - düşük pil modunda 150m)
      const maxAccuracyMeters = 150.0;
      if (position.accuracy > maxAccuracyMeters) {
        debugPrint('Background: Skipping low accuracy location: ${position.accuracy.toStringAsFixed(0)}m > ${maxAccuracyMeters.toStringAsFixed(0)}m');
        return;
      }

      // Create location data with telemetry
      final locationData = {
        // Konum verileri
        'latitude': position.latitude,
        'longitude': position.longitude,
        'speed': position.speed,
        'speed_kmh': position.speed * 3.6,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'heading': position.heading,
        'is_moving': isMoving,
        'activity_type': position.speed * 3.6 > 30 ? 'driving' : (isMoving ? 'moving' : 'still'),

        // Pil verileri
        'battery_level': batteryLevel,
        'is_charging': isCharging,
        'power_save_mode': powerSaveMode,

        // Ağ verileri
        'connection_type': connectionType,
        'wifi_ssid': wifiSsid,
        'ip_address': ipAddress,

        // Sensör verileri
        'accelerometer': lastAccelerometer != null ? {
          'x': lastAccelerometer!.x,
          'y': lastAccelerometer!.y,
          'z': lastAccelerometer!.z,
        } : null,
        'gyroscope': lastGyroscope != null ? {
          'x': lastGyroscope!.x,
          'y': lastGyroscope!.y,
          'z': lastGyroscope!.z,
        } : null,
        'max_acceleration_g': maxAccelerationG,

        // Meta veriler
        'trigger': 'foreground_service',
        'interval_seconds': currentInterval,
        'recorded_at': DateTime.now().toUtc().toIso8601String(),
      };

      // Maksimum ivmeyi sıfırla (her konum gönderiminde)
      maxAccelerationG = 0;

      // Add to pending queue
      pendingLocations.add(locationData);

      // Limit queue size
      if (pendingLocations.length > 500) {
        pendingLocations.removeAt(0);
      }

      await savePendingLocations();

      debugPrint('Background: Location recorded - ${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)} | Speed: ${(position.speed * 3.6).toStringAsFixed(1)} km/h | Moving: $isMoving | Battery: $batteryLevel%');

      // Try to sync if online and enough locations
      if (isOnline && dio != null && pendingLocations.length >= 3) {
        await _syncLocations(dio!, pendingLocations, prefs);
      }

    } catch (e) {
      debugPrint('Background: Error getting location - $e');
    }
  };

  // Listen for stop command
  if (service is AndroidServiceInstance) {
    service.on('stop').listen((event) {
      locationTimer?.cancel();
      syncTimer?.cancel();
      notificationTimer?.cancel();
      intervalCheckTimer?.cancel();
      connectivitySubscription?.cancel();
      accelerometerSub?.cancel();
      gyroscopeSub?.cancel();
      savePendingLocations();
      service.stopSelf();
    });

    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });

    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  // Listen for token updates
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
          'Accept': 'application/json',
          'Authorization': 'Bearer $newToken',
        },
      ));
      debugPrint('Background: Token updated');
    }
  });

  // Start location timer with initial interval
  currentInterval = getLocationInterval();
  locationTimer = Timer.periodic(
    Duration(seconds: currentInterval),
    (_) => fetchAndSendLocation(),
  );

  // Periodic sync timer (every 5 minutes)
  syncTimer = Timer.periodic(
    const Duration(minutes: 5),
    (_) async {
      if (isOnline && dio != null && pendingLocations.isNotEmpty) {
        await _syncLocations(dio!, pendingLocations, prefs);
      }
    },
  );

  // Check interval changes periodically (pil durumu değişebilir)
  intervalCheckTimer = Timer.periodic(
    const Duration(minutes: 2),
    (_) async {
      await updateBatteryInfo();
      restartLocationTimer();
    },
  );

  // Initial location fetch
  fetchAndSendLocation();

  // Update notification periodically
  notificationTimer = Timer.periodic(const Duration(minutes: 3), (timer) async {
    if (service is AndroidServiceInstance) {
      if (await service.isForegroundService()) {
        final statusText = isMoving ? 'Hareket halinde' : 'Sabit';
        final batteryText = '$batteryLevel%';
        service.setForegroundNotificationInfo(
          title: 'Nakliyeo',
          content: '$statusText • Pil: $batteryText',
        );
      }
    }
  });
}

/// Token yenileme (background service için)
Future<String?> _tryRefreshTokenInBackground(SharedPreferences prefs) async {
  try {
    final refreshToken = prefs.getString(StorageKeys.refreshToken);
    if (refreshToken == null || refreshToken.isEmpty) {
      debugPrint('Background: No refresh token available');
      return null;
    }

    debugPrint('Background: Attempting to refresh token...');

    final dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    final response = await dio.post(
      ApiConstants.refreshToken,
      data: {'refresh_token': refreshToken},
    );

    if (response.statusCode == 200) {
      final authData = response.data['auth'] ?? response.data;
      final newAccessToken = authData['access_token'] as String?;
      final newRefreshToken = authData['refresh_token'] as String?;

      if (newAccessToken == null || newAccessToken.isEmpty) {
        debugPrint('Background: No access token in refresh response');
        return null;
      }

      await prefs.setString(StorageKeys.accessToken, newAccessToken);
      if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
        await prefs.setString(StorageKeys.refreshToken, newRefreshToken);
      }

      debugPrint('Background: Token refreshed successfully');
      return newAccessToken;
    }
  } catch (e) {
    debugPrint('Background: Token refresh failed - $e');
  }
  return null;
}

// Sync locations to server
Future<void> _syncLocations(
  Dio dio,
  List<Map<String, dynamic>> pendingLocations,
  SharedPreferences prefs,
) async {
  if (pendingLocations.isEmpty) return;

  try {
    // Take a batch (max 50 at a time)
    final batch = pendingLocations.take(50).toList();

    final response = await dio.post(
      ApiConstants.locationBatch,
      data: {'locations': batch},
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      // Remove synced locations
      pendingLocations.removeRange(0, batch.length);

      // Save updated pending list
      await prefs.setString(StorageKeys.pendingLocations, json.encode(pendingLocations));

      debugPrint('Background: Synced ${batch.length} locations');
    } else {
      debugPrint('Background: Sync returned status ${response.statusCode}');
    }
  } on DioException catch (e) {
    debugPrint('Background: Sync failed - ${e.type}: ${e.message}');
    if (e.response?.statusCode == 401) {
      debugPrint('Background: Token expired, attempting refresh...');
      // Token yenilemeyi dene
      final newToken = await _tryRefreshTokenInBackground(prefs);
      if (newToken != null) {
        // Yeni token ile Dio'yu güncelle
        dio.options.headers['Authorization'] = 'Bearer $newToken';
        // Tekrar göndermeyi dene
        try {
          final batch = pendingLocations.take(50).toList();
          final retryResponse = await dio.post(
            ApiConstants.locationBatch,
            data: {'locations': batch},
          );
          if (retryResponse.statusCode == 200 || retryResponse.statusCode == 201) {
            pendingLocations.removeRange(0, batch.length);
            await prefs.setString(StorageKeys.pendingLocations, json.encode(pendingLocations));
            debugPrint('Background: Synced ${batch.length} locations after token refresh');
          }
        } catch (retryError) {
          debugPrint('Background: Retry after refresh failed - $retryError');
        }
      }
    }
  } catch (e) {
    debugPrint('Background: Sync failed - $e');
    // Keep locations in queue for next sync
  }
}
