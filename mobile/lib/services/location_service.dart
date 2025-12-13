import 'dart:async';
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/cargo.dart';

enum ActivityType { driving, still, walking, unknown }
enum DriverStatus { home, driving, stopped, unknown }

class LocationData {
  final double latitude;
  final double longitude;
  final double? speed;
  final double? accuracy;
  final double? altitude;
  final double? heading;
  final bool isMoving;
  final ActivityType activityType;
  final int? batteryLevel;
  final DateTime recordedAt;

  LocationData({
    required this.latitude,
    required this.longitude,
    this.speed,
    this.accuracy,
    this.altitude,
    this.heading,
    required this.isMoving,
    required this.activityType,
    this.batteryLevel,
    required this.recordedAt,
  });

  Map<String, dynamic> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
    'speed': speed,
    'accuracy': accuracy,
    'altitude': altitude,
    'heading': heading,
    'is_moving': isMoving,
    'activity_type': activityType.name,
    'battery_level': batteryLevel,
    'recorded_at': recordedAt.toIso8601String(),
  };

  factory LocationData.fromJson(Map<String, dynamic> json) {
    return LocationData(
      latitude: json['latitude'] as double,
      longitude: json['longitude'] as double,
      speed: json['speed'] as double?,
      accuracy: json['accuracy'] as double?,
      altitude: json['altitude'] as double?,
      heading: json['heading'] as double?,
      isMoving: json['is_moving'] as bool,
      activityType: ActivityType.values.firstWhere(
        (e) => e.name == json['activity_type'],
        orElse: () => ActivityType.unknown,
      ),
      batteryLevel: json['battery_level'] as int?,
      recordedAt: DateTime.parse(json['recorded_at'] as String),
    );
  }
}

class LocationService {
  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<AccelerometerEvent>? _accelerometerSubscription;
  StreamSubscription<BatteryState>? _batterySubscription;
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;
  Timer? _locationTimer;
  Timer? _syncTimer;

  Position? _lastPosition;
  DateTime? _lastStopTime;
  bool _isMoving = false;
  double _currentAcceleration = 0;
  int _currentBatteryLevel = 100;
  bool _isCharging = false;
  bool _isOnline = true;
  bool _isWifi = false;

  final Battery _battery = Battery();
  final Connectivity _connectivity = Connectivity();

  // Offline location storage
  List<LocationData> _pendingLocations = [];

  // Configuration
  MobileConfig _config = MobileConfig();

  final _locationController = StreamController<LocationData>.broadcast();
  Stream<LocationData> get locationStream => _locationController.stream;

  final _statusController = StreamController<DriverStatus>.broadcast();
  Stream<DriverStatus> get statusStream => _statusController.stream;

  final _batteryController = StreamController<int>.broadcast();
  Stream<int> get batteryStream => _batteryController.stream;

  double? homeLatitude;
  double? homeLongitude;

  // Update configuration from ConfigProvider
  void updateConfig(MobileConfig config) {
    _config = config;
    // Restart tracking with new settings if already tracking
    if (_positionSubscription != null) {
      stopTracking();
      startTracking();
    }
  }

