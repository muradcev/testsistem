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

  /// Pil optimizasyonu dialog'u - Basitleştirilmiş
  static Future<void> _showOptimizationDialog(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.battery_charging_full, color: Colors.orange.shade600, size: 32),
            ),
            const SizedBox(height: 12),
            const Text(
              'Pil Ayarı Gerekli',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Konum takibinin kesintisiz çalışması için pil tasarrufunu kapatmanız gerekiyor.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Bu izni verdiğinizde uygulama arka planda çalışmaya devam edebilir.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actionsAlignment: MainAxisAlignment.center,
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange.shade600,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text('İzin Ver', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text('Daha Sonra', style: TextStyle(color: Colors.grey.shade600)),
              ),
            ],
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
