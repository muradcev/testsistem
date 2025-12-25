import 'dart:io';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_background_service/flutter_background_service.dart';

import 'battery_optimization_service.dart';
import '../config/constants.dart';

/// Sistem sağlık durumu kontrol servisi
/// Tüm kritik izinleri ve servisleri tek bir yerden kontrol eder
class SystemHealthService {
  /// Tam sistem sağlık raporu al
  static Future<SystemHealthReport> getHealthReport() async {
    final prefs = await SharedPreferences.getInstance();

    // Paralel olarak tüm kontrolleri yap
    final results = await Future.wait([
      _checkLocationPermission(),
      _checkBackgroundLocationPermission(),
      _checkBatteryOptimization(),
      _checkForegroundService(),
      _checkGpsEnabled(),
      _getLastLocationTime(prefs),
      _getManufacturerInfo(),
      _checkNotificationPermission(),
    ]);

    return SystemHealthReport(
      locationPermission: results[0] as PermissionState,
      backgroundLocationPermission: results[1] as PermissionState,
      batteryOptimization: results[2] as BatteryOptimizationState,
      foregroundServiceRunning: results[3] as bool,
      gpsEnabled: results[4] as bool,
      lastLocationTime: results[5] as DateTime?,
      manufacturerInfo: results[6] as ManufacturerInfo,
      notificationPermission: results[7] as PermissionState,
    );
  }

  /// Konum izni kontrolü
  static Future<PermissionState> _checkLocationPermission() async {
    try {
      final status = await Permission.location.status;
      return _mapPermissionStatus(status);
    } catch (e) {
      debugPrint('[SystemHealth] Location permission check error: $e');
      return PermissionState.unknown;
    }
  }

  /// Arka plan konum izni kontrolü
  static Future<PermissionState> _checkBackgroundLocationPermission() async {
    try {
      final status = await Permission.locationAlways.status;
      return _mapPermissionStatus(status);
    } catch (e) {
      debugPrint('[SystemHealth] Background location permission check error: $e');
      return PermissionState.unknown;
    }
  }

  /// Bildirim izni kontrolü
  static Future<PermissionState> _checkNotificationPermission() async {
    try {
      final status = await Permission.notification.status;
      return _mapPermissionStatus(status);
    } catch (e) {
      debugPrint('[SystemHealth] Notification permission check error: $e');
      return PermissionState.unknown;
    }
  }

  /// PermissionStatus'u PermissionState'e çevir
  static PermissionState _mapPermissionStatus(PermissionStatus status) {
    if (status.isGranted) return PermissionState.granted;
    if (status.isPermanentlyDenied) return PermissionState.permanentlyDenied;
    if (status.isDenied) return PermissionState.denied;
    if (status.isRestricted) return PermissionState.restricted;
    if (status.isLimited) return PermissionState.limited;
    return PermissionState.unknown;
  }

  /// Pil optimizasyonu kontrolü
  static Future<BatteryOptimizationState> _checkBatteryOptimization() async {
    if (!Platform.isAndroid) {
      return BatteryOptimizationState.notApplicable;
    }

    try {
      final isIgnoring = await BatteryOptimizationService.isIgnoringBatteryOptimizations();
      return isIgnoring
          ? BatteryOptimizationState.disabled
          : BatteryOptimizationState.enabled;
    } catch (e) {
      debugPrint('[SystemHealth] Battery optimization check error: $e');
      return BatteryOptimizationState.unknown;
    }
  }

  /// Foreground service kontrolü
  static Future<bool> _checkForegroundService() async {
    try {
      final service = FlutterBackgroundService();
      return await service.isRunning();
    } catch (e) {
      debugPrint('[SystemHealth] Foreground service check error: $e');
      return false;
    }
  }

  /// GPS açık mı kontrolü
  static Future<bool> _checkGpsEnabled() async {
    try {
      return await Geolocator.isLocationServiceEnabled();
    } catch (e) {
      debugPrint('[SystemHealth] GPS check error: $e');
      return false;
    }
  }

  /// Son konum zamanı
  static Future<DateTime?> _getLastLocationTime(SharedPreferences prefs) async {
    try {
      final lastTimeStr = prefs.getString(StorageKeys.lastLocationTime);
      if (lastTimeStr != null) {
        return DateTime.tryParse(lastTimeStr);
      }
      return null;
    } catch (e) {
      debugPrint('[SystemHealth] Last location time error: $e');
      return null;
    }
  }

