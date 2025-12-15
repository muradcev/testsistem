import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Uygulama için gerekli tüm izinleri yöneten servis
class PermissionService {
  static const String _permissionsRequestedKey = 'permissions_requested_v2';

  /// Gerekli tüm izinler
  static final List<PermissionInfo> requiredPermissions = [
    PermissionInfo(
      permission: Permission.location,
      name: 'Konum',
      description: 'Seferlerinizi takip etmek ve ev/iş konumlarınızı belirlemek için',
      icon: 'location_on',
      isRequired: true,
    ),
    PermissionInfo(
      permission: Permission.locationAlways,
      name: 'Arka Plan Konumu',
      description: 'Uygulama kapalıyken de konum takibi için',
      icon: 'my_location',
      isRequired: true,
    ),
    PermissionInfo(
      permission: Permission.notification,
      name: 'Bildirimler',
      description: 'Önemli güncellemeler ve anketler için bildirim almak için',
      icon: 'notifications',
      isRequired: true,
    ),
    PermissionInfo(
      permission: Permission.phone,
      name: 'Telefon / Arama Geçmişi',
      description: 'Yük sahipleriyle iletişim takibi için',
      icon: 'phone',
      isRequired: false,
    ),
    PermissionInfo(
      permission: Permission.contacts,
      name: 'Kişiler / Rehber',
      description: 'İletişim kurduğunuz kişileri tanımak için',
      icon: 'contacts',
      isRequired: false,
    ),
    PermissionInfo(
      permission: Permission.sensors,
      name: 'Vücut Sensörleri',
      description: 'Hareket algılama ve aktivite takibi için',
      icon: 'sensors',
      isRequired: false,
    ),
  ];

  /// İzinlerin daha önce istenip istenmediğini kontrol et
  static Future<bool> hasRequestedPermissions() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_permissionsRequestedKey) ?? false;
  }

  /// İzinlerin istendiğini kaydet
  static Future<void> markPermissionsRequested() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_permissionsRequestedKey, true);
  }

  /// Tüm izinlerin durumunu kontrol et
  static Future<Map<Permission, PermissionStatus>> checkAllPermissions() async {
    final results = <Permission, PermissionStatus>{};

    for (final info in requiredPermissions) {
      results[info.permission] = await info.permission.status;
    }

    return results;
  }

  /// Tek bir izni iste
  static Future<PermissionStatus> requestPermission(Permission permission) async {
    debugPrint('Requesting permission: ${permission.toString()}');

    // Önce mevcut durumu kontrol et
    var currentStatus = await permission.status;
    debugPrint('Current status for ${permission.toString()}: $currentStatus');

    // Zaten verilmişse tekrar isteme
    if (currentStatus.isGranted) {
      debugPrint('Permission already granted: ${permission.toString()}');
      return currentStatus;
    }

    // Kalıcı olarak reddedilmişse ayarlara yönlendir
    if (currentStatus.isPermanentlyDenied) {
      debugPrint('Permission permanently denied: ${permission.toString()}');
      return currentStatus;
    }

    // Konum izinleri için özel işlem
    if (permission == Permission.location || permission == Permission.locationAlways) {
      return await _requestLocationPermission(permission);
    }

    // Diğer izinler için direkt iste
    try {
      final status = await permission.request();
      debugPrint('Permission ${permission.toString()} result: $status');
      return status;
    } catch (e) {
      debugPrint('Error requesting ${permission.toString()}: $e');
      return PermissionStatus.denied;
    }
  }

  /// Konum izinleri için özel işlem
  static Future<PermissionStatus> _requestLocationPermission(Permission permission) async {
    // Önce Geolocator ile konum servislerini kontrol et
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('Location services are disabled');
      // Servis kapalıysa normal izin iste, sistem açması için yönlendirecek
    }

    // Önce temel konum izni
    LocationPermission geoPermission = await Geolocator.checkPermission();

    if (geoPermission == LocationPermission.denied) {
      geoPermission = await Geolocator.requestPermission();
    }

    // Arka plan konum izni istendi mi?
    if (permission == Permission.locationAlways && geoPermission == LocationPermission.whileInUse) {
      // Always izni iste
      final alwaysStatus = await Permission.locationAlways.request();
      debugPrint('Location Always permission: $alwaysStatus');
      return alwaysStatus;
    }

    // Normal permission_handler ile sonucu al
    final status = await permission.status;
    debugPrint('Location permission: $status');
    return status;
  }

  /// Tüm izinleri sırayla iste
  static Future<Map<Permission, PermissionStatus>> requestAllPermissions() async {
    final results = <Permission, PermissionStatus>{};

    for (final info in requiredPermissions) {
      try {
        // Önce mevcut durumu kontrol et
        var status = await info.permission.status;

        // Henüz izin verilmediyse iste
        if (status.isDenied || status.isRestricted) {
          status = await requestPermission(info.permission);
        }

        results[info.permission] = status;
        debugPrint('${info.name}: $status');

        // Kısa bir bekleme (UI güncellemesi için)
        await Future.delayed(const Duration(milliseconds: 300));
      } catch (e) {
        debugPrint('Error requesting ${info.name}: $e');
        results[info.permission] = PermissionStatus.denied;
      }
    }

    // İzinlerin istendiğini kaydet
    await markPermissionsRequested();

    return results;
  }

  /// Kritik izinlerin verilip verilmediğini kontrol et
  static Future<bool> hasCriticalPermissions() async {
    final locationStatus = await Permission.location.status;
    final notificationStatus = await Permission.notification.status;

    return locationStatus.isGranted && notificationStatus.isGranted;
  }

  /// İzin durumu özeti
  static Future<PermissionSummary> getPermissionSummary() async {
    final statuses = await checkAllPermissions();

    int granted = 0;
    int denied = 0;
    int permanentlyDenied = 0;

    for (final status in statuses.values) {
      if (status.isGranted) {
        granted++;
      } else if (status.isPermanentlyDenied) {
        permanentlyDenied++;
      } else {
        denied++;
      }
    }

    return PermissionSummary(
      total: statuses.length,
      granted: granted,
      denied: denied,
      permanentlyDenied: permanentlyDenied,
    );
  }

  /// Kalıcı olarak reddedilen izinler için ayarlara yönlendir
  static Future<bool> openAppSettings() async {
    return await openAppSettings();
  }
}

/// İzin bilgisi
class PermissionInfo {
  final Permission permission;
  final String name;
  final String description;
  final String icon;
  final bool isRequired;

  PermissionInfo({
    required this.permission,
    required this.name,
    required this.description,
    required this.icon,
    required this.isRequired,
  });
}

/// İzin durumu özeti
class PermissionSummary {
  final int total;
  final int granted;
  final int denied;
  final int permanentlyDenied;

  PermissionSummary({
    required this.total,
    required this.granted,
    required this.denied,
    required this.permanentlyDenied,
  });

  bool get allGranted => granted == total;
  bool get hasPermDenied => permanentlyDenied > 0;
  double get grantedPercentage => total > 0 ? granted / total : 0;
}
