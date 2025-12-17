import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart' hide ActivityType;
import '../services/location_service.dart';
import '../services/api_service.dart';
import '../models/cargo.dart';

class LocationProvider extends ChangeNotifier {
  final LocationService _locationService;
  final ApiService _apiService;

  StreamSubscription<LocationData>? _locationSubscription;
  StreamSubscription<DriverStatus>? _statusSubscription;
  StreamSubscription<int>? _batterySubscription;
  Timer? _syncTimer;
  Timer? _singleLocationTimer;

  bool _isTracking = false;
  LocationData? _currentLocation;
  LocationData? _lastSentLocation; // Duplikat önleme için son gönderilen konum
  DriverStatus _currentStatus = DriverStatus.stopped; // Varsayılan olarak durmuş
  int _batteryLevel = 100;
  bool _isOnline = true;
  int _pendingCount = 0;

  // Configuration
  MobileConfig _config = MobileConfig();

  LocationProvider(this._locationService, this._apiService);

  bool get isTracking => _isTracking;
  LocationData? get currentLocation => _currentLocation;
  DriverStatus get currentStatus => _currentStatus;
  int get batteryLevel => _batteryLevel;
  bool get isOnline => _isOnline;
  bool get isCharging => _locationService.isCharging;
  int get pendingLocationCount => _pendingCount;

  // Update configuration and pass to LocationService
  void updateConfig(MobileConfig config) {
    _config = config;
    _locationService.updateConfig(config);
    notifyListeners();
  }

  Future<bool> checkAndRequestPermission() async {
    return await _locationService.checkPermission();
  }

  Future<void> startTracking() async {
    if (_isTracking) return;

    await _locationService.startTracking();

    // Location updates - sadece state güncelle, gönderimi timer yapar
    _locationSubscription = _locationService.locationStream.listen((location) {
      _currentLocation = location;
      _pendingCount = _locationService.pendingLocationCount;
      notifyListeners();
      // NOT: Duplikat önlemek için burada gönderim yapmıyoruz
      // Gönderim _singleLocationTimer tarafından kontrollü yapılıyor
    });

    // Status updates
    _statusSubscription = _locationService.statusStream.listen((status) {
      _currentStatus = status;
      notifyListeners();
    });

    // Battery updates
    _batterySubscription = _locationService.batteryStream.listen((level) {
      _batteryLevel = level;
      notifyListeners();
    });

    // Periodic sync based on config - sadece batch sync için kullanılacak
    _syncTimer = Timer.periodic(
      Duration(minutes: _config.offlineSyncIntervalMinutes),
      (_) => _syncPendingLocations(),
    );

    // Ana konum gönderim timer'ı - config'den interval alıyor
    _singleLocationTimer = Timer.periodic(
      Duration(seconds: _config.locationUpdateIntervalMoving),
      (_) => _sendCurrentLocationIfChanged(),
    );

    _isTracking = true;
    _isOnline = _locationService.isOnline;
    _batteryLevel = _locationService.batteryLevel;
    notifyListeners();

    // İlk konumu hemen gönder
    _sendCurrentLocation();
  }

  Future<void> _sendSingleLocation(LocationData location) async {
    try {
      await _apiService.sendLocation(location.toJson());
      debugPrint('Location sent: ${location.latitude}, ${location.longitude}');
    } catch (e) {
      debugPrint('Failed to send single location: $e');
    }
  }

  Future<void> _sendCurrentLocation() async {
    if (_currentLocation == null) return;
    await _sendSingleLocation(_currentLocation!);
  }

  /// Sadece konum değiştiyse gönder - duplikat önleme
  Future<void> _sendCurrentLocationIfChanged() async {
    if (_currentLocation == null) return;

    // Önceki gönderimle karşılaştır
    if (_lastSentLocation != null) {
      final distance = Geolocator.distanceBetween(
        _lastSentLocation!.latitude,
        _lastSentLocation!.longitude,
        _currentLocation!.latitude,
        _currentLocation!.longitude,
      );

      // Minimum 10 metre hareket yoksa ve aynı dakika içindeyse gönderme
      final timeDiff = _currentLocation!.recordedAt
          .difference(_lastSentLocation!.recordedAt)
          .inSeconds;

      if (distance < 10 && timeDiff < 60) {
        debugPrint('Location unchanged (${distance.toStringAsFixed(1)}m, ${timeDiff}s) - skipping');
        return;
      }
    }

    await _sendSingleLocation(_currentLocation!);
    _lastSentLocation = _currentLocation;
  }

  void stopTracking() {
    _locationSubscription?.cancel();
    _statusSubscription?.cancel();
    _batterySubscription?.cancel();
    _syncTimer?.cancel();
    _singleLocationTimer?.cancel();
    _locationService.stopTracking();

    // Sync remaining locations
    _syncPendingLocations();

    _isTracking = false;
    notifyListeners();
  }

  Future<void> _syncPendingLocations() async {
    final pendingLocations = _locationService.getPendingLocations();
    if (pendingLocations.isEmpty) return;

    // Check connectivity
    _isOnline = _locationService.isOnline;
    if (!_isOnline) {
      debugPrint('Offline - skipping sync');
      return;
    }

    // Check WiFi-only setting
    if (_config.syncOnWifiOnly && !_locationService.isWifi) {
      debugPrint('WiFi only sync enabled but not on WiFi - skipping');
      return;
    }

    try {
      // Send batch to server
      await _apiService.sendBatchLocations(
        pendingLocations.map((l) => l.toJson()).toList(),
      );

      // Clear synced locations
      _locationService.clearPendingLocations(pendingLocations.length);
      _pendingCount = _locationService.pendingLocationCount;
      notifyListeners();

      debugPrint('Synced ${pendingLocations.length} locations');
    } catch (e) {
      debugPrint('Failed to sync locations: $e');
      // Locations remain in pending queue for next sync
    }
  }

  // Force sync now
  Future<void> syncNow() async {
    await _syncPendingLocations();
  }

  void setHomeLocation(double lat, double lng) {
    _locationService.setHomeLocation(lat, lng);
  }

  // Get current position without tracking
  Future<LocationData?> getCurrentPosition() async {
    final position = await _locationService.getCurrentPosition();
    if (position != null) {
      return LocationData(
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        accuracy: position.accuracy,
        altitude: position.altitude,
        heading: position.heading,
        isMoving: false,
        activityType: ActivityType.unknown,
        batteryLevel: _batteryLevel,
        recordedAt: DateTime.now(),
      );
    }
    return null;
  }

  @override
  void dispose() {
    stopTracking();
    _locationService.dispose();
    super.dispose();
  }
}
