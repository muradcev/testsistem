import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'config/theme.dart';
// ignore: unused_import - Used in ErrorReportingService
import 'config/router.dart';
import 'config/constants.dart';
import 'providers/auth_provider.dart';
import 'providers/location_provider.dart';
import 'providers/vehicle_provider.dart';
import 'providers/questions_provider.dart';
import 'providers/theme_provider.dart';
import 'services/api_service.dart';
import 'services/location_service.dart';
import 'services/notification_service.dart';
import 'services/background_location_service.dart';
import 'services/error_reporting_service.dart';
import 'services/cache_service.dart';

void main() async {
  await runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Hive initialization
    await Hive.initFlutter();

    // Initialize Firebase
    try {
      await Firebase.initializeApp();

      // Initialize Crashlytics
      if (!kDebugMode) {
        FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
        await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(true);
      }
    } catch (e) {
      debugPrint('Firebase initialization failed: $e');
    }

    // Initialize Sentry
    await SentryFlutter.init(
      (options) {
        options.dsn = AppConstants.sentryDsn;
        options.tracesSampleRate = 1.0;
        options.environment = kDebugMode ? 'development' : 'production';
        options.attachScreenshot = true;
        options.attachViewHierarchy = true;
        options.enableAutoSessionTracking = true;
        options.enableNativeCrashHandling = true;
      },
    );

    // Set preferred orientations
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);

    // Initialize background location service
    try {
      await BackgroundLocationService.initialize();
    } catch (e) {
      debugPrint('Background location service initialization failed: $e');
      ErrorReportingService.reportError(e, StackTrace.current);
    }

    // Initialize services
    final apiService = ApiService();
    final locationService = LocationService();
    final notificationService = NotificationService();
    final cacheService = CacheService();
    await cacheService.init();

    // Connect notification service to API service for FCM token sending
    notificationService.setApiService(apiService);

    // Set navigation callback for notification taps
    notificationService.setNavigationCallback((route) {
      appRouter.go(route);
    });

    try {
      await notificationService.initialize();
    } catch (e) {
      debugPrint('Notification service initialization failed: $e');
      ErrorReportingService.reportError(e, StackTrace.current);
    }

    runApp(
      MultiProvider(
        providers: [
          Provider<ApiService>.value(value: apiService),
          Provider<LocationService>.value(value: locationService),
          Provider<NotificationService>.value(value: notificationService),
          Provider<CacheService>.value(value: cacheService),
          ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ChangeNotifierProvider(create: (_) => AuthProvider(apiService)),
          ChangeNotifierProvider(create: (_) => LocationProvider(locationService, apiService)),
          ChangeNotifierProvider(create: (_) => VehicleProvider(apiService, cacheService)),
          ChangeNotifierProvider(create: (_) => QuestionsProvider(apiService, cacheService)),
        ],
        child: const NakliyeoApp(),
      ),
    );
  }, (error, stack) {
    // Catch all uncaught errors
    ErrorReportingService.reportError(error, stack);
  });
}

class NakliyeoApp extends StatelessWidget {
  const NakliyeoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, _) {
        return MaterialApp.router(
          title: 'Nakliyeo Mobil',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeProvider.themeMode,
          routerConfig: appRouter,
          builder: (context, child) {
            // Wrap with error widget handler
            ErrorWidget.builder = (FlutterErrorDetails details) {
              ErrorReportingService.reportFlutterError(details);
              return _ErrorDisplayWidget(details: details);
            };

            return MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
              child: child!,
            );
          },
        );
      },
    );
  }
}

class _ErrorDisplayWidget extends StatelessWidget {
  final FlutterErrorDetails details;

  const _ErrorDisplayWidget({required this.details});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            const SizedBox(height: 16),
            const Text(
              'Bir hata oluştu',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Hata raporu otomatik olarak gönderildi.',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            if (kDebugMode) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(8),
                color: Colors.grey.shade100,
                child: Text(
                  details.exception.toString(),
                  style: const TextStyle(fontSize: 12, color: Colors.red),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