  /// Üretici bilgisi
  static Future<ManufacturerInfo> _getManufacturerInfo() async {
    if (!Platform.isAndroid) {
      return ManufacturerInfo(
        manufacturer: 'Apple',
        model: 'iPhone',
        needsSpecialSettings: false,
        settingsConfigured: true,
      );
    }

    try {
      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo;
      final manufacturer = androidInfo.manufacturer.toLowerCase();
      final model = androidInfo.model;

      // MIUI/Xiaomi, Huawei, Oppo vb. özel ayar gerektiren üreticiler
      final needsSpecialSettings = [
        'xiaomi', 'redmi', 'poco', 'huawei', 'honor',
        'oppo', 'realme', 'vivo', 'oneplus', 'asus'
      ].contains(manufacturer);

      // Ayarların yapılıp yapılmadığını kontrol et
      final prefs = await SharedPreferences.getInstance();
      final settingsShownCount = prefs.getInt('manufacturer_settings_shown_count') ?? 0;
      // Kullanıcı 3 kez gösterimi tamamladıysa veya "gösterme" dediyse yapıldı say
      final settingsConfigured = settingsShownCount >= 3;

      return ManufacturerInfo(
        manufacturer: androidInfo.manufacturer,
        model: model,
        androidVersion: 'Android ${androidInfo.version.release}',
        needsSpecialSettings: needsSpecialSettings,
        settingsConfigured: settingsConfigured,
      );
    } catch (e) {
      debugPrint('[SystemHealth] Manufacturer info error: $e');
      return ManufacturerInfo(
        manufacturer: 'Unknown',
        model: 'Unknown',
        needsSpecialSettings: false,
        settingsConfigured: true,
      );
    }
  }

  /// Genel sağlık skoru (0-100)
  static int calculateHealthScore(SystemHealthReport report) {
    int score = 0;
    int maxScore = 0;

    // Konum izni (25 puan)
    maxScore += 25;
    if (report.locationPermission == PermissionState.granted) score += 25;

    // Arka plan konum izni (25 puan)
    maxScore += 25;
    if (report.backgroundLocationPermission == PermissionState.granted) score += 25;

    // Pil optimizasyonu (20 puan)
    if (Platform.isAndroid) {
      maxScore += 20;
      if (report.batteryOptimization == BatteryOptimizationState.disabled) score += 20;
    }

    // Foreground service (15 puan)
    maxScore += 15;
    if (report.foregroundServiceRunning) score += 15;

    // GPS açık (10 puan)
    maxScore += 10;
    if (report.gpsEnabled) score += 10;

    // Son konum zamanı (5 puan) - 30 dakikadan yeniyse
    maxScore += 5;
    if (report.lastLocationTime != null) {
      final diff = DateTime.now().difference(report.lastLocationTime!);
      if (diff.inMinutes <= 30) score += 5;
    }

    return maxScore > 0 ? ((score / maxScore) * 100).round() : 0;
  }

  /// Kritik sorunlar listesi
  static List<HealthIssue> getIssues(SystemHealthReport report) {
    final issues = <HealthIssue>[];

    // GPS kapalı
    if (!report.gpsEnabled) {
      issues.add(HealthIssue(
        severity: IssueSeverity.critical,
        title: 'GPS Kapalı',
        description: 'Konum servisleri kapalı. Konum takibi yapılamaz.',
        action: 'GPS\'i Aç',
        actionType: HealthActionType.openLocationSettings,
      ));
    }

    // Konum izni yok
    if (report.locationPermission != PermissionState.granted) {
      issues.add(HealthIssue(
        severity: IssueSeverity.critical,
        title: 'Konum İzni Yok',
        description: 'Uygulama konum bilgisine erişemiyor.',
        action: 'İzin Ver',
        actionType: HealthActionType.requestLocationPermission,
      ));
    }

    // Arka plan konum izni yok
    if (report.backgroundLocationPermission != PermissionState.granted) {
      issues.add(HealthIssue(
        severity: IssueSeverity.critical,
        title: 'Arka Plan Konum İzni Yok',
        description: 'Uygulama kapalıyken konum takibi yapılamaz.',
        action: 'İzin Ver',
        actionType: HealthActionType.requestBackgroundLocationPermission,
      ));
    }

    // Pil optimizasyonu açık (Android)
    if (Platform.isAndroid &&
        report.batteryOptimization == BatteryOptimizationState.enabled) {
      issues.add(HealthIssue(
        severity: IssueSeverity.warning,
        title: 'Pil Optimizasyonu Açık',
        description: 'Android arka plan servislerini durdurabilir.',
        action: 'Devre Dışı Bırak',
        actionType: HealthActionType.disableBatteryOptimization,
      ));
    }

    // Foreground service çalışmıyor
    if (!report.foregroundServiceRunning) {
      issues.add(HealthIssue(
        severity: IssueSeverity.warning,
        title: 'Konum Servisi Durmuş',
        description: 'Arka plan konum takibi şu an aktif değil.',
        action: 'Yeniden Başlat',
        actionType: HealthActionType.restartService,
      ));
    }

    // Üretici özel ayarları
    if (report.manufacturerInfo.needsSpecialSettings &&
        !report.manufacturerInfo.settingsConfigured) {
      issues.add(HealthIssue(
        severity: IssueSeverity.warning,
        title: '${report.manufacturerInfo.manufacturer} Ayarları',
        description: 'Cihazınız ek pil ayarları gerektirebilir.',
        action: 'Ayarları Gör',
        actionType: HealthActionType.showManufacturerSettings,
      ));
    }

    // Son konum çok eski
    if (report.lastLocationTime != null) {
      final diff = DateTime.now().difference(report.lastLocationTime!);
      if (diff.inHours >= 1) {
        issues.add(HealthIssue(
          severity: IssueSeverity.warning,
          title: 'Konum Güncel Değil',
          description: 'Son konum ${_formatDuration(diff)} önce alındı.',
          action: 'Konum Gönder',
          actionType: HealthActionType.sendLocation,
        ));
      }
    } else {
      issues.add(HealthIssue(
        severity: IssueSeverity.info,
        title: 'Henüz Konum Yok',
        description: 'Konum takibi başlayınca veriler görünecek.',
        action: null,
        actionType: null,
      ));
    }

    return issues;
  }

