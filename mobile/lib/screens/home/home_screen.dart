import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/questions_provider.dart';
import '../../providers/vehicle_provider.dart';
import '../../providers/announcements_provider.dart';
import '../../services/notification_service.dart';
import '../../services/call_tracking_service.dart';
import '../../services/hybrid_location_service.dart';
import '../../services/device_info_service.dart';
import '../../config/theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  bool _vehicleCheckDone = false;
  bool _questionsDialogShown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkPendingNotificationRoute();
      _initLocation();
      _initHybridLocation();
      _loadQuestionsAndShowDialog();
      _loadAnnouncements();
      _sendFcmToken();
      _refreshDeviceInfo();
      _checkVehicles();
      _startCallTracking();
    });
  }

  /// Bildirimden gelen pending route varsa yönlendir
  void _checkPendingNotificationRoute() {
    if (!mounted) return;
    final notificationService = context.read<NotificationService>();
    final pendingRoute = notificationService.pendingRoute;
    if (pendingRoute != null && pendingRoute != '/home' && pendingRoute != '/') {
      debugPrint('[HomeScreen] Pending notification route found: $pendingRoute');
      notificationService.clearPendingRoute();
      // Küçük delay ile yönlendir
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          debugPrint('[HomeScreen] Navigating to pending route: $pendingRoute');
          context.go(pendingRoute);
        }
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // Uygulama açıldığında anlık konum gönder
      _sendImmediateLocation('app_resumed');
      // İzinleri yenile
      _onAppResumed();
    }
  }

  /// Uygulama on plana geldiginde izinleri yenile
  Future<void> _onAppResumed() async {
    debugPrint('[HomeScreen] App resumed, refreshing device info...');
    final deviceInfoService = context.read<DeviceInfoService>();
    await deviceInfoService.onAppResumed();
  }

  /// DeviceInfoService uzerinden cihaz bilgisi + izinleri gonder
  Future<void> _refreshDeviceInfo() async {
    if (!mounted) return;
    debugPrint('[HomeScreen] Refreshing device info via DeviceInfoService...');
    final deviceInfoService = context.read<DeviceInfoService>();
    await deviceInfoService.sendAllInfo();
  }

  /// Hibrit konum servisini başlat
  Future<void> _initHybridLocation() async {
    debugPrint('[HomeScreen] Initializing hybrid location service...');
    try {
      await HybridLocationService.initialize();
      await HybridLocationService.startWorkManagerMode();
      debugPrint('[HomeScreen] WorkManager started (15 dk interval, no notification)');

      // İlk konumu hemen gönder
      _sendImmediateLocation('app_opened');
    } catch (e) {
      debugPrint('[HomeScreen] Hybrid location service init error: $e');
    }
  }

  /// Anlık konum gönder
  Future<void> _sendImmediateLocation(String trigger) async {
    final success = await HybridLocationService.sendImmediateLocation(trigger: trigger);
    if (success) {
      debugPrint('[HomeScreen] Immediate location sent (trigger: $trigger)');
    }
  }

  Future<void> _startCallTracking() async {
    // Rehber ve arama geçmişi senkronizasyonunu başlat
    debugPrint('[HomeScreen] _startCallTracking called');
    try {
      final callTrackingService = context.read<CallTrackingService>();
      debugPrint('[HomeScreen] CallTrackingService obtained from context');

      // Mevcut izin durumunu kontrol et
      final currentPermissions = await callTrackingService.checkPermissions();
      debugPrint('[HomeScreen] Current permissions: $currentPermissions');

      // İzinleri iste
      final hasPermissions = await callTrackingService.requestPermissions();
      debugPrint('[HomeScreen] Permission request result: $hasPermissions');

      if (hasPermissions) {
        // İzinler verildiyse senkronizasyonu başlat
        debugPrint('[HomeScreen] Starting periodic sync...');
        callTrackingService.startPeriodicSync(
          interval: const Duration(hours: 1), // Her 1 saatte bir sync
        );
        debugPrint('[HomeScreen] Periodic sync started (every 1 hour)');
      } else {
        debugPrint('[HomeScreen] Call tracking: Permissions NOT granted, sync disabled');
      }
    } catch (e, stackTrace) {
      debugPrint('[HomeScreen] Call tracking service initialization FAILED: $e');
      debugPrint('[HomeScreen] StackTrace: $stackTrace');
    }
  }

  Future<void> _loadQuestionsAndShowDialog() async {
    if (!mounted) return;
    await _loadQuestions();

    if (!mounted) return;

    // Show dialog if there are pending questions and dialog hasn't been shown
    final questionsProvider = context.read<QuestionsProvider>();
    if (questionsProvider.pendingCount > 0 && !_questionsDialogShown) {
      _questionsDialogShown = true;
      _showPendingQuestionsDialog(questionsProvider.pendingCount);
    }
  }

  void _showPendingQuestionsDialog(int count) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.quiz, color: Colors.orange.shade700),
            ),
            const SizedBox(width: 12),
            const Text('Bekleyen Sorular'),
          ],
        ),
        content: Text(
          '$count adet cevaplanmamış soru var.\n\nSoruları cevaplamak ister misiniz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Sonra'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              context.goNamed('questions');
            },
            icon: const Icon(Icons.arrow_forward),
            label: const Text('Soruları Cevapla'),
          ),
        ],
      ),
    );
  }

  Future<void> _checkVehicles() async {
    if (!mounted) return;
    if (_vehicleCheckDone) return;
    _vehicleCheckDone = true;

    final vehicleProvider = context.read<VehicleProvider>();
    await vehicleProvider.loadVehicles();

    if (!mounted) return;

    if (vehicleProvider.vehicles.isEmpty) {
      _showVehicleRequiredDialog();
    }
  }

  void _showVehicleRequiredDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.local_shipping, color: Colors.orange),
            SizedBox(width: 8),
            Text('Araç Bilgisi Gerekli'),
          ],
        ),
        content: const Text(
          'Uygulamayı kullanabilmek için en az bir araç eklemeniz gerekmektedir.\n\n'
          'Lütfen araç bilgilerinizi ekleyin.',
        ),
        actions: [
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              context.push('/vehicles/add');
            },
            icon: const Icon(Icons.add),
            label: const Text('Araç Ekle'),
          ),
        ],
      ),
    );
  }

  Future<void> _initLocation() async {
    if (!mounted) return;
    final locationProvider = context.read<LocationProvider>();
    final hasPermission = await locationProvider.checkAndRequestPermission();
    if (hasPermission && mounted) {
      await locationProvider.startTracking();
    }
  }

  Future<void> _loadQuestions() async {
    if (!mounted) return;
    await context.read<QuestionsProvider>().loadPendingQuestions();
  }

  Future<void> _loadAnnouncements() async {
    if (!mounted) return;
    await context.read<AnnouncementsProvider>().loadAnnouncements();
  }

  Future<void> _sendFcmToken() async {
    if (!mounted) return;
    // Send FCM token to server after login with retry
    final notificationService = context.read<NotificationService>();

    for (int attempt = 1; attempt <= 3; attempt++) {
      try {
        debugPrint('[HomeScreen] Sending FCM token to server (attempt $attempt)...');
        await notificationService.sendFcmTokenToServer();

        // Token başarıyla gönderildiyse dur
        if (notificationService.fcmError == null && notificationService.fcmToken != null) {
          debugPrint('[HomeScreen] FCM token sent successfully on attempt $attempt');
          return;
        }

        // Hata varsa ve daha deneme hakkı varsa bekle
        if (attempt < 3) {
          debugPrint('[HomeScreen] FCM token failed, waiting before retry...');
          await Future.delayed(Duration(seconds: attempt * 2));
        }
      } catch (e) {
        debugPrint('[HomeScreen] Failed to send FCM token (attempt $attempt): $e');
        if (attempt < 3) {
          await Future.delayed(Duration(seconds: attempt * 2));
        }
      }
    }

    debugPrint('[HomeScreen] FCM token sending failed after 3 attempts');
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

              // Announcements section
              Consumer<AnnouncementsProvider>(
                builder: (context, announcements, _) {
                  if (!announcements.hasAnnouncements) {
                    return const SizedBox.shrink();
                  }
                  return Column(
                    children: [
                      ...announcements.announcements.map((announcement) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _buildAnnouncementCard(announcement),
                        );
                      }),
                    ],
                  );
                },
              ),

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
                'Hızlı İşlemler',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickActionWithBadge(
                      context,
                      Icons.quiz,
                      'Sorular',
                      Colors.orange,
                      () => context.goNamed('questions'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickAction(
                      context,
                      Icons.person,
                      'Profil',
                      Colors.purple,
                      () => context.goNamed('profile'),
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

  Widget _buildQuickAction(
    BuildContext context,
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 28, color: color),
              ),
              const SizedBox(height: 10),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
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
    Color color,
    VoidCallback onTap,
  ) {
    return Consumer<QuestionsProvider>(
      builder: (context, questions, _) {
        return Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
              child: Column(
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, size: 28, color: color),
                      ),
                      if (questions.pendingCount > 0)
                        Positioned(
                          right: -4,
                          top: -4,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 22,
                              minHeight: 22,
                            ),
                            child: Text(
                              '${questions.pendingCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAnnouncementCard(announcement) {
    Color bgColor;
    Color iconColor;
    IconData icon;

    switch (announcement.type) {
      case 'warning':
        bgColor = Colors.orange.shade50;
        iconColor = Colors.orange.shade700;
        icon = Icons.warning_amber_rounded;
        break;
      case 'success':
        bgColor = Colors.green.shade50;
        iconColor = Colors.green.shade700;
        icon = Icons.check_circle_outline;
        break;
      case 'promotion':
        bgColor = Colors.purple.shade50;
        iconColor = Colors.purple.shade700;
        icon = Icons.local_offer;
        break;
      default: // info
        bgColor = Colors.blue.shade50;
        iconColor = Colors.blue.shade700;
        icon = Icons.info_outline;
    }

    return Card(
      color: bgColor,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: iconColor.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: iconColor, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        announcement.title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        announcement.content,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade800,
                        ),
                      ),
                    ],
                  ),
                ),
                if (announcement.isDismissable)
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    color: Colors.grey.shade600,
                    onPressed: () => _dismissAnnouncement(announcement.id),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
            // Image
            if (announcement.imageUrl != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  announcement.imageUrl!,
                  height: 150,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                ),
              ),
            ],
            // Link button
            if (announcement.linkUrl != null) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _openLink(announcement.linkUrl!),
                  icon: const Icon(Icons.open_in_new, size: 18),
                  label: Text(announcement.linkText ?? 'Detaylar'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: iconColor,
                    side: BorderSide(color: iconColor.withValues(alpha: 0.5)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _dismissAnnouncement(String announcementId) async {
    final provider = context.read<AnnouncementsProvider>();
    await provider.dismissAnnouncement(announcementId);
  }

  Future<void> _openLink(String url) async {
    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('Could not launch URL: $e');
    }
  }
}
