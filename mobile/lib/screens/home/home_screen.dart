import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/questions_provider.dart';
import '../../services/location_service.dart';
import '../../services/notification_service.dart';
import '../../config/theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    _initLocation();
    _loadQuestions();
    _sendFcmToken();
  }

  Future<void> _initLocation() async {
    final locationProvider = context.read<LocationProvider>();
    final hasPermission = await locationProvider.checkAndRequestPermission();
    if (hasPermission) {
      await locationProvider.startTracking();
    }
  }

  Future<void> _loadQuestions() async {
    await context.read<QuestionsProvider>().loadPendingQuestions();
  }

  Future<void> _sendFcmToken() async {
    // Send FCM token to server after login
    try {
      final notificationService = context.read<NotificationService>();
      await notificationService.sendFcmTokenToServer();
    } catch (e) {
      debugPrint('Failed to send FCM token: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nakliyeo Mobil'),
        actions: [
          Consumer<QuestionsProvider>(
            builder: (context, questions, _) {
              return Stack(
                children: [
                  IconButton(
                    icon: const Icon(Icons.quiz_outlined),
                    onPressed: () => context.goNamed('questions'),
                  ),
                  if (questions.pendingCount > 0)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 18,
                          minHeight: 18,
                        ),
                        child: Text(
                          '${questions.pendingCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await context.read<AuthProvider>().loadProfile();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome card
              Consumer<AuthProvider>(
                builder: (context, auth, _) {
                  final user = auth.user;
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 30,
                            backgroundColor: AppColors.primary,
                            child: Text(
                              user?['name']?.substring(0, 1).toUpperCase() ?? 'N',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Hoş geldin,',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                                Text(
                                  '${user?['name'] ?? ''} ${user?['surname'] ?? ''}',
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),

              // Status card
              Consumer<LocationProvider>(
                builder: (context, location, _) {
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                _getStatusIcon(location.currentStatus),
                                color: _getStatusColor(location.currentStatus),
                                size: 28,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'Durum',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: _getStatusColor(location.currentStatus).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text(
                                  _getStatusText(location.currentStatus),
                                  style: TextStyle(
                                    color: _getStatusColor(location.currentStatus),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              _buildInfoItem(
                                context,
                                Icons.gps_fixed,
                                'Konum Takibi',
                                location.isTracking ? 'Aktif' : 'Pasif',
                                location.isTracking ? AppColors.success : AppColors.error,
                              ),
                              const SizedBox(width: 16),
                              _buildInfoItem(
                                context,
                                Icons.speed,
                                'Hız',
                                location.currentLocation?.speed != null
                                    ? '${(location.currentLocation!.speed! * 3.6).toStringAsFixed(0)} km/h'
                                    : '-- km/h',
                                AppColors.info,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),

              // Pending questions card
              Consumer<QuestionsProvider>(
                builder: (context, questions, _) {
                  if (questions.pendingCount > 0) {
                    return Card(
                      color: Colors.orange.shade50,
                      child: InkWell(
                        onTap: () => context.goNamed('questions'),
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.orange.shade100,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.quiz,
                                  color: Colors.orange.shade700,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${questions.pendingCount} Bekleyen Soru',
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Sorulari cevaplayarak katkida bulunun',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: Colors.grey.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.arrow_forward_ios,
                                color: Colors.orange.shade700,
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
              const SizedBox(height: 16),

              // Quick actions
              Text(
                'Hizli Islemler',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      Icons.local_shipping,
                      'Araclarim',
                      () => context.goNamed('vehicles'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickActionWithBadge(
                      context,
                      Icons.quiz,
                      'Sorular',
                      () => context.goNamed('questions'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      Icons.person,
                      'Profil',
                      () => context.goNamed('profile'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      Icons.help_outline,
                      'Yardim',
                      () {},
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoItem(
    BuildContext context,
    IconData icon,
    String label,
    String value,
    Color color,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAction(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onTap,
  ) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(icon, size: 32, color: AppColors.primary),
              const SizedBox(height: 8),
              Text(label, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionWithBadge(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onTap,
  ) {
    return Consumer<QuestionsProvider>(
      builder: (context, questions, _) {
        return Card(
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(icon, size: 32, color: AppColors.primary),
                      if (questions.pendingCount > 0)
                        Positioned(
                          right: -8,
                          top: -8,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 18,
                              minHeight: 18,
                            ),
                            child: Text(
                              '${questions.pendingCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(label, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  IconData _getStatusIcon(DriverStatus status) {
    switch (status) {
      case DriverStatus.home:
        return Icons.home;
      case DriverStatus.driving:
        return Icons.directions_car;
      case DriverStatus.stopped:
        return Icons.pause_circle;
      default:
        return Icons.help_outline;
    }
  }

  Color _getStatusColor(DriverStatus status) {
    switch (status) {
      case DriverStatus.home:
        return AppColors.success;
      case DriverStatus.driving:
        return AppColors.primary;
      case DriverStatus.stopped:
        return AppColors.warning;
      default:
        return AppColors.textSecondary;
    }
  }

  String _getStatusText(DriverStatus status) {
    switch (status) {
      case DriverStatus.home:
        return 'Evde';
      case DriverStatus.driving:
        return 'Seferde';
      case DriverStatus.stopped:
        return 'Mola';
      default:
        return 'Bilinmiyor';
    }
  }
}
