import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../services/permission_service.dart';

// Ana renk tanımı
const Color _primaryColor = Color(0xFF000000);

class PermissionRequestScreen extends StatefulWidget {
  const PermissionRequestScreen({super.key});

  @override
  State<PermissionRequestScreen> createState() => _PermissionRequestScreenState();
}

class _PermissionRequestScreenState extends State<PermissionRequestScreen> {
  bool _isRequesting = false;
  int _currentPermissionIndex = -1;
  Map<Permission, PermissionStatus> _permissionStatuses = {};
  bool _allDone = false;

  @override
  void initState() {
    super.initState();
    _checkExistingPermissions();
  }

  Future<void> _checkExistingPermissions() async {
    final statuses = await PermissionService.checkAllPermissions();
    setState(() {
      _permissionStatuses = statuses;
    });
  }

  Future<void> _requestAllPermissions() async {
    setState(() {
      _isRequesting = true;
      _currentPermissionIndex = 0;
    });

    for (int i = 0; i < PermissionService.requiredPermissions.length; i++) {
      if (!mounted) return;

      setState(() {
        _currentPermissionIndex = i;
      });

      final info = PermissionService.requiredPermissions[i];
      debugPrint('=== Requesting: ${info.name} (${info.permission}) ===');

      try {
        final status = await PermissionService.requestPermission(info.permission);
        debugPrint('=== Result for ${info.name}: $status ===');

        if (mounted) {
          setState(() {
            _permissionStatuses[info.permission] = status;
          });
        }
      } catch (e) {
        debugPrint('Permission error for ${info.name}: $e');
        if (mounted) {
          setState(() {
            _permissionStatuses[info.permission] = PermissionStatus.denied;
          });
        }
      }

      // İzinler arası bekleme - diyalogların düzgün görünmesi için
      await Future.delayed(const Duration(milliseconds: 800));
    }

    await PermissionService.markPermissionsRequested();

    if (mounted) {
      setState(() {
        _isRequesting = false;
        _allDone = true;
      });

      // Reddedilen zorunlu izinler varsa uyarı göster
      _checkDeniedPermissions();
    }
  }

  void _checkDeniedPermissions() {
    final deniedRequired = <String>[];

    for (final info in PermissionService.requiredPermissions) {
      final status = _permissionStatuses[info.permission];
      if (info.isRequired && status != null && !status.isGranted) {
        deniedRequired.add(info.name);
      }
    }

    if (deniedRequired.isNotEmpty && mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning_amber, color: Colors.orange),
              SizedBox(width: 8),
              Text('Bazı İzinler Eksik'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Aşağıdaki zorunlu izinler verilmedi:'),
              const SizedBox(height: 8),
              ...deniedRequired.map((name) => Padding(
                padding: const EdgeInsets.only(left: 8, top: 4),
                child: Row(
                  children: [
                    const Icon(Icons.close, color: Colors.red, size: 16),
                    const SizedBox(width: 4),
                    Text(name),
                  ],
                ),
              )),
              const SizedBox(height: 12),
              const Text(
                'Uygulama ayarlarından bu izinleri manuel olarak verebilirsiniz.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Tamam'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await openAppSettings();
              },
              child: const Text('Ayarlara Git'),
            ),
          ],
        ),
      );
    }
  }

  void _continue() {
    context.go('/home');
  }

  IconData _getIconForPermission(String iconName) {
    switch (iconName) {
      case 'location_on':
        return Icons.location_on;
      case 'my_location':
        return Icons.my_location;
      case 'notifications':
        return Icons.notifications;
      case 'phone':
        return Icons.phone;
      case 'contacts':
        return Icons.contacts;
      case 'sensors':
        return Icons.sensors;
      default:
        return Icons.check_circle;
    }
  }

  Color _getStatusColor(PermissionStatus? status) {
    if (status == null) return Colors.grey;
    if (status.isGranted) return Colors.green;
    if (status.isPermanentlyDenied) return Colors.red;
    return Colors.orange;
  }

  String _getStatusText(PermissionStatus? status) {
    if (status == null) return 'Bekliyor';
    if (status.isGranted) return 'Verildi';
    if (status.isPermanentlyDenied) return 'Kalıcı Red';
    if (status.isDenied) return 'Reddedildi';
    return 'Bekliyor';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 20),

              // Header
              Icon(
                Icons.security,
                size: 64,
                color: _primaryColor,
              ),
              const SizedBox(height: 16),
              const Text(
                'Uygulama İzinleri',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Uygulamanın düzgün çalışması için aşağıdaki izinlere ihtiyacımız var',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                ),
              ),

              const SizedBox(height: 32),

              // Permission List
              Expanded(
                child: ListView.builder(
                  itemCount: PermissionService.requiredPermissions.length,
                  itemBuilder: (context, index) {
                    final info = PermissionService.requiredPermissions[index];
                    final status = _permissionStatuses[info.permission];
                    final isCurrentlyRequesting = _isRequesting && _currentPermissionIndex == index;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isCurrentlyRequesting
                            ? _primaryColor.withOpacity(0.1)
                            : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isCurrentlyRequesting
                              ? _primaryColor
                              : Colors.grey.shade200,
                          width: isCurrentlyRequesting ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          // Icon
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: _getStatusColor(status).withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _getIconForPermission(info.icon),
                              color: _getStatusColor(status),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),

                          // Info
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      info.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 15,
                                      ),
                                    ),
                                    if (info.isRequired) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 6,
                                          vertical: 2,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.red.shade100,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          'Zorunlu',
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: Colors.red.shade700,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  info.description,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Status
                          if (isCurrentlyRequesting)
                            const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: _getStatusColor(status).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                _getStatusText(status),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: _getStatusColor(status),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 16),

              // Buttons
              if (!_isRequesting && !_allDone)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _requestAllPermissions,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'İzinleri Ver',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),

              if (_isRequesting)
                Column(
                  children: [
                    LinearProgressIndicator(
                      value: (_currentPermissionIndex + 1) /
                          PermissionService.requiredPermissions.length,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: AlwaysStoppedAnimation<Color>(_primaryColor),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'İzinler isteniyor...',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),

              if (_allDone) ...[
                // Summary
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.green.shade600),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'İzin işlemi tamamlandı! Uygulamayı kullanmaya başlayabilirsiniz.',
                          style: TextStyle(
                            color: Colors.green.shade700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _continue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Devam Et',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],

              // Skip option (only before requesting)
              if (!_isRequesting && !_allDone)
                TextButton(
                  onPressed: () {
                    PermissionService.markPermissionsRequested().then((_) {
                      if (mounted) {
                        context.go('/home');
                      }
                    });
                  },
                  child: Text(
                    'Şimdilik Atla',
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 14,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
