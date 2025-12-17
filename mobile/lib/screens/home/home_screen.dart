import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../config/constants.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/questions_provider.dart';
import '../../providers/vehicle_provider.dart';
import '../../services/location_service.dart';
import '../../services/notification_service.dart';
import '../../services/call_tracking_service.dart';
import '../../services/hybrid_location_service.dart';
import '../../services/api_service.dart';
import '../../config/theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  bool _vehicleCheckDone = false;
  bool _questionsDialogShown = false;
  Timer? _foregroundCheckTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initLocation();
      _initHybridLocation();
      _loadQuestionsAndShowDialog();
      _sendFcmToken();
      _sendDeviceInfoAndPermissions(); // Cihaz bilgisi ve izin durumları
      _checkVehicles();
      _startCallTracking();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _foregroundCheckTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // Kullanıcı telefonu eline aldı - Foreground modundan çık
      _onPhonePickedUp();
    }
  }

  /// Kullanıcı telefonu eline aldığında çağrılır
  Future<void> _onPhonePickedUp() async {
    debugPrint('[HomeScreen] Phone picked up - user is using phone');

    final prefs = await SharedPreferences.getInstance();

    // Önce should_start_foreground flag'ini temizle (tekrar başlatmasını engelle)
    await prefs.setBool('should_start_foreground', false);

    // Telefon kullanımı event'ini kaydet
    await prefs.setString('last_phone_pickup', DateTime.now().toIso8601String());
    await prefs.setBool('phone_in_use', true);

    // Eğer Foreground modundaysak, WorkManager moduna geç
    if (HybridLocationService.isForegroundMode) {
      debugPrint('[HomeScreen] Switching from Foreground to WorkManager mode');
      await HybridLocationService.stopForegroundMode();
      await HybridLocationService.startWorkManagerMode();
    }
  }

  /// Hibrit konum servisini başlat
  Future<void> _initHybridLocation() async {
    debugPrint('[HomeScreen] Initializing hybrid location service...');
    try {
      await HybridLocationService.initialize();
      await HybridLocationService.startWorkManagerMode();
      debugPrint('[HomeScreen] Hybrid location service started in WorkManager mode');

      // İlk konumu hemen gönder
      _sendInitialLocation();

      // Periyodik olarak foreground flag'i kontrol et (uygulama açıkken)
      _foregroundCheckTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        _checkForegroundFlag();
      });
    } catch (e) {
      debugPrint('[HomeScreen] Hybrid location service init error: $e');
    }
  }

  /// İlk konumu hemen gönder
  Future<void> _sendInitialLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return;

      final locationData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'speed': position.speed,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'heading': position.heading,
        'is_moving': position.speed > 2,
        'activity_type': position.speed * 3.6 > 30 ? 'driving' : (position.speed > 2 ? 'moving' : 'still'),
        'recorded_at': DateTime.now().toUtc().toIso8601String(),
      };

      final response = await http.post(
        Uri.parse('${ApiConstants.baseUrl}${ApiConstants.location}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(locationData),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('[HomeScreen] Initial location sent: ${position.latitude}, ${position.longitude}');
      }
    } catch (e) {
      debugPrint('[HomeScreen] Initial location send error: $e');
    }
  }

  /// WorkManager'dan foreground moduna geçiş flag'ini kontrol et
  Future<void> _checkForegroundFlag() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final shouldStartForeground = prefs.getBool('should_start_foreground') ?? false;

      // Son 5 dakika içinde telefon ele alındıysa foreground başlatma
      final lastPickup = prefs.getString('last_phone_pickup');
      if (lastPickup != null) {
        final pickupTime = DateTime.tryParse(lastPickup);
        if (pickupTime != null) {
          final minutesSincePickup = DateTime.now().difference(pickupTime).inMinutes;
          if (minutesSincePickup < 5) {
            debugPrint('[HomeScreen] Phone was picked up $minutesSincePickup min ago, skipping foreground');
            await prefs.setBool('should_start_foreground', false);
            return;
          }
        }
      }

      if (shouldStartForeground && !HybridLocationService.isForegroundMode) {
        debugPrint('[HomeScreen] Speed threshold reached, switching to Foreground mode');
        await HybridLocationService.startForegroundMode();
        await prefs.setBool('should_start_foreground', false);
      }
    } catch (e) {
      debugPrint('[HomeScreen] Foreground flag check error: $e');
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

  Future<void> _sendFcmToken() async {
    if (!mounted) return;
    // Send FCM token to server after login
    try {
      debugPrint('[HomeScreen] Sending FCM token to server...');
      final notificationService = context.read<NotificationService>();
      await notificationService.sendFcmTokenToServer();
      debugPrint('[HomeScreen] FCM token sent successfully');
    } catch (e) {
      debugPrint('[HomeScreen] Failed to send FCM token: $e');
    }
  }

  /// Cihaz bilgisi ve izin durumlarını backend'e gönder
  Future<void> _sendDeviceInfoAndPermissions() async {
    if (!mounted) return;

    try {
      debugPrint('[HomeScreen] Collecting device info and permissions...');
      final apiService = context.read<ApiService>();
      final notificationService = context.read<NotificationService>();

      // Paket bilgisi al
      final packageInfo = await PackageInfo.fromPlatform();

      // Cihaz bilgisi al
      final deviceInfo = DeviceInfoPlugin();
      String deviceModel = 'Unknown';
      String deviceOS = Platform.operatingSystem;
      String deviceOSVersion = 'Unknown';
      String deviceBrand = 'Unknown';

      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        deviceModel = androidInfo.model;
        deviceOSVersion = androidInfo.version.release;
        deviceBrand = androidInfo.brand;
        debugPrint('[HomeScreen] Android: $deviceBrand $deviceModel (Android $deviceOSVersion)');
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        deviceModel = iosInfo.model;
        deviceOSVersion = iosInfo.systemVersion;
        deviceBrand = 'Apple';
        debugPrint('[HomeScreen] iOS: $deviceBrand $deviceModel (iOS $deviceOSVersion)');
      }

      // İzin durumlarını al
      final locationPermission = await Permission.location.status;
      final locationAlwaysPermission = await Permission.locationAlways.status;
      final contactsPermission = await Permission.contacts.status;
      final phonePermission = await Permission.phone.status;
      final notificationPermission = await Permission.notification.status;

      // FCM token durumu
      final fcmToken = notificationService.fcmToken;

      debugPrint('[HomeScreen] Permissions - Location: $locationPermission, LocationAlways: $locationAlwaysPermission, Contacts: $contactsPermission, Phone: $phonePermission, Notification: $notificationPermission');
      debugPrint('[HomeScreen] FCM Token: ${fcmToken != null ? "EXISTS" : "NULL"}');

      // Backend'e gönder
      final data = {
        'app_version': packageInfo.version,
        'app_build_number': int.tryParse(packageInfo.buildNumber) ?? 0,
        'device_model': '$deviceBrand $deviceModel',
        'device_os': deviceOS,
        'device_os_version': deviceOSVersion,
        'push_enabled': notificationPermission.isGranted,
        'location_permission': _permissionStatusToString(locationPermission),
        'background_location_enabled': locationAlwaysPermission.isGranted,
        // Yeni izin alanları
        'contacts_permission': _permissionStatusToString(contactsPermission),
        'phone_permission': _permissionStatusToString(phonePermission),
        'notification_permission': _permissionStatusToString(notificationPermission),
        // FCM token da gönder
        'fcm_token': fcmToken ?? '',
      };

      debugPrint('[HomeScreen] Sending device info: $data');
      final response = await apiService.sendDeviceInfo(data);
      debugPrint('[HomeScreen] Device info sent, status: ${response.statusCode}');

    } catch (e, stackTrace) {
      debugPrint('[HomeScreen] Failed to send device info: $e');
      debugPrint('[HomeScreen] StackTrace: $stackTrace');
    }
  }

  String _permissionStatusToString(PermissionStatus status) {
    switch (status) {
      case PermissionStatus.granted:
        return 'granted';
      case PermissionStatus.denied:
        return 'denied';
      case PermissionStatus.permanentlyDenied:
        return 'permanently_denied';
      case PermissionStatus.restricted:
        return 'restricted';
      case PermissionStatus.limited:
        return 'limited';
      case PermissionStatus.provisional:
        return 'provisional';
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
                                  color: _getStatusColor(location.currentStatus).withValues(alpha: 0.1),
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
                          _buildInfoItem(
                            context,
                            Icons.gps_fixed,
                            'Konum Takibi',
                            location.isTracking ? 'Aktif' : 'Pasif',
                            location.isTracking ? AppColors.success : AppColors.error,
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
          color: color.withValues(alpha: 0.1),
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

  IconData _getStatusIcon(DriverStatus status) {
    switch (status) {
      case DriverStatus.home:
        return Icons.home;
      case DriverStatus.driving:
        return Icons.directions_car;
      case DriverStatus.stopped:
      case DriverStatus.unknown:
        return Icons.pause_circle;
    }
  }

  Color _getStatusColor(DriverStatus status) {
    switch (status) {
      case DriverStatus.home:
        return AppColors.success;
      case DriverStatus.driving:
        return AppColors.primary;
      case DriverStatus.stopped:
      case DriverStatus.unknown:
        return AppColors.warning;
    }
  }

  String _getStatusText(DriverStatus status) {
    switch (status) {
      case DriverStatus.home:
        return 'Evde';
      case DriverStatus.driving:
        return 'Seferde';
      case DriverStatus.stopped:
      case DriverStatus.unknown:
        return 'Mola';
    }
  }
}