  Future<bool> checkPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  Future<Position?> getCurrentPosition() async {
    if (!await checkPermission()) return null;

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: _getLocationAccuracy(),
    );
  }

  LocationAccuracy _getLocationAccuracy() {
    // Battery-based accuracy adjustment
    if (_config.batteryOptimizationEnabled && _currentBatteryLevel <= _config.lowBatteryThreshold) {
      return LocationAccuracy.low;
    }

    switch (_config.locationAccuracyMode) {
      case 'high':
        return LocationAccuracy.best;
      case 'low_power':
        return LocationAccuracy.low;
      case 'balanced':
      default:
        return LocationAccuracy.high;
    }
  }

  int _getCurrentInterval() {
    // Low battery mode
    if (_config.batteryOptimizationEnabled && _currentBatteryLevel <= _config.lowBatteryThreshold && !_isCharging) {
      return _config.lowBatteryIntervalSeconds;
    }

    // Fast moving mode
    if (_isMoving && _lastPosition != null && _lastPosition!.speed > (_config.fastMovingThresholdKmh / 3.6)) {
      return _config.fastMovingIntervalSeconds;
    }

    // Normal moving/stationary mode
    return _isMoving
        ? _config.locationUpdateIntervalMoving
        : _config.locationUpdateIntervalStationary;
  }

  Future<void> startTracking() async {
    if (!await checkPermission()) return;

    // Load pending locations from storage
    await _loadPendingLocations();

    // Start battery monitoring
    _currentBatteryLevel = await _battery.batteryLevel;
    _batteryController.add(_currentBatteryLevel);

    _batterySubscription = _battery.onBatteryStateChanged.listen((state) async {
      _isCharging = state == BatteryState.charging || state == BatteryState.full;
      _currentBatteryLevel = await _battery.batteryLevel;
      _batteryController.add(_currentBatteryLevel);
    });

    // Start connectivity monitoring
    final connectivityResult = await _connectivity.checkConnectivity();
    _updateConnectivity(connectivityResult);

    _connectivitySubscription = _connectivity.onConnectivityChanged.listen(_updateConnectivity);

    // Accelerometer monitoring for movement detection
    if (_config.activityRecognitionEnabled) {
      _accelerometerSubscription = accelerometerEventStream().listen((event) {
        _currentAcceleration = _calculateAcceleration(event);
        _detectMovement();
      });
    }

    // Position tracking with dynamic interval
    _startLocationTimer();

    // Sync timer for offline locations
    if (_config.offlineModeEnabled) {
      _syncTimer = Timer.periodic(
        Duration(minutes: _config.offlineSyncIntervalMinutes),
        (_) => _syncPendingLocations(),
      );
    }
  }

  void _startLocationTimer() {
    _locationTimer?.cancel();

    // Get initial position
    _fetchLocation();

    // Start periodic location fetching
    _locationTimer = Timer.periodic(
      Duration(seconds: _getCurrentInterval()),
      (_) => _fetchLocation(),
    );
  }

  Future<void> _fetchLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: _getLocationAccuracy(),
      );

      // Check minimum displacement
      if (_lastPosition != null) {
        double distance = Geolocator.distanceBetween(
          _lastPosition!.latitude,
          _lastPosition!.longitude,
          position.latitude,
          position.longitude,
        );

        if (distance < _config.minimumDisplacementMeters && !_isMoving) {
          return; // Skip if not moved enough and not moving
        }
      }

      _processPosition(position);

      // Adjust timer if interval changed
      int newInterval = _getCurrentInterval();
      if (_locationTimer != null) {
        // Restart timer with new interval if needed
        _locationTimer?.cancel();
        _locationTimer = Timer.periodic(
          Duration(seconds: newInterval),
          (_) => _fetchLocation(),
        );
      }
    } catch (e) {
      // Handle location fetch error
    }
  }

  void _updateConnectivity(ConnectivityResult result) {
    _isOnline = result != ConnectivityResult.none;
    _isWifi = result == ConnectivityResult.wifi;

    // Sync when back online
    if (_isOnline && _pendingLocations.isNotEmpty) {
      if (!_config.syncOnWifiOnly || _isWifi) {
        _syncPendingLocations();
      }
    }
  }

  void stopTracking() {
    _positionSubscription?.cancel();
    _accelerometerSubscription?.cancel();
    _batterySubscription?.cancel();
    _connectivitySubscription?.cancel();
    _locationTimer?.cancel();
    _syncTimer?.cancel();

    _positionSubscription = null;
    _accelerometerSubscription = null;
    _batterySubscription = null;
    _connectivitySubscription = null;
    _locationTimer = null;
    _syncTimer = null;

    // Save pending locations before stopping
    _savePendingLocations();
  }

  double _calculateAcceleration(AccelerometerEvent event) {
    return (event.x.abs() + event.y.abs() + event.z.abs()) / 3;
  }

  void _detectMovement() {
    bool wasMoving = _isMoving;
    _isMoving = _currentAcceleration > 2.0;

    if (wasMoving != _isMoving) {
      if (_isMoving) {
        _lastStopTime = null;
      } else {
        _lastStopTime = DateTime.now();
      }
    }
  }

  void _processPosition(Position position) {
    ActivityType activityType = _determineActivityType();
    DriverStatus status = _determineStatus(position);

    final locationData = LocationData(
      latitude: position.latitude,
      longitude: position.longitude,
      speed: position.speed,
      accuracy: position.accuracy,
      altitude: position.altitude,
      heading: position.heading,
      isMoving: _isMoving,
      activityType: activityType,
      batteryLevel: _currentBatteryLevel,
      recordedAt: DateTime.now(),
    );

    _locationController.add(locationData);
    _statusController.add(status);

    // Store for offline sync if enabled
    if (_config.offlineModeEnabled) {
      _addPendingLocation(locationData);
    }

    _lastPosition = position;
  }

  ActivityType _determineActivityType() {
    if (_isMoving) {
      if (_lastPosition != null && _lastPosition!.speed > 5) {
        return ActivityType.driving;
      } else if (_currentAcceleration > 1.5 && _currentAcceleration < 3) {
        return ActivityType.walking;
      }
      return ActivityType.driving;
    }
    return ActivityType.still;
  }

  DriverStatus _determineStatus(Position position) {
    // Home check
    if (homeLatitude != null && homeLongitude != null) {
      double distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        homeLatitude!,
        homeLongitude!,
      );

      if (distance <= LocationConstants.homeRadius) {
        return DriverStatus.home;
      }
    }

    if (_isMoving && position.speed > 5) {
      return DriverStatus.driving;
    }

    // Stop detection
    if (_config.stopDetectionEnabled && !_isMoving && _lastStopTime != null) {
      Duration stopDuration = DateTime.now().difference(_lastStopTime!);
      if (stopDuration.inMinutes >= _config.stopDetectionMinMinutes) {
        return DriverStatus.stopped;
      }
    }

    return DriverStatus.unknown;
  }

  void setHomeLocation(double lat, double lng) {
    homeLatitude = lat;
    homeLongitude = lng;
  }

  // Offline location management
  void _addPendingLocation(LocationData location) {
    _pendingLocations.add(location);

    // Limit pending locations
    if (_pendingLocations.length > _config.maxOfflineLocations) {
      _pendingLocations.removeAt(0);
    }

    // Auto-save periodically
    _savePendingLocations();
  }

  Future<void> _loadPendingLocations() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final String? jsonString = prefs.getString(StorageKeys.pendingLocations);
      if (jsonString != null) {
        final List<dynamic> jsonList = json.decode(jsonString);
        _pendingLocations = jsonList
            .map((j) => LocationData.fromJson(j as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      _pendingLocations = [];
    }
  }

  Future<void> _savePendingLocations() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = json.encode(_pendingLocations.map((l) => l.toJson()).toList());
      await prefs.setString(StorageKeys.pendingLocations, jsonString);
    } catch (e) {
      // Handle save error
    }
  }

  Future<void> _syncPendingLocations() async {
    if (_pendingLocations.isEmpty || !_isOnline) return;

    // Check WiFi-only setting
    if (_config.syncOnWifiOnly && !_isWifi) return;

    // This will be called by LocationProvider to actually send to server
    // Just notify that sync is needed
  }

  List<LocationData> getPendingLocations() {
    return List.from(_pendingLocations);
  }

  void clearPendingLocations(int count) {
    if (count >= _pendingLocations.length) {
      _pendingLocations.clear();
    } else {
      _pendingLocations.removeRange(0, count);
    }
    _savePendingLocations();
  }

  int get pendingLocationCount => _pendingLocations.length;
  bool get isOnline => _isOnline;
  bool get isWifi => _isWifi;
  int get batteryLevel => _currentBatteryLevel;
  bool get isCharging => _isCharging;

  void dispose() {
    stopTracking();
    _locationController.close();
    _statusController.close();
    _batteryController.close();
  }
}
