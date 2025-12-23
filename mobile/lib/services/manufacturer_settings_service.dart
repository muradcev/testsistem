import 'dart:io';
import 'package:flutter/material.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:android_intent_plus/android_intent.dart';
import 'package:android_intent_plus/flag.dart';

/// Üretici özel pil ve arka plan ayarları yönlendirme servisi
/// Samsung, Xiaomi, Huawei, Oppo vb. cihazlarda WorkManager'ın
/// düzgün çalışması için gerekli ayarları kullanıcıya gösterir
class ManufacturerSettingsService {
  static const String _settingsShownCountKey = 'manufacturer_settings_shown_count';
  static const int _maxShowCount = 3; // Maksimum 3 kez göster

  /// Cihaz üreticisini al
  static Future<String> getManufacturer() async {
    if (!Platform.isAndroid) return 'other';

    try {
      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.manufacturer.toLowerCase();
    } catch (e) {
      debugPrint('[ManufacturerSettings] Error getting manufacturer: $e');
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

  /// Üreticiye göre ayar bilgilerini al
  static ManufacturerConfig getConfigForManufacturer(String manufacturer) {
    switch (manufacturer) {
      case 'samsung':
        return ManufacturerConfig(
          name: 'Samsung',
          icon: Icons.phone_android,
          title: 'Samsung Pil Ayarları',
          description: 'Konum takibinin kesintisiz çalışması için aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Pil ve cihaz bakımı > Pil',
            'Arka plan kullanım sınırları > Hiçbir zaman uyku moduna geçmeyen uygulamalar',
            'Nakliyeo uygulamasını ekleyin',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar > Nakliyeo',
            'Pil > Sınırsız olarak ayarlayın',
          ],
          intentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        );

      case 'xiaomi':
      case 'redmi':
      case 'poco':
        return ManufacturerConfig(
          name: 'Xiaomi/Redmi',
          icon: Icons.phone_android,
          title: 'MIUI Pil Ayarları',
          description: 'MIUI\'nin agresif pil yönetimi nedeniyle aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Uygulamalar > Uygulamaları yönet > Nakliyeo',
            'Otomatik başlatma: AÇIK',
            'Pil tasarrufu: Sınırlama yok',
            'Arka plan ayarları: Sınırlama yok',
          ],
          alternativeSteps: [
            'Güvenlik uygulaması > İzinler > Otomatik başlatma',
            'Nakliyeo için otomatik başlatmayı etkinleştirin',
          ],
          intentAction: 'miui.intent.action.APP_PERM_EDITOR',
          requiresAutoStart: true,
        );

      case 'huawei':
      case 'honor':
        return ManufacturerConfig(
          name: 'Huawei/Honor',
          icon: Icons.phone_android,
          title: 'EMUI Pil Ayarları',
          description: 'Huawei pil yönetimi nedeniyle aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Pil > Uygulama başlatma',
            'Nakliyeo\'yu bulun ve KAPATIN (manuel yönetim)',
            'Açılan pencerede tüm seçenekleri AÇIK yapın:',
            '  - Otomatik başlatma: AÇIK',
            '  - İkincil başlatma: AÇIK',
            '  - Arka planda çalış: AÇIK',
          ],
          alternativeSteps: [
            'Telefon Yöneticisi > Pil > Ayarlar',
            'Korumalı uygulamalar > Nakliyeo\'yu ekleyin',
          ],
          intentAction: 'huawei.intent.action.HSM_BOOTAPP_MANAGER',
          requiresAutoStart: true,
        );

      case 'oppo':
      case 'realme':
        return ManufacturerConfig(
          name: 'Oppo/Realme',
          icon: Icons.phone_android,
          title: 'ColorOS Pil Ayarları',
          description: 'ColorOS pil yönetimi için aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Pil > Daha fazla pil ayarı',
            'Arka plan uygulamalarını optimize et: Nakliyeo\'yu hariç tut',
            'Uyku beklemesinde uygulamaları kapat: Nakliyeo\'yu hariç tut',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulama yönetimi > Nakliyeo',
            'Pil kullanımı > Arka planda çalışmaya izin ver',
            'Otomatik başlatma: AÇIK',
          ],
          intentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
          requiresAutoStart: true,
        );

