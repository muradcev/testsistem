import 'package:flutter/foundation.dart';
import '../models/cargo.dart';
import '../services/api_service.dart';

class ConfigProvider with ChangeNotifier {
  final ApiService _apiService;

  AppConfig _config = AppConfig();
  bool _isLoading = false;
  String? _error;

  ConfigProvider(this._apiService);

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

  Future<void> loadConfig() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.get('/config/app');
      _config = AppConfig.fromJson(response);
      _error = null;
    } catch (e) {
      _error = e.toString();
      debugPrint('Config yüklenemedi: $e');
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
