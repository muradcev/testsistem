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

  // Load saved data
  final prefs = await SharedPreferences.getInstance();
  accessToken = prefs.getString(StorageKeys.accessToken);

  // Load pending locations
  final pendingJson = prefs.getString('bg_pending_locations');
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

  connectivitySubscription = connectivity.onConnectivityChanged.listen((result) {
    isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);
    if (isOnline && pendingLocations.isNotEmpty && dio != null) {
      _syncLocations(dio!, pendingLocations, prefs);
    }
  });

  // Save pending locations helper
  Future<void> savePendingLocations() async {
    await prefs.setString('bg_pending_locations', json.encode(pendingLocations));
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

      // Create location data
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
        'is_charging': isCharging,
        'trigger': 'foreground_service',
        'interval_seconds': currentInterval,
        'recorded_at': DateTime.now().toUtc().toIso8601String(),
      };

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
      await prefs.setString('bg_pending_locations', json.encode(pendingLocations));

      debugPrint('Background: Synced ${batch.length} locations');
    } else {
      debugPrint('Background: Sync returned status ${response.statusCode}');
    }
  } on DioException catch (e) {
    debugPrint('Background: Sync failed - ${e.type}: ${e.message}');
    if (e.response?.statusCode == 401) {
      debugPrint('Background: Token expired, waiting for refresh...');
      // Token expired - clear the dio and wait for new token
      // The main app should refresh the token and send it to us
    }
  } catch (e) {
    debugPrint('Background: Sync failed - $e');
    // Keep locations in queue for next sync
  }
}
