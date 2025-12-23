import 'dart:io';
import 'package:flutter/material.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:android_intent_plus/android_intent.dart';
import 'package:android_intent_plus/flag.dart';

/// Bildirim gizleme kurulum servisi
/// Kullanıcının foreground service bildirimini gizleyebilmesi için
/// üretici bazlı rehber gösterir
class NotificationSetupService {
  static const String _setupCompletedKey = 'notification_setup_completed';
  static const String _setupSkippedKey = 'notification_setup_skipped';

  /// Kurulum tamamlandı mı?
  static Future<bool> isSetupCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_setupCompletedKey) ?? false;
  }

  /// Kurulum atlandı mı?
  static Future<bool> isSetupSkipped() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_setupSkippedKey) ?? false;
  }

  /// Kurulumu tamamlandı olarak işaretle
  static Future<void> markSetupCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_setupCompletedKey, true);
  }

  /// Kurulumu atlandı olarak işaretle
  static Future<void> markSetupSkipped() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_setupSkippedKey, true);
  }

  /// Kurulum gösterilmeli mi?
  static Future<bool> shouldShowSetup() async {
    if (!Platform.isAndroid) return false;

    final completed = await isSetupCompleted();
    final skipped = await isSetupSkipped();

    // Zaten tamamlandıysa veya atlandıysa gösterme
    if (completed || skipped) return false;

    return true;
  }

  /// Cihaz üreticisini al
  static Future<String> getManufacturer() async {
    if (!Platform.isAndroid) return 'other';

    try {
      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.manufacturer.toLowerCase();
    } catch (e) {
      debugPrint('[NotificationSetup] Error getting manufacturer: $e');
      return 'other';
    }
  }

  /// Cihaz modelini al
  static Future<String> getModel() async {
    if (!Platform.isAndroid) return '';

    try {
      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.model;
    } catch (e) {
      return '';
    }
  }

  /// Üreticiye göre bildirim gizleme adımlarını al
  static NotificationHideConfig getConfigForManufacturer(String manufacturer) {
    switch (manufacturer) {
      case 'samsung':
        return NotificationHideConfig(
          name: 'Samsung',
          steps: [
            'Bildirimi basılı tutun veya sola kaydırın',
            'Ayarlar ikonuna (⚙️) dokunun',
            '"Sessiz" seçeneğini seçin',
            'Veya: "Küçült" seçeneğiyle bildirim küçük ikon olur',
          ],
          alternativeSteps: [
            'Ayarlar > Bildirimler > Uygulama bildirimleri',
            'Nakliyeo > Sefer takibi kanalı > Sessiz',
          ],
        );

      case 'xiaomi':
      case 'redmi':
      case 'poco':
        return NotificationHideConfig(
          name: 'Xiaomi/Redmi',
          steps: [
            'Bildirimi basılı tutun',
            '"Bildirim ayarları" seçeneğine dokunun',
            '"Nakliyeo Location" kanalını bulun',
            'Bildirimi "Sessiz" olarak ayarlayın',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar > Uygulamaları yönet > Nakliyeo',
            'Bildirimler > Sefer takibi > Sessiz',
          ],
        );

      case 'huawei':
      case 'honor':
        return NotificationHideConfig(
          name: 'Huawei/Honor',
          steps: [
            'Bildirimi sola kaydırın',
            'Ayarlar ikonuna (⚙️) dokunun',
            '"Sessiz bildirimler" seçeneğini açın',
            'Bildirim artık durum çubuğunda görünmez',
          ],
          alternativeSteps: [
            'Ayarlar > Bildirim merkezi > Uygulama bildirimleri',
            'Nakliyeo > Konum kanalı > Sessiz',
          ],
        );

      case 'oppo':
      case 'realme':
        return NotificationHideConfig(
          name: 'Oppo/Realme',
          steps: [
            'Bildirimi basılı tutun',
            '"Bildirim ayarları"nı seçin',
            'Sefer takibi kanalını "Sessiz" yapın',
          ],
          alternativeSteps: [
            'Ayarlar > Bildirimler ve durum çubuğu',
            'Bildirim yönetimi > Nakliyeo > Sessiz',
          ],
        );

      case 'vivo':
        return NotificationHideConfig(
          name: 'Vivo',
          steps: [
            'Bildirimi basılı tutun veya sola kaydırın',
            '"Daha fazla ayar" seçeneğine dokunun',
            'Bildirimi "Sessiz" olarak ayarlayın',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar ve izinler > Uygulama yöneticisi',
            'Nakliyeo > Bildirimler > Sessiz',
          ],
        );

      case 'oneplus':
        return NotificationHideConfig(
          name: 'OnePlus',
          steps: [
            'Bildirimi basılı tutun',
            '"Bildirim ayarları"na dokunun',
            '"Sessiz" seçeneğini seçin',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar > Nakliyeo',
            'Bildirimler > Konum kanalı > Sessiz',
          ],
        );

      case 'google':
      case 'nokia':
      case 'motorola':
      case 'sony':
        return NotificationHideConfig(
          name: 'Stock Android',
          steps: [
            'Bildirimi basılı tutun',
            'Açılan menüde "Sessiz" seçin',
            'Bildirim artık ses çıkarmaz ve gizli kalır',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar > Nakliyeo',
            'Bildirimler > Konum > Sessiz',
          ],
        );

      default:
        return NotificationHideConfig(
          name: 'Android',
          steps: [
            'Bildirimi basılı tutun veya sola/sağa kaydırın',
            'Ayarlar ikonuna (⚙️) dokunun',
            '"Sessiz" veya "Küçült" seçeneğini seçin',
            'Bildirim artık dikkat çekmez',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar > Nakliyeo',
            'Bildirimler > İlgili kanalı "Sessiz" yapın',
          ],
        );
    }
  }

  /// Bildirim ayarlarını aç
  static Future<void> openNotificationSettings() async {
    if (!Platform.isAndroid) return;

    try {
      const intent = AndroidIntent(
        action: 'android.settings.APP_NOTIFICATION_SETTINGS',
        arguments: <String, dynamic>{
          'android.provider.extra.APP_PACKAGE': 'com.nakliyeo.nakliyeo_mobil',
        },
        flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
      );
      await intent.launch();
    } catch (e) {
      debugPrint('[NotificationSetup] Error opening notification settings: $e');
      // Fallback to app settings
      try {
        const fallbackIntent = AndroidIntent(
          action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
          data: 'package:com.nakliyeo.nakliyeo_mobil',
          flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
        );
        await fallbackIntent.launch();
      } catch (e2) {
        debugPrint('[NotificationSetup] Fallback also failed: $e2');
      }
    }
  }

  /// Kurulum dialogunu göster
  static Future<void> showSetupDialog(BuildContext context, {bool required = false}) async {
    if (!Platform.isAndroid) return;

    final manufacturer = await getManufacturer();
    final model = await getModel();
    final config = getConfigForManufacturer(manufacturer);

    if (!context.mounted) return;

    await showDialog(
      context: context,
      barrierDismissible: !required,
      builder: (context) => _NotificationSetupDialog(
        config: config,
        model: model,
        required: required,
      ),
    );
  }
}

