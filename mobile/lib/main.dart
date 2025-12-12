import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'config/theme.dart';
import 'config/router.dart';
import 'providers/auth_provider.dart';
import 'providers/location_provider.dart';
import 'providers/vehicle_provider.dart';
import 'providers/questions_provider.dart';
import 'services/api_service.dart';
import 'services/location_service.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Hive initialization
  await Hive.initFlutter();

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize services
  final apiService = ApiService();
  final locationService = LocationService();
  final notificationService = NotificationService();

  await notificationService.initialize();

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: apiService),
        Provider<LocationService>.value(value: locationService),
        Provider<NotificationService>.value(value: notificationService),
        ChangeNotifierProvider(create: (_) => AuthProvider(apiService)),
        ChangeNotifierProvider(create: (_) => LocationProvider(locationService, apiService)),
        ChangeNotifierProvider(create: (_) => VehicleProvider(apiService)),
        ChangeNotifierProvider(create: (_) => QuestionsProvider(apiService)),
      ],
      child: const NakliyeoApp(),
    ),
  );
}

class NakliyeoApp extends StatelessWidget {
  const NakliyeoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Nakliyeo Mobil',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: appRouter,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
          child: child!,
        );
      },
    );
  }
}