      case 'vivo':
        return ManufacturerConfig(
          name: 'Vivo',
          icon: Icons.phone_android,
          title: 'Vivo Pil Ayarları',
          description: 'Vivo pil yönetimi için aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Pil > Yüksek arka plan güç tüketimi',
            'Nakliyeo uygulamasını etkinleştirin',
            'Ayarlar > Pil > Arka plan uygulamalarını kapat',
            'Nakliyeo\'yu hariç tutun',
          ],
          alternativeSteps: [
            'i Manager > Uygulama yöneticisi > Otomatik başlatma',
            'Nakliyeo için otomatik başlatmayı etkinleştirin',
          ],
          intentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
          requiresAutoStart: true,
        );

      case 'oneplus':
        return ManufacturerConfig(
          name: 'OnePlus',
          icon: Icons.phone_android,
          title: 'OnePlus Pil Ayarları',
          description: 'OxygenOS pil yönetimi için aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Pil > Pil optimizasyonu',
            'Tüm uygulamalar > Nakliyeo > Optimize etme',
          ],
          alternativeSteps: [
            'Ayarlar > Uygulamalar > Nakliyeo > Pil',
            'Arka plan kısıtlaması: Kısıtlama yok',
          ],
          intentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        );

      case 'asus':
        return ManufacturerConfig(
          name: 'Asus',
          icon: Icons.phone_android,
          title: 'Asus Pil Ayarları',
          description: 'Asus pil yönetimi için aşağıdaki ayarları yapın:',
          steps: [
            'Ayarlar > Güç yönetimi > PowerMaster',
            'Otomatik başlatma yöneticisi > Nakliyeo: AÇIK',
            'Ayarlar > Uygulamalar > Nakliyeo > Pil',
            'Arka plan kısıtlaması: Kısıtlama yok',
          ],
          intentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
          requiresAutoStart: true,
        );

      case 'nokia':
      case 'google':
      case 'motorola':
      case 'sony':
        return ManufacturerConfig(
          name: manufacturer.substring(0, 1).toUpperCase() + manufacturer.substring(1),
          icon: Icons.check_circle,
          title: 'Pil Ayarları Tamam',
          description: 'Cihazınız stock Android kullanıyor. Pil optimizasyonu devre dışı bırakıldıysa ek ayar gerekmez.',
          steps: [
            'Pil optimizasyonu zaten devre dışı bırakıldı.',
            'Konum takibi sorunsuz çalışmalı.',
          ],
          isStockAndroid: true,
        );

      default:
        return ManufacturerConfig(
          name: 'Diğer',
          icon: Icons.phone_android,
          title: 'Pil Ayarları',
          description: 'Konum takibinin kesintisiz çalışması için:',
          steps: [
            'Ayarlar > Uygulamalar > Nakliyeo',
            'Pil > Arka plan kısıtlaması yok',
            'Pil optimizasyonu > Optimize etme',
          ],
          alternativeSteps: [
            'Cihazınızın pil tasarrufu ayarlarından',
            'Nakliyeo uygulamasını hariç tutun',
          ],
          intentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        );
    }
  }

  /// Ayar dialogunu göster (maksimum 3 kez)
  static Future<bool> shouldShowSettingsDialog() async {
    if (!Platform.isAndroid) return false;

    final prefs = await SharedPreferences.getInstance();
    final shownCount = prefs.getInt(_settingsShownCountKey) ?? 0;

    if (shownCount >= _maxShowCount) {
      debugPrint('[ManufacturerSettings] Already shown $_maxShowCount times, skipping');
      return false;
    }

    final manufacturer = await getManufacturer();
    final config = getConfigForManufacturer(manufacturer);

    // Stock Android cihazlarda gösterme
    if (config.isStockAndroid) {
      debugPrint('[ManufacturerSettings] Stock Android device, skipping');
      return false;
    }

    return true;
  }

  /// Gösterim sayısını artır
  static Future<void> incrementShowCount() async {
    final prefs = await SharedPreferences.getInstance();
    final currentCount = prefs.getInt(_settingsShownCountKey) ?? 0;
    await prefs.setInt(_settingsShownCountKey, currentCount + 1);
  }

  /// Kullanıcı "Bir daha gösterme" dedi
  static Future<void> neverShowAgain() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_settingsShownCountKey, _maxShowCount);
  }

  /// Uygulama ayarlarını aç
  static Future<void> openAppSettings() async {
    if (!Platform.isAndroid) return;

    try {
      const intent = AndroidIntent(
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        data: 'package:com.nakliyeo.nakliyeo_mobil',
        flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
      );
      await intent.launch();
    } catch (e) {
      debugPrint('[ManufacturerSettings] Error opening app settings: $e');
    }
  }

  /// Pil ayarlarını aç
  static Future<void> openBatterySettings() async {
    if (!Platform.isAndroid) return;

    try {
      const intent = AndroidIntent(
        action: 'android.settings.BATTERY_SAVER_SETTINGS',
        flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
      );
      await intent.launch();
    } catch (e) {
      debugPrint('[ManufacturerSettings] Error opening battery settings: $e');
      // Fallback to app settings
      await openAppSettings();
    }
  }

  /// Üreticiye özel otomatik başlatma ayarlarını aç
  static Future<void> openAutoStartSettings(String manufacturer) async {
    if (!Platform.isAndroid) return;

    try {
      AndroidIntent? intent;

      switch (manufacturer) {
        case 'xiaomi':
        case 'redmi':
        case 'poco':
          intent = const AndroidIntent(
            action: 'miui.intent.action.OP_AUTO_START',
            flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
          );
          break;

        case 'huawei':
        case 'honor':
          intent = const AndroidIntent(
            action: 'huawei.intent.action.HSM_BOOTAPP_MANAGER',
            flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
          );
          break;

        case 'oppo':
        case 'realme':
          // Oppo/Realme için doğrudan uygulama ayarlarına git
          await openAppSettings();
          return;

        case 'vivo':
          // Vivo için doğrudan uygulama ayarlarına git
          await openAppSettings();
          return;
      }

      if (intent != null) {
        await intent.launch();
      } else {
        await openAppSettings();
      }
    } catch (e) {
      debugPrint('[ManufacturerSettings] Error opening auto-start settings: $e');
      await openAppSettings();
    }
  }

  /// Ayarlar dialogunu göster
  static Future<void> showSettingsDialog(BuildContext context) async {
    if (!Platform.isAndroid) return;

    final manufacturer = await getManufacturer();
    final model = await getModel();
    final config = getConfigForManufacturer(manufacturer);

    if (config.isStockAndroid) return;

    await incrementShowCount();

    if (!context.mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _ManufacturerSettingsDialog(
        config: config,
        manufacturer: manufacturer,
        model: model,
      ),
    );
  }
}

