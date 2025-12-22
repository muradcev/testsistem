class AppConstants {
  // Sentry DSN for error tracking
  static const String sentryDsn = 'https://75eaaac549d4287125159008e64ba183@o4510527205670912.ingest.de.sentry.io/4510527277301840';

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
  static const String checkPhone = '/auth/check-phone';
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
  static const String driverHomes = '/driver/homes';

  // Questions (Akıllı Soru Sistemi)
  static const String questionsPending = '/driver/questions/pending';
  static String answerQuestion(String id) => '/driver/questions/$id/answer';

  // Announcements (Duyurular)
  static const String announcements = '/driver/announcements';
  static String dismissAnnouncement(String id) => '/driver/announcements/$id/dismiss';

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
  // Akıllı konum takibi için
  static const String lastLatitude = 'last_latitude';
  static const String lastLongitude = 'last_longitude';
  static const String lastLocationTime = 'last_location_time';
  static const String lastSpeed = 'last_speed';
  static const String isMoving = 'is_moving';
  static const String bufferedLocations = 'buffered_locations';
  static const String lastSendTime = 'last_send_time';
  static const String tokenExpiresAt = 'token_expires_at';
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
