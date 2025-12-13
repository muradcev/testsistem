class AppConstants {
  // Sentry DSN - Get this from your Sentry project settings
  // Create a project at https://sentry.io and paste your DSN here
  static const String sentryDsn = 'https://your-dsn@sentry.io/project-id';

  // App info
  static const String appName = 'Nakliyeo Mobil';
  static const String appVersion = '1.0.0';
}

class ApiConstants {
  static const String baseUrl = 'https://testsistem-production.up.railway.app/api/v1';
  static const String wsUrl = 'wss://testsistem-production.up.railway.app/ws';

  // Endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String refreshToken = '/auth/refresh';

  static const String profile = '/driver/profile';
  static const String fcmToken = '/driver/fcm-token';
  static const String deviceInfo = '/driver/device-info';
  static const String vehicles = '/driver/vehicles';
  static const String trailers = '/driver/trailers';
  static const String location = '/driver/location';
  static const String locationBatch = '/driver/location/batch';
  static const String surveys = '/driver/surveys/pending';

  // Questions (Akıllı Soru Sistemi)
  static const String questionsPending = '/driver/questions/pending';
  static String answerQuestion(String id) => '/driver/questions/$id/answer';

  static const String provinces = '/locations/provinces';
  static String districts(String province) => '/locations/districts/$province';
  static String neighborhoods(String province, String district) =>
      '/locations/neighborhoods/$province/$district';
}

class StorageKeys {
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String userId = 'user_id';
  static const String userPhone = 'user_phone';
  static const String isLoggedIn = 'is_logged_in';
  static const String pendingLocations = 'pending_locations';
}

class LocationConstants {
  // Konum alma aralıkları (saniye)
  static const int intervalMoving = 30;
  static const int intervalStopped = 300; // 5 dakika
  static const int intervalHome = 1800; // 30 dakika
  static const int intervalNight = 3600; // 1 saat

  // Mesafe eşikleri (metre)
  static const double homeRadius = 200;
  static const double stopThreshold = 50;
  static const double movementThreshold = 10;

  // Zaman eşikleri
  static const int stopDurationThreshold = 300; // 5 dakika
}

class VehicleTypes {
  static const Map<String, String> types = {
    'kamyon': 'Kamyon',
    'tir': 'TIR (Çekici)',
    'kamyonet': 'Kamyonet',
  };
}

class TrailerTypes {
  static const Map<String, String> types = {
    'tenteli': 'Tenteli (Perdeli)',
    'kapali_kasa': 'Kapalı Kasa',
    'acik_kasa': 'Açık Kasa',
    'frigorifik': 'Frigorifik (Soğutmalı)',
    'tanker': 'Tanker (Sıvı)',
    'silobas': 'Silobas (Toz/Granül)',
    'lowbed': 'Lowbed (Alçak)',
    'konteyner': 'Konteyner Taşıyıcı',
    'damperli': 'Damperli',
    'arac_tasiyici': 'Araç Taşıyıcı',
    'sal': 'Sal (Flatbed)',
  };
}

class VehicleBrands {
  static const List<String> brands = [
    'Mercedes-Benz',
    'MAN',
    'Volvo',
    'Scania',
    'DAF',
    'Iveco',
    'Renault',
    'Ford',
    'BMC',
    'Isuzu',
    'Mitsubishi',
    'Hino',
    'Hyundai',
    'Fuso',
    'Diğer',
  ];
}
