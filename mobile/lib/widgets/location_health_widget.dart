import 'dart:async';

import 'package:flutter/material.dart';
import '../services/hybrid_location_service.dart';
import '../services/trip_detection_service.dart';
import '../services/location_status_service.dart';

/// Konum sağlık ve durum widget'ı
/// Ana ekranda gösterilir
class LocationHealthWidget extends StatefulWidget {
  const LocationHealthWidget({super.key});

  @override
  State<LocationHealthWidget> createState() => _LocationHealthWidgetState();
}

class _LocationHealthWidgetState extends State<LocationHealthWidget> {
  LocationHealthStats? _stats;
  int _pendingCount = 0;
  DateTime? _lastSuccess;
  TripState _tripState = TripState.idle;
  bool _isGpsEnabled = true;
  bool _isOnline = true;
  bool _isInHomeZone = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    // Her 30 saniyede yenile
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadData());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadData() async {
    final stats = await HybridLocationService.getHealthStats();
    final pending = await HybridLocationService.getPendingCount();
    final lastSuccess = await HybridLocationService.getLastSuccessTime();

    if (mounted) {
      setState(() {
        _stats = stats;
        _pendingCount = pending;
        _lastSuccess = lastSuccess;
        _tripState = TripDetectionService.currentState;
        _isGpsEnabled = LocationStatusService.isGpsEnabled;
        _isOnline = LocationStatusService.isOnline;
        _isInHomeZone = TripDetectionService.isInHomeZone;
      });
    }
  }

  String _formatTimeAgo(DateTime? time) {
    if (time == null) return 'Hiç';
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'Az önce';
    if (diff.inMinutes < 60) return '${diff.inMinutes} dk önce';
    if (diff.inHours < 24) return '${diff.inHours} saat önce';
    return '${diff.inDays} gün önce';
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  Color _getStatusColor() {
    if (!_isGpsEnabled) return Colors.red;
    if (!_isOnline) return Colors.orange;
    if (_pendingCount > 10) return Colors.yellow.shade700;
    if (_stats?.successRate != null && _stats!.successRate < 80) return Colors.orange;
    return Colors.green;
  }

  IconData _getStatusIcon() {
    if (!_isGpsEnabled) return Icons.location_off;
    if (!_isOnline) return Icons.cloud_off;
    if (_pendingCount > 10) return Icons.pending;
    return Icons.check_circle;
  }

  String _getStatusText() {
    if (!_isGpsEnabled) return 'GPS Kapalı';
    if (!_isOnline) return 'Çevrimdışı';
    if (_pendingCount > 10) return '$_pendingCount Bekliyor';
    return 'Aktif';
  }

  String _getTripStateText() {
    switch (_tripState) {
      case TripState.idle:
        return 'Sefer yok';
      case TripState.starting:
        return 'Sefer başlıyor...';
      case TripState.active:
        return 'Seferde';
      case TripState.ending:
        return 'Sefer bitiyor...';
    }
  }

  Color _getTripStateColor() {
    switch (_tripState) {
      case TripState.idle:
        return Colors.grey;
      case TripState.starting:
        return Colors.blue;
      case TripState.active:
        return Colors.green;
      case TripState.ending:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Başlık ve durum
            Row(
              children: [
                Icon(
                  _getStatusIcon(),
                  color: _getStatusColor(),
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Konum Takibi',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        _getStatusText(),
                        style: TextStyle(
                          fontSize: 12,
                          color: _getStatusColor(),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                // Ev bölgesi göstergesi
                if (_isInHomeZone) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.home,
                          size: 14,
                          color: Colors.blue.shade700,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Evde',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.blue.shade700,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                // Sefer durumu
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getTripStateColor().withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _getTripStateColor().withOpacity(0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _tripState == TripState.active
                            ? Icons.local_shipping
                            : Icons.local_shipping_outlined,
                        size: 14,
                        color: _getTripStateColor(),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _getTripStateText(),
                        style: TextStyle(
                          fontSize: 11,
                          color: _getTripStateColor(),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const Divider(height: 24),

            // İstatistikler
            Row(
              children: [
                Expanded(
                  child: _StatItem(
                    icon: Icons.send,
                    label: 'Gönderilen',
                    value: '${_stats?.totalSent ?? 0}',
                    color: Colors.green,
                  ),
                ),
                Expanded(
                  child: _StatItem(
                    icon: Icons.pending,
                    label: 'Bekleyen',
                    value: '$_pendingCount',
                    color: _pendingCount > 0 ? Colors.orange : Colors.grey,
                  ),
                ),
                Expanded(
                  child: _StatItem(
                    icon: Icons.percent,
                    label: 'Başarı',
                    value: '${_stats?.successRate.toStringAsFixed(0) ?? 100}%',
                    color: (_stats?.successRate ?? 100) >= 90
                        ? Colors.green
                        : Colors.orange,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Alt bilgiler
            Row(
              children: [
                // Son gönderim
                Expanded(
                  child: Row(
                    children: [
                      Icon(
                        Icons.schedule,
                        size: 14,
                        color: Colors.grey.shade600,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Son: ${_formatTimeAgo(_lastSuccess)}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                // Tasarruf
                if (_stats != null && _stats!.bytesSaved > 0)
                  Row(
                    children: [
                      Icon(
                        Icons.compress,
                        size: 14,
                        color: Colors.blue.shade600,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${_formatBytes(_stats!.bytesSaved)} tasarruf',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.blue.shade600,
                        ),
                      ),
                    ],
                  ),
              ],
            ),

            // Hata mesajı
            if (_stats?.lastError != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.error_outline,
                      size: 14,
                      color: Colors.red.shade700,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Son hata: ${_stats!.lastError}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.red.shade700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey.shade600,
          ),
        ),
      ],
    );
  }
}
