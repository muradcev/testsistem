import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cargo.dart';
import '../services/api_service.dart';

/// SharedPreferences anahtarları - HybridLocationService tarafından da kullanılıyor
class MobileConfigKeys {
  static const String mobileConfig = 'mobile_config';
  static const String locationUpdateIntervalMoving = 'config_location_interval_moving';
  static const String locationUpdateIntervalStationary = 'config_location_interval_stationary';
  static const String minimumDisplacementMeters = 'config_minimum_displacement';
  static const String fastMovingThresholdKmh = 'config_fast_moving_threshold';
  static const String fastMovingIntervalSeconds = 'config_fast_moving_interval';
  static const String batteryOptimizationEnabled = 'config_battery_optimization';
  static const String lowBatteryThreshold = 'config_low_battery_threshold';
  static const String lowBatteryIntervalSeconds = 'config_low_battery_interval';
  static const String offlineModeEnabled = 'config_offline_mode';
  static const String maxOfflineLocations = 'config_max_offline_locations';
  static const String heartbeatIntervalMinutes = 'config_heartbeat_interval';
  static const String minAppVersion = 'config_min_app_version';
  static const String forceUpdateEnabled = 'config_force_update';
}

class ConfigProvider with ChangeNotifier {
  final ApiService _apiService;

  AppConfig _config = AppConfig();
  bool _isLoading = false;
  String? _error;

  ConfigProvider(this._apiService) {
    // Başlangıçta önce cache'den yükle
    _loadFromCache();
  }

  AppConfig get config => _config;
  List<CargoType> get cargoTypes => _config.cargoTypes;
  List<VehicleBrand> get vehicleBrands => _config.vehicleBrands;
  List<TrailerType> get trailerTypes => _config.trailerTypes;
  MobileConfig get mobileConfig => _config.mobileConfig;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // MobileConfig shortcuts
  int get locationIntervalMoving => _config.mobileConfig.locationUpdateIntervalMoving;
  int get locationIntervalStationary => _config.mobileConfig.locationUpdateIntervalStationary;
  int get minimumDisplacement => _config.mobileConfig.minimumDisplacementMeters;
  bool get offlineModeEnabled => _config.mobileConfig.offlineModeEnabled;
  int get maxOfflineLocations => _config.mobileConfig.maxOfflineLocations;
  bool get batteryOptimizationEnabled => _config.mobileConfig.batteryOptimizationEnabled;
  int get lowBatteryThreshold => _config.mobileConfig.lowBatteryThreshold;
  String get locationAccuracyMode => _config.mobileConfig.locationAccuracyMode;

  /// Önbellekten config yükle
  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final configJson = prefs.getString(MobileConfigKeys.mobileConfig);
      if (configJson != null) {
        final mobileConfig = MobileConfig.fromJson(json.decode(configJson));
        _config = AppConfig(mobileConfig: mobileConfig);
        debugPrint('[ConfigProvider] Loaded config from cache');
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[ConfigProvider] Cache load error: $e');
    }
  }

  /// Config'i SharedPreferences'a kaydet (WorkManager için)
  Future<void> _saveToCache(MobileConfig config) async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Full JSON olarak kaydet
      await prefs.setString(MobileConfigKeys.mobileConfig, json.encode(config.toJson()));

      // Ayrı ayrı da kaydet (kolay erişim için)
      await prefs.setInt(MobileConfigKeys.locationUpdateIntervalMoving, config.locationUpdateIntervalMoving);
      await prefs.setInt(MobileConfigKeys.locationUpdateIntervalStationary, config.locationUpdateIntervalStationary);
      await prefs.setInt(MobileConfigKeys.minimumDisplacementMeters, config.minimumDisplacementMeters);
      await prefs.setInt(MobileConfigKeys.fastMovingThresholdKmh, config.fastMovingThresholdKmh);
      await prefs.setInt(MobileConfigKeys.fastMovingIntervalSeconds, config.fastMovingIntervalSeconds);
      await prefs.setBool(MobileConfigKeys.batteryOptimizationEnabled, config.batteryOptimizationEnabled);
      await prefs.setInt(MobileConfigKeys.lowBatteryThreshold, config.lowBatteryThreshold);
      await prefs.setInt(MobileConfigKeys.lowBatteryIntervalSeconds, config.lowBatteryIntervalSeconds);
      await prefs.setBool(MobileConfigKeys.offlineModeEnabled, config.offlineModeEnabled);
      await prefs.setInt(MobileConfigKeys.maxOfflineLocations, config.maxOfflineLocations);
      await prefs.setInt(MobileConfigKeys.heartbeatIntervalMinutes, config.heartbeatIntervalMinutes);
      await prefs.setString(MobileConfigKeys.minAppVersion, config.minAppVersion);
      await prefs.setBool(MobileConfigKeys.forceUpdateEnabled, config.forceUpdateEnabled);

      debugPrint('[ConfigProvider] Saved config to cache - speedThreshold: ${config.fastMovingThresholdKmh} km/h, interval: ${config.fastMovingIntervalSeconds}s');
    } catch (e) {
      debugPrint('[ConfigProvider] Cache save error: $e');
    }
  }

  Future<void> loadConfig() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.get('/config/app');
      _config = AppConfig.fromJson(response.data);
      _error = null;

      // Config'i SharedPreferences'a kaydet (WorkManager ve Foreground Service için)
      await _saveToCache(_config.mobileConfig);

      debugPrint('[ConfigProvider] Config loaded from server');
    } catch (e) {
      _error = e.toString();
      debugPrint('[ConfigProvider] Config yüklenemedi: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Yük tipi adını ID'den al
  String getCargoTypeName(String? id) {
    if (id == null) return 'Bilinmiyor';
    final type = cargoTypes.firstWhere(
      (t) => t.id == id,
      orElse: () => CargoType(
        id: '',
        name: 'Bilinmiyor',
        description: '',
        icon: '',
        isActive: false,
        sortOrder: 0,
      ),
    );
    return type.name;
  }

  // Dorse tipi adını ID'den al
  String getTrailerTypeName(String? id) {
    if (id == null) return 'Bilinmiyor';
    final type = trailerTypes.firstWhere(
      (t) => t.id == id,
      orElse: () => TrailerType(
        id: '',
        name: 'Bilinmiyor',
        description: '',
        isActive: false,
        sortOrder: 0,
      ),
    );
    return type.name;
  }

  // Marka adını ID'den al
  String getVehicleBrandName(String? id) {
    if (id == null) return 'Bilinmiyor';
    final brand = vehicleBrands.firstWhere(
      (b) => b.id == id,
      orElse: () => VehicleBrand(
        id: '',
        name: 'Bilinmiyor',
        isActive: false,
        sortOrder: 0,
      ),
    );
    return brand.name;
  }

  // Marka modelleri
  List<VehicleModel> getModelsForBrand(String brandId) {
    final brand = vehicleBrands.firstWhere(
      (b) => b.id == brandId,
      orElse: () => VehicleBrand(
        id: '',
        name: '',
        isActive: false,
        sortOrder: 0,
      ),
    );
    return brand.models;
  }
}