/// Üretici ayar konfigürasyonu
class ManufacturerConfig {
  final String name;
  final IconData icon;
  final String title;
  final String description;
  final List<String> steps;
  final List<String>? alternativeSteps;
  final String? intentAction;
  final bool requiresAutoStart;
  final bool isStockAndroid;

  ManufacturerConfig({
    required this.name,
    required this.icon,
    required this.title,
    required this.description,
    required this.steps,
    this.alternativeSteps,
    this.intentAction,
    this.requiresAutoStart = false,
    this.isStockAndroid = false,
  });
}

/// Ayarlar dialog widget'ı - Basitleştirilmiş versiyon
class _ManufacturerSettingsDialog extends StatelessWidget {
  final ManufacturerConfig config;
  final String manufacturer;
  final String model;

  const _ManufacturerSettingsDialog({
    required this.config,
    required this.manufacturer,
    required this.model,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.location_on, color: Colors.blue.shade600, size: 32),
          ),
          const SizedBox(height: 12),
          const Text(
            'Konum Takibi İçin Ayar Gerekli',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Arka planda konum takibinin düzgün çalışması için telefonunuzun pil ayarlarını açmanız gerekiyor.',
            style: TextStyle(color: Colors.grey.shade700, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.phone_android, color: Colors.grey.shade600),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        config.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        model,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Ayarlarda "Pil optimizasyonu" veya "Arka plan kısıtlaması" seçeneğini bulup Nakliyeo için devre dışı bırakın.',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
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
              onPressed: () {
                Navigator.of(context).pop();
                ManufacturerSettingsService.openAppSettings();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade600,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text('Ayarları Aç', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text('Sonra', style: TextStyle(color: Colors.grey.shade600)),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () {
                    ManufacturerSettingsService.neverShowAgain();
                    Navigator.of(context).pop();
                  },
                  child: Text('Gösterme', style: TextStyle(color: Colors.grey.shade600)),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
