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
          initialNotificationContent: 'Konum takibi aktif',
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
  StreamSubscription<ConnectivityResult>? connectivitySubscription;
  List<Map<String, dynamic>> pendingLocations = [];
  int batteryLevel = 100;
  bool isOnline = true;

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
  try {
    batteryLevel = await battery.batteryLevel;
  } catch (e) {
    batteryLevel = 100;
  }

  // Connectivity monitoring
  final connectivity = Connectivity();
  try {
    final result = await connectivity.checkConnectivity();
    isOnline = result != ConnectivityResult.none;
  } catch (e) {
    isOnline = true;
  }

  connectivitySubscription = connectivity.onConnectivityChanged.listen((result) {
    isOnline = result != ConnectivityResult.none;
    if (isOnline && pendingLocations.isNotEmpty && dio != null) {
      _syncLocations(dio!, pendingLocations, prefs);
    }
  });

  // Save pending locations helper
  Future<void> savePendingLocations() async {
    await prefs.setString('bg_pending_locations', json.encode(pendingLocations));
  }

  // Get location interval based on conditions
  int getLocationInterval() {
    // Low battery - longer interval
    if (batteryLevel <= 20) {
      return 600; // 10 minutes
    }
    // Normal interval
    return 60; // 1 minute
  }

  // Fetch and send location
  Future<void> fetchAndSendLocation() async {
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

      // Get current position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: batteryLevel <= 20
            ? LocationAccuracy.low
            : LocationAccuracy.high,
      );

      // Update battery level
      try {
        batteryLevel = await battery.batteryLevel;
      } catch (e) {
        // Keep previous value
      }

      // Create location data
      final locationData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'speed': position.speed,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'heading': position.heading,
        'is_moving': position.speed > 2,
        'activity_type': position.speed > 5 ? 'driving' : 'still',
        'battery_level': batteryLevel,
        'recorded_at': DateTime.now().toIso8601String(),
      };

      // Add to pending queue
      pendingLocations.add(locationData);

      // Limit queue size
      if (pendingLocations.length > 500) {
        pendingLocations.removeAt(0);
      }

      await savePendingLocations();

      debugPrint('Background: Location recorded - ${position.latitude}, ${position.longitude}');

      // Try to sync if online
      if (isOnline && dio != null && pendingLocations.length >= 5) {
        await _syncLocations(dio!, pendingLocations, prefs);
      }

    } catch (e) {
      debugPrint('Background: Error getting location - $e');
    }
  }

  // Listen for stop command
  if (service is AndroidServiceInstance) {
    service.on('stop').listen((event) {
      locationTimer?.cancel();
      syncTimer?.cancel();
      notificationTimer?.cancel();
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

  // Start location timer
  locationTimer = Timer.periodic(
    Duration(seconds: getLocationInterval()),
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

  // Initial location fetch
  fetchAndSendLocation();

  // Update notification periodically
  notificationTimer = Timer.periodic(const Duration(minutes: 1), (timer) async {
    if (service is AndroidServiceInstance) {
      if (await service.isForegroundService()) {
        String statusText = isOnline ? 'Aktif' : 'Çevrimdışı';
        String pendingText = pendingLocations.isNotEmpty
            ? ' (${pendingLocations.length} bekleyen)'
            : '';

        service.setForegroundNotificationInfo(
          title: 'Nakliyeo - Konum Takibi',
          content: '$statusText$pendingText',
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