  static String _formatDuration(Duration diff) {
    if (diff.inDays > 0) return '${diff.inDays} gün';
    if (diff.inHours > 0) return '${diff.inHours} saat';
    if (diff.inMinutes > 0) return '${diff.inMinutes} dakika';
    return 'az önce';
  }
}

/// İzin durumu
enum PermissionState {
  granted,
  denied,
  permanentlyDenied,
  restricted,
  limited,
  unknown,
}

/// Pil optimizasyonu durumu
enum BatteryOptimizationState {
  enabled,    // Açık - sorunlu
  disabled,   // Kapalı - iyi
  notApplicable, // iOS
  unknown,
}

/// Sorun şiddeti
enum IssueSeverity {
  critical,  // Kırmızı - acil
  warning,   // Turuncu - önemli
  info,      // Mavi - bilgi
}

/// Aksiyon tipi
enum HealthActionType {
  openLocationSettings,
  requestLocationPermission,
  requestBackgroundLocationPermission,
  disableBatteryOptimization,
  restartService,
  showManufacturerSettings,
  sendLocation,
}

/// Sistem sağlık raporu
class SystemHealthReport {
  final PermissionState locationPermission;
  final PermissionState backgroundLocationPermission;
  final PermissionState notificationPermission;
  final BatteryOptimizationState batteryOptimization;
  final bool foregroundServiceRunning;
  final bool gpsEnabled;
  final DateTime? lastLocationTime;
  final ManufacturerInfo manufacturerInfo;

  SystemHealthReport({
    required this.locationPermission,
    required this.backgroundLocationPermission,
    required this.notificationPermission,
    required this.batteryOptimization,
    required this.foregroundServiceRunning,
    required this.gpsEnabled,
    required this.lastLocationTime,
    required this.manufacturerInfo,
  });

  /// Tüm kritik izinler tamam mı?
  bool get allCriticalPermissionsGranted =>
      locationPermission == PermissionState.granted &&
      backgroundLocationPermission == PermissionState.granted;

  /// Sistem sağlıklı mı?
  bool get isHealthy =>
      allCriticalPermissionsGranted &&
      gpsEnabled &&
      foregroundServiceRunning &&
      (batteryOptimization == BatteryOptimizationState.disabled ||
       batteryOptimization == BatteryOptimizationState.notApplicable);
}

/// Üretici bilgisi
class ManufacturerInfo {
  final String manufacturer;
  final String model;
  final String? androidVersion;
  final bool needsSpecialSettings;
  final bool settingsConfigured;

  ManufacturerInfo({
    required this.manufacturer,
    required this.model,
    this.androidVersion,
    required this.needsSpecialSettings,
    required this.settingsConfigured,
  });
}

/// Sağlık sorunu
class HealthIssue {
  final IssueSeverity severity;
  final String title;
  final String description;
  final String? action;
  final HealthActionType? actionType;

  HealthIssue({
    required this.severity,
    required this.title,
    required this.description,
    this.action,
    this.actionType,
  });
}
