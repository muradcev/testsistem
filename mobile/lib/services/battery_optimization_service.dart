import 'dart:io';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pil optimizasyonu yönetim servisi
/// Android'in uygulamayı arka planda öldürmesini engellemek için
/// pil optimizasyonunu devre dışı bırakma isteği gönderir
class BatteryOptimizationService {
  static const String _prefKeyDismissed = 'battery_optimization_dismissed';
  static const String _prefKeyDismissCount = 'battery_optimization_dismiss_count';

  /// Pil optimizasyonu devre dışı mı kontrol et
  static Future<bool> isIgnoringBatteryOptimizations() async {
    if (!Platform.isAndroid) return true;

    final status = await Permission.ignoreBatteryOptimizations.status;
    return status.isGranted;
  }

  /// Pil optimizasyonunu devre dışı bırakma isteği gönder
  static Future<bool> requestDisableBatteryOptimization() async {
    if (!Platform.isAndroid) return true;

    try {
      final status = await Permission.ignoreBatteryOptimizations.request();
      debugPrint('[Battery] Optimization request result: $status');
      return status.isGranted;
    } catch (e) {
      debugPrint('[Battery] Error requesting optimization: $e');
      return false;
    }
  }

  /// Kullanıcı daha önce bu isteği reddetti mi?
  static Future<bool> wasOptimizationDismissed() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_prefKeyDismissed) ?? false;
  }

  /// Kullanıcı kaç kez reddetti?
  static Future<int> getDismissCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_prefKeyDismissCount) ?? 0;
  }

  /// Reddetme sayısını artır
  static Future<void> incrementDismissCount() async {
    final prefs = await SharedPreferences.getInstance();
    final count = await getDismissCount();
    await prefs.setInt(_prefKeyDismissCount, count + 1);
    await prefs.setBool(_prefKeyDismissed, true);
  }

  /// Kullanıcıya pil optimizasyonu dialog'u göster
  /// Uygulama ilk açılışta veya login sonrasında çağrılmalı
  static Future<void> checkAndRequestOptimization(BuildContext context) async {
    if (!Platform.isAndroid) return;

    // Zaten devre dışıysa bir şey yapma
    final isIgnoring = await isIgnoringBatteryOptimizations();
    if (isIgnoring) {
      debugPrint('[Battery] Already ignoring battery optimizations');
      return;
    }

    // Kullanıcı 3 kereden fazla reddettiyse artık sorma
    final dismissCount = await getDismissCount();
    if (dismissCount >= 3) {
      debugPrint('[Battery] User dismissed $dismissCount times, not asking again');
      return;
    }

    // Dialog göster
    if (context.mounted) {
      await _showOptimizationDialog(context);
    }
  }

  /// Pil optimizasyonu dialog'u
  static Future<void> _showOptimizationDialog(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.battery_alert, color: Colors.orange[700], size: 28),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Pil Optimizasyonu',
                style: TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Konum takibinin düzgün çalışması için pil optimizasyonunu devre dışı bırakmanız gerekiyor.',
              style: TextStyle(fontSize: 15),
            ),
            SizedBox(height: 16),
            Text(
              'Bu ayar olmadan Android uygulamayı arka planda kapatabilir ve konum bilgileri gönderilemez.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Daha Sonra'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange[700],
              foregroundColor: Colors.white,
            ),
            child: const Text('Devre Dışı Bırak'),
          ),
        ],
      ),
    );

    if (result == true) {
      final granted = await requestDisableBatteryOptimization();
      if (granted) {
        debugPrint('[Battery] User granted battery optimization exemption');
      } else {
        debugPrint('[Battery] User denied battery optimization exemption');
        await incrementDismissCount();
      }
    } else {
      debugPrint('[Battery] User dismissed battery optimization dialog');
      await incrementDismissCount();
    }
  }

  /// Ayarlar sayfasından manuel olarak açmak için
  static Future<void> openBatteryOptimizationSettings() async {
    if (!Platform.isAndroid) return;

    try {
      await openAppSettings();
    } catch (e) {
      debugPrint('[Battery] Error opening settings: $e');
    }
  }

  /// Pil optimizasyonu durumunu string olarak döndür
  static Future<String> getStatusText() async {
    if (!Platform.isAndroid) return 'iOS';

    final isIgnoring = await isIgnoringBatteryOptimizations();
    return isIgnoring ? 'Devre Dışı' : 'Aktif (Sorunlu)';
  }
}
