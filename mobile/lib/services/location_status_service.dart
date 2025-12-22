import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';

/// Konum ve bağlantı durumu izleme servisi
/// - GPS durumunu izler
/// - İnternet bağlantısını izler
class LocationStatusService {
  static StreamSubscription<ServiceStatus>? _serviceStatusSubscription;
  static StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  static bool _isGpsEnabled = true;
  static bool _isOnline = true;
  static Function(bool isGpsEnabled)? _onGpsStatusChanged;
  static Function(bool isOnline)? _onConnectivityChanged;

  /// GPS durumunu başlat
  static Future<void> startMonitoring({
    Function(bool isGpsEnabled)? onGpsStatusChanged,
    Function(bool isOnline)? onConnectivityChanged,
  }) async {
    _onGpsStatusChanged = onGpsStatusChanged;
    _onConnectivityChanged = onConnectivityChanged;

    // İlk GPS durumu
    _isGpsEnabled = await Geolocator.isLocationServiceEnabled();
    _onGpsStatusChanged?.call(_isGpsEnabled);

    // GPS durum değişikliklerini dinle
    _serviceStatusSubscription = Geolocator.getServiceStatusStream().listen((status) {
      _isGpsEnabled = status == ServiceStatus.enabled;
      debugPrint('[LocationStatus] GPS status changed: ${_isGpsEnabled ? "ENABLED" : "DISABLED"}');
      _onGpsStatusChanged?.call(_isGpsEnabled);
    });

    // İlk internet durumu
    final connectivity = Connectivity();
    final connectivityResult = await connectivity.checkConnectivity();
    _isOnline = connectivityResult.isNotEmpty && !connectivityResult.contains(ConnectivityResult.none);
    _onConnectivityChanged?.call(_isOnline);

    // İnternet durum değişikliklerini dinle
    _connectivitySubscription = connectivity.onConnectivityChanged.listen((result) {
      _isOnline = result.isNotEmpty && !result.contains(ConnectivityResult.none);
      debugPrint('[LocationStatus] Connectivity changed: ${_isOnline ? "ONLINE" : "OFFLINE"}');
      _onConnectivityChanged?.call(_isOnline);
    });

    debugPrint('[LocationStatus] Monitoring started - GPS: $_isGpsEnabled, Online: $_isOnline');
  }

  /// İzlemeyi durdur
  static Future<void> stopMonitoring() async {
    await _serviceStatusSubscription?.cancel();
    await _connectivitySubscription?.cancel();
    _serviceStatusSubscription = null;
    _connectivitySubscription = null;
    debugPrint('[LocationStatus] Monitoring stopped');
  }

  /// GPS açık mı?
  static bool get isGpsEnabled => _isGpsEnabled;

  /// İnternet var mı?
  static bool get isOnline => _isOnline;

  /// GPS durumunu kontrol et ve gerekirse uyarı göster
  static Future<void> checkGpsAndShowWarning(BuildContext context) async {
    final isEnabled = await Geolocator.isLocationServiceEnabled();
    if (!isEnabled && context.mounted) {
      showGpsWarningDialog(context);
    }
  }

  /// GPS uyarı dialogu göster
  static void showGpsWarningDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.location_off, color: Colors.red.shade700),
            ),
            const SizedBox(width: 12),
            const Text('Konum Kapalı'),
          ],
        ),
        content: const Text(
          'Konum takibi için GPS\'in açık olması gerekiyor.\n\n'
          'Lütfen cihazınızın konum servislerini açın.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Daha Sonra'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.of(context).pop();
              Geolocator.openLocationSettings();
            },
            icon: const Icon(Icons.settings, size: 18),
            label: const Text('Ayarlara Git'),
          ),
        ],
      ),
    );
  }

  /// Bekleyen konum sayısını al
  static Future<int> getPendingLocationCount() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pendingJson = prefs.getString(StorageKeys.pendingLocations) ?? '[]';
      final List<dynamic> pending = json.decode(pendingJson);
      return pending.length;
    } catch (e) {
      return 0;
    }
  }
}
