import 'dart:io';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';

import '../services/system_health_service.dart';
import '../services/battery_optimization_service.dart';
import '../services/manufacturer_settings_service.dart';
import '../services/hybrid_location_service.dart';

/// Sistem sağlık durumu widget'ı
/// İzinler, pil ayarları ve servis durumlarını gösterir
class SystemHealthWidget extends StatefulWidget {
  final bool showCompact;

  const SystemHealthWidget({
    super.key,
    this.showCompact = false,
  });

  @override
  State<SystemHealthWidget> createState() => _SystemHealthWidgetState();
}

class _SystemHealthWidgetState extends State<SystemHealthWidget> {
  SystemHealthReport? _report;
  bool _isLoading = true;
  bool _isExpanded = false;

  @override
  void initState() {
    super.initState();
    // Foreground service başlaması için 3 saniye bekle
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) _loadReport();
    });
  }

  Future<void> _loadReport() async {
    setState(() => _isLoading = true);
    try {
      // Service başlaması için kısa bir bekleme daha
      await Future.delayed(const Duration(milliseconds: 500));
      final report = await SystemHealthService.getHealthReport();
      if (mounted) {
        setState(() {
          _report = report;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('[SystemHealthWidget] Error loading report: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Color _getScoreColor(int score) {
    if (score >= 80) return Colors.green;
    if (score >= 60) return Colors.orange;
    return Colors.red;
  }

  IconData _getScoreIcon(int score) {
    if (score >= 80) return Icons.check_circle;
    if (score >= 60) return Icons.warning;
    return Icons.error;
  }

  String _getScoreText(int score) {
    if (score >= 80) return 'Sistem Saglikli';
    if (score >= 60) return 'Bazi Ayarlar Gerekli';
    return 'Kritik Sorunlar Var';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Card(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(height: 12),
                Text(
                  'Sistem kontrol ediliyor...',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_report == null) {
      return const SizedBox.shrink();
    }

    final score = SystemHealthService.calculateHealthScore(_report!);
    final issues = SystemHealthService.getIssues(_report!);
    final criticalIssues = issues.where((i) => i.severity == IssueSeverity.critical).toList();
    final warningIssues = issues.where((i) => i.severity == IssueSeverity.warning).toList();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          // Header - Her zaman görünür
          InkWell(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // Skor göstergesi
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: _getScoreColor(score).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '$score',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: _getScoreColor(score),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              _getScoreIcon(score),
                              size: 16,
                              color: _getScoreColor(score),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Sistem Durumu',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _getScoreText(score),
                          style: TextStyle(
                            fontSize: 12,
                            color: _getScoreColor(score),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Sorun sayısı badge'leri
                  if (criticalIssues.isNotEmpty) ...[
                    _buildBadge(criticalIssues.length, Colors.red),
                    const SizedBox(width: 4),
                  ],
                  if (warningIssues.isNotEmpty) ...[
                    _buildBadge(warningIssues.length, Colors.orange),
                    const SizedBox(width: 8),
                  ],
                  Icon(
                    _isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: Colors.grey,
                  ),
                ],
              ),
            ),
          ),

          // Expandable content
          if (_isExpanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Cihaz bilgisi
                  _buildDeviceInfo(),

                  // MIUI/Xiaomi özel uyarı - her zaman göster
                  if (_isMiuiDevice()) ...[
                    const SizedBox(height: 12),
                    _buildMiuiWarning(),
                  ],

                  const SizedBox(height: 16),

                  // Durum listesi
                  _buildStatusList(),

                  // Sorunlar varsa göster
                  if (issues.where((i) => i.action != null).isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 12),
                    Text(
                      'Yapilmasi Gerekenler',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...issues
                        .where((i) => i.action != null)
                        .map((issue) => _buildIssueCard(issue)),
                  ],

                  // Yenile butonu
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _loadReport,
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text('Yenile'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBadge(int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }

  Widget _buildDeviceInfo() {
    final info = _report!.manufacturerInfo;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.phone_android, color: Colors.grey.shade600, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${info.manufacturer} ${info.model}',
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                if (info.androidVersion != null)
                  Text(
                    info.androidVersion!,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
              ],
            ),
          ),
          if (info.needsSpecialSettings)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: info.settingsConfigured
                    ? Colors.green.withOpacity(0.1)
                    : Colors.orange.withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                info.settingsConfigured ? 'Ayarlar OK' : 'Ayar Gerekli',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: info.settingsConfigured ? Colors.green : Colors.orange,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// MIUI/Xiaomi cihaz mı kontrol et
  bool _isMiuiDevice() {
    if (_report == null) return false;
    final manufacturer = _report!.manufacturerInfo.manufacturer.toLowerCase();
    return ['xiaomi', 'redmi', 'poco'].contains(manufacturer);
  }

  /// MIUI için özel uyarı kartı
  Widget _buildMiuiWarning() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange.shade700, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'MIUI Ozel Ayarlar Gerekli',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.orange.shade800,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Xiaomi/Redmi cihazlarda arka plan servisi icin asagidaki ayarlari yapmaniz gerekiyor:',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
          ),
          const SizedBox(height: 12),
          // AutoStart butonu
          _buildMiuiSettingButton(
            icon: Icons.play_circle_outline,
            title: 'Otomatik Baslatma',
            subtitle: 'AutoStart izni acin',
            onTap: () => ManufacturerSettingsService.openAutoStartSettings('xiaomi'),
          ),
          const SizedBox(height: 8),
          // Pil tasarrufu butonu
          _buildMiuiSettingButton(
            icon: Icons.battery_saver,
            title: 'Pil Tasarrufu',
            subtitle: 'Sinırlama yok secin',
            onTap: () => ManufacturerSettingsService.openAppSettings(),
          ),
          const SizedBox(height: 8),
          // Arka plan kısıtlaması butonu
          _buildMiuiSettingButton(
            icon: Icons.lock_open,
            title: 'Arka Plan Kilidi',
            subtitle: 'Son uygulamalarda kilitleyin',
            onTap: null,
            isInfo: true,
          ),
        ],
      ),
    );
  }

  Widget _buildMiuiSettingButton({
    required IconData icon,
    required String title,
    required String subtitle,
    VoidCallback? onTap,
    bool isInfo = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.orange.shade100),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon, color: Colors.orange.shade700, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            if (!isInfo)
              Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey.shade400),
            if (isInfo)
              Icon(Icons.info_outline, size: 16, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusList() {
    return Column(
      children: [
        _buildStatusRow(
          'GPS',
          _report!.gpsEnabled ? 'Acik' : 'Kapali',
          _report!.gpsEnabled ? Colors.green : Colors.red,
          _report!.gpsEnabled ? Icons.gps_fixed : Icons.gps_off,
        ),
        _buildStatusRow(
          'Konum Izni',
          _getPermissionText(_report!.locationPermission),
          _getPermissionColor(_report!.locationPermission),
          Icons.location_on,
        ),
        _buildStatusRow(
          'Arka Plan Konum',
          _getPermissionText(_report!.backgroundLocationPermission),
          _getPermissionColor(_report!.backgroundLocationPermission),
          Icons.my_location,
        ),
        if (Platform.isAndroid)
          _buildStatusRow(
            'Pil Optimizasyonu',
            _getBatteryOptText(_report!.batteryOptimization),
            _getBatteryOptColor(_report!.batteryOptimization),
            Icons.battery_saver,
          ),
        _buildStatusRow(
          'Arka Plan Servisi',
          _report!.foregroundServiceRunning ? 'Calisiyor' : 'Durmus',
          _report!.foregroundServiceRunning ? Colors.green : Colors.red,
          _report!.foregroundServiceRunning
              ? Icons.play_circle
              : Icons.pause_circle,
        ),
        _buildStatusRow(
          'Son Konum',
          _report!.lastLocationTime != null
              ? _formatTimeAgo(_report!.lastLocationTime!)
              : 'Hic',
          _getLastLocationColor(),
          Icons.schedule,
        ),
      ],
    );
  }

  Widget _buildStatusRow(String label, String value, Color color, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIssueCard(HealthIssue issue) {
    final color = issue.severity == IssueSeverity.critical
        ? Colors.red
        : issue.severity == IssueSeverity.warning
            ? Colors.orange
            : Colors.blue;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Icon(
            issue.severity == IssueSeverity.critical
                ? Icons.error
                : issue.severity == IssueSeverity.warning
                    ? Icons.warning
                    : Icons.info,
            color: color,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  issue.title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: color,
                    fontSize: 13,
                  ),
                ),
                Text(
                  issue.description,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
          if (issue.action != null) ...[
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () => _handleAction(issue.actionType!),
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                textStyle: const TextStyle(fontSize: 12),
              ),
              child: Text(issue.action!),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _handleAction(HealthActionType actionType) async {
    switch (actionType) {
      case HealthActionType.openLocationSettings:
        await Geolocator.openLocationSettings();
        break;

      case HealthActionType.requestLocationPermission:
        await Permission.location.request();
        break;

      case HealthActionType.requestBackgroundLocationPermission:
        await Permission.locationAlways.request();
        break;

      case HealthActionType.disableBatteryOptimization:
        await BatteryOptimizationService.requestDisableBatteryOptimization();
        break;

      case HealthActionType.restartService:
        await HybridLocationService.startForegroundService();
        break;

      case HealthActionType.showManufacturerSettings:
        if (mounted) {
          await ManufacturerSettingsService.showSettingsDialog(context);
        }
        break;

      case HealthActionType.sendLocation:
        await HybridLocationService.sendImmediateLocation(trigger: 'manual');
        break;
    }

    // Yenile
    await Future.delayed(const Duration(milliseconds: 500));
    await _loadReport();
  }

  String _getPermissionText(PermissionState state) {
    switch (state) {
      case PermissionState.granted:
        return 'Verildi';
      case PermissionState.denied:
        return 'Reddedildi';
      case PermissionState.permanentlyDenied:
        return 'Kalici Red';
      case PermissionState.restricted:
        return 'Kisitli';
      case PermissionState.limited:
        return 'Sinirli';
      case PermissionState.unknown:
        return 'Bilinmiyor';
    }
  }

  Color _getPermissionColor(PermissionState state) {
    switch (state) {
      case PermissionState.granted:
        return Colors.green;
      case PermissionState.denied:
      case PermissionState.permanentlyDenied:
        return Colors.red;
      case PermissionState.restricted:
      case PermissionState.limited:
        return Colors.orange;
      case PermissionState.unknown:
        return Colors.grey;
    }
  }

  String _getBatteryOptText(BatteryOptimizationState state) {
    switch (state) {
      case BatteryOptimizationState.enabled:
        return 'Acik (Sorunlu)';
      case BatteryOptimizationState.disabled:
        return 'Devre Disi';
      case BatteryOptimizationState.notApplicable:
        return 'N/A';
      case BatteryOptimizationState.unknown:
        return 'Bilinmiyor';
    }
  }

  Color _getBatteryOptColor(BatteryOptimizationState state) {
    switch (state) {
      case BatteryOptimizationState.enabled:
        return Colors.red;
      case BatteryOptimizationState.disabled:
        return Colors.green;
      case BatteryOptimizationState.notApplicable:
      case BatteryOptimizationState.unknown:
        return Colors.grey;
    }
  }

  Color _getLastLocationColor() {
    if (_report!.lastLocationTime == null) return Colors.grey;
    final diff = DateTime.now().difference(_report!.lastLocationTime!);
    if (diff.inMinutes <= 30) return Colors.green;
    if (diff.inHours <= 2) return Colors.orange;
    return Colors.red;
  }

  String _formatTimeAgo(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'Az once';
    if (diff.inMinutes < 60) return '${diff.inMinutes} dk once';
    if (diff.inHours < 24) return '${diff.inHours} saat once';
    return '${diff.inDays} gun once';
  }
}
