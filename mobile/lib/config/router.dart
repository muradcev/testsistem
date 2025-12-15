import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/otp_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/vehicles/vehicles_screen.dart';
import '../screens/vehicles/add_vehicle_screen.dart';
import '../screens/surveys/survey_screen.dart';
import '../screens/questions/questions_screen.dart';
import '../screens/map/map_screen.dart';
import '../screens/permissions/permission_request_screen.dart';
import '../services/permission_service.dart';
import 'constants.dart';

// Global navigator key for notification navigation
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

// Auth state notifier for router refresh
class AuthNotifier extends ChangeNotifier {
  bool _isLoggedIn = false;
  bool _isInitialized = false;
  bool _permissionsRequested = false;

  bool get isLoggedIn => _isLoggedIn;
  bool get isInitialized => _isInitialized;
  bool get permissionsRequested => _permissionsRequested;

  AuthNotifier() {
    _checkAuthState();
  }

  Future<void> _checkAuthState() async {
    final prefs = await SharedPreferences.getInstance();
    _isLoggedIn = prefs.getBool(StorageKeys.isLoggedIn) ?? false;
    final token = prefs.getString(StorageKeys.accessToken);
    // Token yoksa giriş yapılmamış sayılır
    if (token == null || token.isEmpty) {
      _isLoggedIn = false;
    }
    // İzinlerin istenip istenmediğini kontrol et
    _permissionsRequested = await PermissionService.hasRequestedPermissions();
    _isInitialized = true;
    notifyListeners();
  }

  void setLoggedIn(bool value) {
    _isLoggedIn = value;
    notifyListeners();
  }

  void setPermissionsRequested(bool value) {
    _permissionsRequested = value;
    notifyListeners();
  }

  Future<void> refreshPermissionState() async {
    _permissionsRequested = await PermissionService.hasRequestedPermissions();
    notifyListeners();
  }
}

final authNotifier = AuthNotifier();

final appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/',
  refreshListenable: authNotifier,
  observers: [SentryNavigatorObserver()],
  redirect: (context, state) {
    final isLoggedIn = authNotifier.isLoggedIn;
    final isInitialized = authNotifier.isInitialized;
    final permissionsRequested = authNotifier.permissionsRequested;
    final isAuthRoute = state.matchedLocation == '/login' ||
                        state.matchedLocation == '/register' ||
                        state.matchedLocation.startsWith('/otp');
    final isPermissionsRoute = state.matchedLocation == '/permissions';

    // Henüz başlatılmadıysa bekle
    if (!isInitialized) {
      return null;
    }

    // Giriş yapmış ve auth sayfasındaysa
    if (isLoggedIn && isAuthRoute) {
      // İzinler istenmemişse izin ekranına yönlendir
      if (!permissionsRequested) {
        return '/permissions';
      }
      return '/home';
    }

    // Giriş yapmış ama izinler istenmemişse ve izin sayfasında değilse
    if (isLoggedIn && !permissionsRequested && !isPermissionsRoute && !isAuthRoute) {
      return '/permissions';
    }

    // Giriş yapmamış ve korumalı sayfadaysa logine yönlendir
    if (!isLoggedIn && !isAuthRoute && state.matchedLocation != '/') {
      return '/login';
    }

    // Root path için yönlendirme
    if (state.matchedLocation == '/') {
      if (!isLoggedIn) {
        return '/login';
      }
      if (!permissionsRequested) {
        return '/permissions';
      }
      return '/home';
    }

    return null;
  },
  routes: [
    // Splash/Root route
    GoRoute(
      path: '/',
      builder: (context, state) => const _SplashScreen(),
    ),
    // Auth routes
    GoRoute(
      path: '/login',
      name: 'login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      name: 'register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/otp',
      name: 'otp',
      builder: (context, state) {
        final phone = state.extra as String?;
        return OTPScreen(phone: phone ?? '');
      },
    ),

    // Permissions route
    GoRoute(
      path: '/permissions',
      name: 'permissions',
      builder: (context, state) => const PermissionRequestScreen(),
    ),

    // Main app routes
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/home',
          name: 'home',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/vehicles',
          name: 'vehicles',
          builder: (context, state) => const VehiclesScreen(),
          routes: [
            GoRoute(
              path: 'add',
              name: 'add-vehicle',
              builder: (context, state) => const AddVehicleScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/profile',
          name: 'profile',
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/questions',
          name: 'questions',
          builder: (context, state) => const QuestionsScreen(),
        ),
        GoRoute(
          path: '/map',
          name: 'map',
          builder: (context, state) => const MapScreen(),
        ),
      ],
    ),

    // Survey route
    GoRoute(
      path: '/survey/:id',
      name: 'survey',
      builder: (context, state) {
        final surveyId = state.pathParameters['id']!;
        return SurveyScreen(surveyId: surveyId);
      },
    ),
  ],
);

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final String location = GoRouterState.of(context).uri.path;
    if (location.startsWith('/home')) return 0;
    if (location.startsWith('/vehicles')) return 1;
    if (location.startsWith('/profile')) return 2;
    if (location.startsWith('/questions')) return 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.goNamed('home');
              break;
            case 1:
              context.goNamed('vehicles');
              break;
            case 2:
              context.goNamed('profile');
              break;
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Ana Sayfa',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping),
            label: 'Araçlarım',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outlined),
            selectedIcon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}

// Simple splash screen while checking auth
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