/// Bildirim gizleme konfigürasyonu
class NotificationHideConfig {
  final String name;
  final List<String> steps;
  final List<String>? alternativeSteps;

  NotificationHideConfig({
    required this.name,
    required this.steps,
    this.alternativeSteps,
  });
}

/// Bildirim kurulum dialog widget'ı
class _NotificationSetupDialog extends StatelessWidget {
  final NotificationHideConfig config;
  final String model;
  final bool required;

  const _NotificationSetupDialog({
    required this.config,
    required this.model,
    this.required = false,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.blue.shade100,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.notifications_off, color: Colors.blue.shade700, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bildirim Ayarı',
                  style: TextStyle(fontSize: 18),
                ),
                Text(
                  '${config.name} - $model',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Sefer sırasında konum takibi için bir bildirim görünecektir. '
                      'Bu bildirimi gizleyebilirsiniz.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.orange.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Bildirimi Gizlemek İçin:',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (int i = 0; i < config.steps.length; i++) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: Colors.blue.shade700,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              '${i + 1}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            config.steps[i],
                            style: const TextStyle(fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                    if (i < config.steps.length - 1) const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
            if (config.alternativeSteps != null) ...[
              const SizedBox(height: 12),
              Text(
                'Alternatif yol:',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade600,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                config.alternativeSteps!.join('\n'),
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
            ],
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle_outline, color: Colors.green.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Bildirim gizlense bile konum takibi çalışmaya devam eder.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.green.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        if (!required)
          TextButton(
            onPressed: () {
              NotificationSetupService.markSetupSkipped();
              Navigator.of(context).pop();
            },
            child: Text(
              'Sonra',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ),
        ElevatedButton.icon(
          onPressed: () async {
            await NotificationSetupService.openNotificationSettings();
          },
          icon: const Icon(Icons.settings, size: 18),
          label: const Text('Ayarlara Git'),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.blue.shade600,
            foregroundColor: Colors.white,
          ),
        ),
        ElevatedButton(
          onPressed: () {
            NotificationSetupService.markSetupCompleted();
            Navigator.of(context).pop();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.green.shade600,
            foregroundColor: Colors.white,
          ),
          child: const Text('Tamamlandı'),
        ),
      ],
    );
  }
}
