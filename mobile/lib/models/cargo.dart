// Yük Tipi
class CargoType {
  final String id;
  final String name;
  final String description;
  final String icon;
  final bool isActive;
  final int sortOrder;

  CargoType({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.isActive,
    required this.sortOrder,
  });

  factory CargoType.fromJson(Map<String, dynamic> json) {
    return CargoType(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      icon: json['icon'] ?? '',
      isActive: json['is_active'] ?? true,
      sortOrder: json['sort_order'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'icon': icon,
        'is_active': isActive,
        'sort_order': sortOrder,
      };
}

// Araç Markası
class VehicleBrand {
  final String id;
  final String name;
  final bool isActive;
  final int sortOrder;
  final List<VehicleModel> models;

  VehicleBrand({
    required this.id,
    required this.name,
    required this.isActive,
    required this.sortOrder,
    this.models = const [],
  });

  factory VehicleBrand.fromJson(Map<String, dynamic> json) {
    return VehicleBrand(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      isActive: json['is_active'] ?? true,
      sortOrder: json['sort_order'] ?? 0,
      models: (json['models'] as List<dynamic>?)
              ?.map((m) => VehicleModel.fromJson(m))
              .toList() ??
          [],
    );
  }
}

// Araç Modeli
class VehicleModel {
  final String id;
  final String brandId;
  final String name;
  final bool isActive;

  VehicleModel({
    required this.id,
    required this.brandId,
    required this.name,
    required this.isActive,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id'] ?? '',
      brandId: json['brand_id'] ?? '',
      name: json['name'] ?? '',
      isActive: json['is_active'] ?? true,
    );
  }
}

// Dorse Tipi
class TrailerType {
  final String id;
  final String name;
  final String description;
  final bool isActive;
  final int sortOrder;

  TrailerType({
    required this.id,
    required this.name,
    required this.description,
    required this.isActive,
    required this.sortOrder,
  });

  factory TrailerType.fromJson(Map<String, dynamic> json) {
    return TrailerType(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      isActive: json['is_active'] ?? true,
      sortOrder: json['sort_order'] ?? 0,
    );
  }
}

// Mobil Uygulama Konfigürasyonu
class MobileConfig {
  // Konum güncelleme ayarları
  final int locationUpdateIntervalMoving;
  final int locationUpdateIntervalStationary;
  final int minimumDisplacementMeters;
  final int fastMovingThresholdKmh;
  final int fastMovingIntervalSeconds;

  // Pil optimizasyonu
  final bool batteryOptimizationEnabled;
  final String locationAccuracyMode; // high, balanced, low_power
  final int lowBatteryThreshold;
  final int lowBatteryIntervalSeconds;

  // Offline mod
  final bool offlineModeEnabled;
  final int maxOfflineLocations;
  final int offlineSyncIntervalMinutes;
  final bool syncOnWifiOnly;
  final int maxOfflineDataSizeMB;

  // Aktivite algılama
  final bool activityRecognitionEnabled;
  final bool stopDetectionEnabled;
  final int stopDetectionRadiusMeters;
  final int stopDetectionMinMinutes;

  // Genel
  final int heartbeatIntervalMinutes;
  final int dataRetentionDays;
  final String minAppVersion;
  final bool forceUpdateEnabled;

  MobileConfig({
    this.locationUpdateIntervalMoving = 30,
    this.locationUpdateIntervalStationary = 300,
    this.minimumDisplacementMeters = 50,
    this.fastMovingThresholdKmh = 80,
    this.fastMovingIntervalSeconds = 15,
    this.batteryOptimizationEnabled = true,
    this.locationAccuracyMode = 'balanced',
    this.lowBatteryThreshold = 20,
    this.lowBatteryIntervalSeconds = 600,
    this.offlineModeEnabled = true,
    this.maxOfflineLocations = 500,
    this.offlineSyncIntervalMinutes = 5,
    this.syncOnWifiOnly = false,
    this.maxOfflineDataSizeMB = 50,
    this.activityRecognitionEnabled = true,
    this.stopDetectionEnabled = true,
    this.stopDetectionRadiusMeters = 100,
    this.stopDetectionMinMinutes = 10,
    this.heartbeatIntervalMinutes = 15,
    this.dataRetentionDays = 90,
    this.minAppVersion = '1.0.0',
    this.forceUpdateEnabled = false,
  });

  factory MobileConfig.fromJson(Map<String, dynamic> json) {
    return MobileConfig(
      locationUpdateIntervalMoving: json['location_update_interval_moving'] ?? 30,
      locationUpdateIntervalStationary: json['location_update_interval_stationary'] ?? 300,
      minimumDisplacementMeters: json['minimum_displacement_meters'] ?? 50,
      fastMovingThresholdKmh: json['fast_moving_threshold_kmh'] ?? 80,
      fastMovingIntervalSeconds: json['fast_moving_interval_seconds'] ?? 15,
      batteryOptimizationEnabled: json['battery_optimization_enabled'] ?? true,
      locationAccuracyMode: json['location_accuracy_mode'] ?? 'balanced',
      lowBatteryThreshold: json['low_battery_threshold'] ?? 20,
      lowBatteryIntervalSeconds: json['low_battery_interval_seconds'] ?? 600,
      offlineModeEnabled: json['offline_mode_enabled'] ?? true,
      maxOfflineLocations: json['max_offline_locations'] ?? 500,
      offlineSyncIntervalMinutes: json['offline_sync_interval_minutes'] ?? 5,
      syncOnWifiOnly: json['sync_on_wifi_only'] ?? false,
      maxOfflineDataSizeMB: json['max_offline_data_size_mb'] ?? 50,
      activityRecognitionEnabled: json['activity_recognition_enabled'] ?? true,
      stopDetectionEnabled: json['stop_detection_enabled'] ?? true,
      stopDetectionRadiusMeters: json['stop_detection_radius_meters'] ?? 100,
      stopDetectionMinMinutes: json['stop_detection_min_minutes'] ?? 10,
      heartbeatIntervalMinutes: json['heartbeat_interval_minutes'] ?? 15,
      dataRetentionDays: json['data_retention_days'] ?? 90,
      minAppVersion: json['min_app_version'] ?? '1.0.0',
      forceUpdateEnabled: json['force_update_enabled'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'location_update_interval_moving': locationUpdateIntervalMoving,
    'location_update_interval_stationary': locationUpdateIntervalStationary,
    'minimum_displacement_meters': minimumDisplacementMeters,
    'fast_moving_threshold_kmh': fastMovingThresholdKmh,
    'fast_moving_interval_seconds': fastMovingIntervalSeconds,
    'battery_optimization_enabled': batteryOptimizationEnabled,
    'location_accuracy_mode': locationAccuracyMode,
    'low_battery_threshold': lowBatteryThreshold,
    'low_battery_interval_seconds': lowBatteryIntervalSeconds,
    'offline_mode_enabled': offlineModeEnabled,
    'max_offline_locations': maxOfflineLocations,
    'offline_sync_interval_minutes': offlineSyncIntervalMinutes,
    'sync_on_wifi_only': syncOnWifiOnly,
    'max_offline_data_size_mb': maxOfflineDataSizeMB,
    'activity_recognition_enabled': activityRecognitionEnabled,
    'stop_detection_enabled': stopDetectionEnabled,
    'stop_detection_radius_meters': stopDetectionRadiusMeters,
    'stop_detection_min_minutes': stopDetectionMinMinutes,
    'heartbeat_interval_minutes': heartbeatIntervalMinutes,
    'data_retention_days': dataRetentionDays,
    'min_app_version': minAppVersion,
    'force_update_enabled': forceUpdateEnabled,
  };
}

// Uygulama Konfigürasyonu
class AppConfig {
  final List<CargoType> cargoTypes;
  final List<VehicleBrand> vehicleBrands;
  final List<TrailerType> trailerTypes;
  final MobileConfig mobileConfig;
  final Map<String, String> settings;

  AppConfig({
    this.cargoTypes = const [],
    this.vehicleBrands = const [],
    this.trailerTypes = const [],
    MobileConfig? mobileConfig,
    this.settings = const {},
  }) : mobileConfig = mobileConfig ?? MobileConfig();

  factory AppConfig.fromJson(Map<String, dynamic> json) {
    return AppConfig(
      cargoTypes: (json['cargo_types'] as List<dynamic>?)
              ?.map((c) => CargoType.fromJson(c))
              .toList() ??
          [],
      vehicleBrands: (json['vehicle_brands'] as List<dynamic>?)
              ?.map((b) => VehicleBrand.fromJson(b))
              .toList() ??
          [],
      trailerTypes: (json['trailer_types'] as List<dynamic>?)
              ?.map((t) => TrailerType.fromJson(t))
              .toList() ??
          [],
      mobileConfig: json['mobile_config'] != null
          ? MobileConfig.fromJson(json['mobile_config'])
          : MobileConfig(),
      settings: Map<String, String>.from(json['settings'] ?? {}),
    );
  }
}

// Sefer Yük Bilgisi
class TripCargo {
  final String? tripId;
  final String? cargoTypeId;
  final String? cargoTypeOther;
  final double? weightTons;
  final bool isFullLoad;
  final int? loadPercentage;
  final String? description;

  TripCargo({
    this.tripId,
    this.cargoTypeId,
    this.cargoTypeOther,
    this.weightTons,
    this.isFullLoad = true,
    this.loadPercentage,
    this.description,
  });

  Map<String, dynamic> toJson() => {
        'trip_id': tripId,
        'cargo_type_id': cargoTypeId,
        'cargo_type_other': cargoTypeOther,
        'weight_tons': weightTons,
        'is_full_load': isFullLoad,
        'load_percentage': loadPercentage,
        'description': description,
      };
}

// Sefer Fiyat Bilgisi
class TripPricing {
  final String? tripId;
  final double totalPrice;
  final String currency;
  final double? pricePerKm;
  final String priceType; // fixed, per_km, per_ton
  final double? fuelCost;
  final double? tollCost;
  final double? otherCosts;
  final String? paidBy; // sender, receiver, broker
  final String paymentStatus; // pending, partial, paid
  final double? latitude;
  final double? longitude;

  TripPricing({
    this.tripId,
    required this.totalPrice,
    this.currency = 'TRY',
    this.pricePerKm,
    this.priceType = 'fixed',
    this.fuelCost,
    this.tollCost,
    this.otherCosts,
    this.paidBy,
    this.paymentStatus = 'pending',
    this.latitude,
    this.longitude,
  });

  Map<String, dynamic> toJson() => {
        'trip_id': tripId,
        'total_price': totalPrice,
        'currency': currency,
        'price_per_km': pricePerKm,
        'price_type': priceType,
        'fuel_cost': fuelCost,
        'toll_cost': tollCost,
        'other_costs': otherCosts,
        'paid_by': paidBy,
        'payment_status': paymentStatus,
        'latitude': latitude,
        'longitude': longitude,
      };
}

// Fiyat Anketi
class PriceSurvey {
  final String? tripId;
  final String fromProvince;
  final String? fromDistrict;
  final String toProvince;
  final String? toDistrict;
  final double price;
  final String currency;
  final String? cargoTypeId;
  final double? weightTons;
  final String? notes;
  final String? tripDate;

  PriceSurvey({
    this.tripId,
    required this.fromProvince,
    this.fromDistrict,
    required this.toProvince,
    this.toDistrict,
    required this.price,
    this.currency = 'TRY',
    this.cargoTypeId,
    this.weightTons,
    this.notes,
    this.tripDate,
  });

  Map<String, dynamic> toJson() => {
        'trip_id': tripId,
        'from_province': fromProvince,
        'from_district': fromDistrict,
        'to_province': toProvince,
        'to_district': toDistrict,
        'price': price,
        'currency': currency,
        'cargo_type_id': cargoTypeId,
        'weight_tons': weightTons,
        'notes': notes,
        'trip_date': tripDate,
      };
}
