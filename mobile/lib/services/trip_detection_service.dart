import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';

import '../config/constants.dart';

/// Sefer durumu
enum TripState {
  idle,      // Hareket yok
  starting,  // Hareket başlıyor (onay bekleniyor)
  active,    // Sefer aktif
  ending,    // Sefer bitiyor (onay bekleniyor)
}

/// Sefer türü - hıza göre belirlenir
enum TripType {
  city,      // Şehir içi (ortalama hız < 40 km/h)
  highway,   // Şehirler arası (ortalama hız >= 40 km/h)
  longHaul,  // Uzun yol (mesafe > 200 km)
}

/// Akıllı sefer algılama sabitleri
/// KAMYON/TIR şoförleri için optimize edilmiştir
///
/// Dikkat edilmesi gerekenler:
/// - Uzun mesafe yolculukları (şehirlerarası, uluslararası)
/// - Yükleme/boşaltma beklemeleri (limanlarda saatlerce)
/// - Sınır kapısı beklemeleri (Habur, Kapıkule vs.)
/// - Yasal mola zorunlulukları (4.5 saat sürüş → 45 dk mola)
/// - Gece uyku molaları (8+ saat)
/// - TIR parkları, dinlenme tesisleri
/// - ŞOFÖRün EV ADRESİ - Eve gelince sefer biter!
class TripDetectionConfig {
  /// Seferin başlaması için minimum hız (km/h)
  /// TIR'lar yavaş hareket eder, düşük tutuyoruz
  static const double minSpeedToStart = 8.0;

  /// Seferin başlaması için minimum hareket süresi (dakika)
  /// Park içi manevralardan kaçınmak için
  static const int minMovingDurationMinutes = 5;

  /// Durma sayılması için maksimum hareket (metre)
  /// TIR parkı içi hareketler için geniş tutuyoruz
  static const double maxStopMovement = 150.0;

  /// Otomatik sefer başlatma etkin mi?
  static const bool autoStartEnabled = true;

  /// Otomatik sefer bitirme etkin mi?
  static const bool autoEndEnabled = true;

  // ============ KAMYON/TIR İÇİN DURMA EŞİKLERİ ============

  /// Şehir içi/kısa mesafe için durma eşiği (dakika)
  /// Yükleme/boşaltma beklemesi olabilir
  /// Ortalama hız < 40 km/h
  static const int cityStopMinutes = 45;

  /// Şehirler arası seyahat için durma eşiği (dakika)
  /// Mola, yakıt, yemek vs.
  /// Ortalama hız >= 40 km/h ve < 70 km/h
  static const int highwayStopMinutes = 90;

  /// Otoyol seyahati için durma eşiği (dakika)
  /// Yasal mola zorunluluğu (45 dk) + buffer
  /// Ortalama hız >= 70 km/h
  static const int motorwayStopMinutes = 120;

  /// Uzun yol için durma eşiği (dakika) - 3 saat
  /// Mesafe > 200 km - ciddi mola/dinlenme
  static const int longHaulStopMinutes = 180;

  /// Çok uzun yol için durma eşiği (dakika) - 5 saat
  /// Mesafe > 400 km - şoför uyuyabilir
  static const int veryLongHaulStopMinutes = 300;

  /// Ekstrem uzun yol için durma eşiği (dakika) - 8 saat
  /// Mesafe > 600 km - kesinlikle uyku molası
  static const int extremeLongHaulStopMinutes = 480;

  /// Gece saatlerinde ek bekleme süresi (dakika)
  /// 22:00 - 06:00 arası - uyku molası için
  static const int nightTimeExtraMinutes = 120;

  // ============ EV BÖLGESİ AYARLARI ============

  /// Ev bölgesi yarıçapı (metre)
  /// Bu mesafe içindeyse "evde" sayılır
  static const double homeZoneRadiusMeters = 500.0;

  /// Ev bölgesinde durma eşiği (dakika)
  /// Şoför eve geldiyse sefer muhtemelen bitmiştir
  /// Kısa tutuyoruz - 30 dakika yeterli
  static const int homeZoneStopMinutes = 30;

  /// Evden çıkış sonrası sefer başlangıcı için hareket süresi (dakika)
  /// Evden çıktıysa hızlıca sefer başlasın
  static const int homeZoneStartMinutes = 2;

  // ============ MESAFE EŞİKLERİ (KAMYON/TIR) ============

  /// Uzun yol sayılması için minimum mesafe (km)
  static const double longHaulDistanceKm = 200.0;

  /// Çok uzun yol sayılması için minimum mesafe (km)
  static const double veryLongHaulDistanceKm = 400.0;

  /// Ekstrem uzun yol için minimum mesafe (km)
  /// Uluslararası seferler, İstanbul-Habur gibi
  static const double extremeLongHaulDistanceKm = 600.0;

  // ============ HIZ EŞİKLERİ ============

  /// Şehir içi kabul edilen maksimum ortalama hız (km/h)
  static const double cityMaxAvgSpeed = 40.0;

  /// Otoyol kabul edilen minimum ortalama hız (km/h)
  /// TIR'lar genelde 80-90 km/h gider
  static const double motorwayMinAvgSpeed = 65.0;
}

/// Sefer algılama servisi
/// Akıllı algoritma ile hız ve mesafeye göre sefer durumunu belirler
class TripDetectionService {
  static const String _tripStateKey = 'trip_detection_state';
  static const String _tripStartTimeKey = 'trip_start_time';
  static const String _tripStartLocationKey = 'trip_start_location';
  static const String _lastStopTimeKey = 'trip_last_stop_time';
  static const String _movingStartTimeKey = 'trip_moving_start_time';
  static const String _tripStatsKey = 'trip_stats';

  static TripState _currentState = TripState.idle;
  static DateTime? _movingStartTime;
  static DateTime? _stopStartTime;
  static Function(TripState state, Map<String, dynamic>? data)? _onStateChange;

  // Sefer istatistikleri
  static double _totalDistanceKm = 0;
  static double _totalSpeedSum = 0;
  static int _speedSampleCount = 0;
  static double? _lastLatitude;
  static double? _lastLongitude;
  static double? _maxSpeedKmh;

  // Ev bölgesi koordinatları
  static double? _homeLatitude;
  static double? _homeLongitude;
  static bool _isInHomeZone = false;
  static const String _homeLatKey = 'trip_home_latitude';
  static const String _homeLonKey = 'trip_home_longitude';

  /// State değişikliği callback'i
  static void setStateChangeCallback(Function(TripState state, Map<String, dynamic>? data) callback) {
    _onStateChange = callback;
  }

  /// Mevcut sefer durumu
  static TripState get currentState => _currentState;

  /// Ortalama hız (km/h)
  static double get averageSpeedKmh =>
      _speedSampleCount > 0 ? _totalSpeedSum / _speedSampleCount : 0;

  /// Toplam kat edilen mesafe (km)
  static double get totalDistanceKm => _totalDistanceKm;

  /// Maksimum hız (km/h)
  static double get maxSpeedKmh => _maxSpeedKmh ?? 0;

  /// Sefer türünü belirle
  static TripType get tripType {
    // Önce mesafeye bak
    if (_totalDistanceKm >= TripDetectionConfig.longHaulDistanceKm) {
      return TripType.longHaul;
    }
    // Sonra hıza bak
    final avgSpeed = averageSpeedKmh;
    if (avgSpeed >= TripDetectionConfig.cityMaxAvgSpeed) {
      return TripType.highway;
    }
    return TripType.city;
  }

  /// Gece saati mi? (22:00 - 06:00)
  static bool get isNightTime {
    final hour = DateTime.now().hour;
    return hour >= 22 || hour < 6;
  }

  /// Ev bölgesinde mi?
  static bool get isInHomeZone => _isInHomeZone;

  /// Ev koordinatları tanımlı mı?
  static bool get hasHomeLocation =>
      _homeLatitude != null && _homeLongitude != null;

  /// Ev koordinatlarını ayarla
  static Future<void> setHomeLocation(double latitude, double longitude) async {
    _homeLatitude = latitude;
    _homeLongitude = longitude;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_homeLatKey, latitude);
    await prefs.setDouble(_homeLonKey, longitude);

    debugPrint('[TripDetection] Home location set: ($latitude, $longitude)');
  }

  /// Ev koordinatlarını yükle (SharedPreferences'tan)
  static Future<void> loadHomeLocation() async {
    final prefs = await SharedPreferences.getInstance();
    _homeLatitude = prefs.getDouble(_homeLatKey);
    _homeLongitude = prefs.getDouble(_homeLonKey);

    if (hasHomeLocation) {
      debugPrint('[TripDetection] Home location loaded: ($_homeLatitude, $_homeLongitude)');
    } else {
      debugPrint('[TripDetection] No home location set');
    }
  }

  /// Şoför profilinden ev koordinatlarını senkronize et
  /// Driver profile API'sinden home_latitude ve home_longitude alır
  static Future<void> syncHomeFromProfile(Map<String, dynamic>? profile) async {
    if (profile == null) return;

    final homeLat = profile['home_latitude'];
    final homeLon = profile['home_longitude'];

    if (homeLat != null && homeLon != null) {
      final lat = (homeLat is num) ? homeLat.toDouble() : double.tryParse(homeLat.toString());
      final lon = (homeLon is num) ? homeLon.toDouble() : double.tryParse(homeLon.toString());

      if (lat != null && lon != null && lat != 0 && lon != 0) {
        await setHomeLocation(lat, lon);
        debugPrint('[TripDetection] Home synced from profile: ($lat, $lon)');
      }
    }
  }

  /// Mevcut konumun ev bölgesinde olup olmadığını kontrol et
  static bool checkHomeZone(double latitude, double longitude) {
    if (!hasHomeLocation) {
      _isInHomeZone = false;
      return false;
    }

    final distanceToHome = Geolocator.distanceBetween(
      _homeLatitude!,
      _homeLongitude!,
      latitude,
      longitude,
    );

    _isInHomeZone = distanceToHome <= TripDetectionConfig.homeZoneRadiusMeters;

    if (_isInHomeZone) {
      debugPrint('[TripDetection] IN HOME ZONE - distance: ${distanceToHome.toStringAsFixed(0)}m');
    }

    return _isInHomeZone;
  }

  /// Dinamik durma eşiğini hesapla (dakika)
  /// Hız, mesafe ve zaman dilimine göre akıllıca belirlenir
  /// KAMYON/TIR şoförleri için optimize edilmiştir
  ///
  /// ÖNCELİK SIRASI:
  /// 1. EV BÖLGESİ - Eve geldiyse sefer biter (30 dk)
  /// 2. Mesafe bazlı (600km+, 400km+, 200km+)
  /// 3. Hız bazlı (otoyol, şehirlerarası, şehiriçi)
  /// 4. Gece bonusu (+2 saat)
  static int calculateStopThreshold() {
    int baseThreshold;

    // ÖNCELİK 1: EV BÖLGESİ KONTROLÜ
    // Şoför eve geldiyse sefer muhtemelen bitmiştir
    // Çok kısa eşik kullan (30 dakika)
    if (_isInHomeZone) {
      baseThreshold = TripDetectionConfig.homeZoneStopMinutes;
      debugPrint('[TripDetection] HOME ZONE DETECTED! Using short threshold: ${baseThreshold}min');
      // Ev bölgesinde gece bonusu uygulanmaz - eve geldiyse sefer bitmiştir
      return baseThreshold;
    }

    // Ekstrem uzun yol (600+ km) - uluslararası sefer, kesin uyku molası
    // Örnek: İstanbul → Habur (~1200 km)
    if (_totalDistanceKm >= TripDetectionConfig.extremeLongHaulDistanceKm) {
      baseThreshold = TripDetectionConfig.extremeLongHaulStopMinutes;
      debugPrint('[TripDetection] EXTREME long haul (${_totalDistanceKm.toStringAsFixed(1)} km) - using ${baseThreshold}min (8 saat) threshold');
    }
    // Çok uzun yol (400+ km) - şoför uyuyabilir
    // Örnek: İstanbul → Ankara → Adana (~900 km)
    else if (_totalDistanceKm >= TripDetectionConfig.veryLongHaulDistanceKm) {
      baseThreshold = TripDetectionConfig.veryLongHaulStopMinutes;
      debugPrint('[TripDetection] Very long haul (${_totalDistanceKm.toStringAsFixed(1)} km) - using ${baseThreshold}min (5 saat) threshold');
    }
    // Uzun yol (200+ km) - ciddi mola/dinlenme
    // Örnek: İstanbul → Ankara (~450 km)
    else if (_totalDistanceKm >= TripDetectionConfig.longHaulDistanceKm) {
      baseThreshold = TripDetectionConfig.longHaulStopMinutes;
      debugPrint('[TripDetection] Long haul (${_totalDistanceKm.toStringAsFixed(1)} km) - using ${baseThreshold}min (3 saat) threshold');
    }
    // Hıza göre belirle
    else {
      final avgSpeed = averageSpeedKmh;
      if (avgSpeed >= TripDetectionConfig.motorwayMinAvgSpeed) {
        // Otoyol - TIR 80-90 km/h
        baseThreshold = TripDetectionConfig.motorwayStopMinutes;
        debugPrint('[TripDetection] Motorway speed (${avgSpeed.toStringAsFixed(1)} km/h) - using ${baseThreshold}min (2 saat) threshold');
      } else if (avgSpeed >= TripDetectionConfig.cityMaxAvgSpeed) {
        // Şehirler arası - ara yollar
        baseThreshold = TripDetectionConfig.highwayStopMinutes;
        debugPrint('[TripDetection] Highway speed (${avgSpeed.toStringAsFixed(1)} km/h) - using ${baseThreshold}min (1.5 saat) threshold');
      } else {
        // Şehir içi / yükleme-boşaltma bölgesi
        baseThreshold = TripDetectionConfig.cityStopMinutes;
        debugPrint('[TripDetection] City/loading speed (${avgSpeed.toStringAsFixed(1)} km/h) - using ${baseThreshold}min (45 dk) threshold');
      }
    }

    // Gece saatiyse ek süre ekle (şoför uyku molası)
    // 22:00 - 06:00 arası +2 saat
    if (isNightTime) {
      final nightExtra = TripDetectionConfig.nightTimeExtraMinutes;
      baseThreshold += nightExtra;
      debugPrint('[TripDetection] Night time (22:00-06:00): +${nightExtra}min -> total ${baseThreshold}min');
    }

    return baseThreshold;
  }

  /// Konum değişikliğinde sefer istatistiklerini güncelle
  static void _updateTripStats(Position position) {
    final speedKmh = position.speed * 3.6;

    // Hız örneklemesi (hareket ediyorsa)
    if (speedKmh > 2) {
      _totalSpeedSum += speedKmh;
      _speedSampleCount++;

      // Maksimum hızı güncelle
      if (_maxSpeedKmh == null || speedKmh > _maxSpeedKmh!) {
        _maxSpeedKmh = speedKmh;
      }
    }

    // Mesafe hesapla
    if (_lastLatitude != null && _lastLongitude != null) {
      final distanceMeters = Geolocator.distanceBetween(
        _lastLatitude!,
        _lastLongitude!,
        position.latitude,
        position.longitude,
      );
      _totalDistanceKm += distanceMeters / 1000;
    }

    _lastLatitude = position.latitude;
    _lastLongitude = position.longitude;
  }

  /// Sefer istatistiklerini sıfırla
  static void _resetTripStats() {
    _totalDistanceKm = 0;
    _totalSpeedSum = 0;
    _speedSampleCount = 0;
    _lastLatitude = null;
    _lastLongitude = null;
    _maxSpeedKmh = null;
  }

  /// Sefer istatistiklerini kaydet
  static Future<void> _saveTripStats(SharedPreferences prefs) async {
    await prefs.setString(_tripStatsKey, json.encode({
      'totalDistanceKm': _totalDistanceKm,
      'totalSpeedSum': _totalSpeedSum,
      'speedSampleCount': _speedSampleCount,
      'lastLatitude': _lastLatitude,
      'lastLongitude': _lastLongitude,
      'maxSpeedKmh': _maxSpeedKmh,
    }));
  }

  /// Sefer istatistiklerini yükle
  static Future<void> _loadTripStats(SharedPreferences prefs) async {
    final statsStr = prefs.getString(_tripStatsKey);
    if (statsStr != null) {
      final stats = json.decode(statsStr);
      _totalDistanceKm = (stats['totalDistanceKm'] ?? 0).toDouble();
      _totalSpeedSum = (stats['totalSpeedSum'] ?? 0).toDouble();
      _speedSampleCount = stats['speedSampleCount'] ?? 0;
      _lastLatitude = stats['lastLatitude']?.toDouble();
      _lastLongitude = stats['lastLongitude']?.toDouble();
      _maxSpeedKmh = stats['maxSpeedKmh']?.toDouble();
    }
  }

  /// Servisi başlat
  static Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final stateStr = prefs.getString(_tripStateKey);
    if (stateStr != null) {
      _currentState = TripState.values.firstWhere(
        (s) => s.name == stateStr,
        orElse: () => TripState.idle,
      );
    }

    final movingTimeStr = prefs.getString(_movingStartTimeKey);
    if (movingTimeStr != null) {
      _movingStartTime = DateTime.tryParse(movingTimeStr);
    }

    final stopTimeStr = prefs.getString(_lastStopTimeKey);
    if (stopTimeStr != null) {
      _stopStartTime = DateTime.tryParse(stopTimeStr);
    }

    // Aktif sefer varsa istatistikleri yükle
    if (_currentState == TripState.active || _currentState == TripState.ending) {
      await _loadTripStats(prefs);
    }

    // Ev koordinatlarını yükle
    await loadHomeLocation();

    debugPrint('[TripDetection] Initialized - state: $_currentState, distance: ${_totalDistanceKm.toStringAsFixed(1)}km, avgSpeed: ${averageSpeedKmh.toStringAsFixed(1)}km/h, hasHome: $hasHomeLocation');
  }

  /// Konum güncellemesi ile sefer durumunu kontrol et
  static Future<TripState> checkLocation(Position position, {bool isMoving = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final now = DateTime.now();
    final speedKmh = position.speed * 3.6;

    // Ev bölgesi kontrolü - her konum güncellemesinde
    final wasInHomeZone = _isInHomeZone;
    checkHomeZone(position.latitude, position.longitude);

    // Evden çıkış algılama - sefer başlangıcını hızlandır
    if (wasInHomeZone && !_isInHomeZone && _currentState == TripState.idle) {
      debugPrint('[TripDetection] LEFT HOME ZONE - watching for trip start');
    }

    switch (_currentState) {
      case TripState.idle:
        // Hareket başladı mı?
        if (isMoving && speedKmh >= TripDetectionConfig.minSpeedToStart) {
          if (_movingStartTime == null) {
            _movingStartTime = now;
            await prefs.setString(_movingStartTimeKey, now.toIso8601String());
            debugPrint('[TripDetection] Movement detected, tracking...');
          } else {
            final movingDuration = now.difference(_movingStartTime!).inMinutes;
            // Evden çıktıysa daha kısa sürede sefer başlasın
            final requiredMinutes = !_isInHomeZone && hasHomeLocation
                ? TripDetectionConfig.homeZoneStartMinutes
                : TripDetectionConfig.minMovingDurationMinutes;

            if (movingDuration >= requiredMinutes) {
              // Yeterince uzun süredir hareket ediyor - sefer başlasın mı?
              if (TripDetectionConfig.autoStartEnabled) {
                await _startTrip(prefs, position);
              } else {
                _currentState = TripState.starting;
                await prefs.setString(_tripStateKey, _currentState.name);
                _notifyStateChange({'latitude': position.latitude, 'longitude': position.longitude});
              }
            }
          }
        } else {
          // Durdu - hareket süresini sıfırla
          _movingStartTime = null;
          await prefs.remove(_movingStartTimeKey);
        }
        break;

      case TripState.starting:
        // Kullanıcı onayı bekleniyor
        // Hareket devam ediyor mu kontrol et
        if (!isMoving || speedKmh < TripDetectionConfig.minSpeedToStart / 2) {
          // Durdu - idle'a dön
          _currentState = TripState.idle;
          _movingStartTime = null;
          await prefs.setString(_tripStateKey, _currentState.name);
          await prefs.remove(_movingStartTimeKey);
          debugPrint('[TripDetection] Movement stopped before confirmation');
        }
        break;

      case TripState.active:
        // Sefer aktif - istatistikleri güncelle
        _updateTripStats(position);
        await _saveTripStats(prefs);

        // Duruş kontrolü
        if (!isMoving && speedKmh < 2) {
          if (_stopStartTime == null) {
            _stopStartTime = now;
            await prefs.setString(_lastStopTimeKey, now.toIso8601String());
            debugPrint('[TripDetection] Stop detected - distance: ${_totalDistanceKm.toStringAsFixed(1)}km, avgSpeed: ${averageSpeedKmh.toStringAsFixed(1)}km/h');
          } else {
            final stopDuration = now.difference(_stopStartTime!).inMinutes;
            // DİNAMİK EŞİK: Hız ve mesafeye göre hesapla
            final stopThreshold = calculateStopThreshold();

            if (stopDuration >= stopThreshold) {
              // Yeterince uzun süredir durdu - sefer bitsin mi?
              debugPrint('[TripDetection] Stop threshold reached: ${stopDuration}min >= ${stopThreshold}min');
              if (TripDetectionConfig.autoEndEnabled) {
                await _endTrip(prefs, position);
              } else {
                _currentState = TripState.ending;
                await prefs.setString(_tripStateKey, _currentState.name);
                _notifyStateChange({
                  'latitude': position.latitude,
                  'longitude': position.longitude,
                  'stop_duration_minutes': stopDuration,
                  'threshold_minutes': stopThreshold,
                  'total_distance_km': _totalDistanceKm,
                  'avg_speed_kmh': averageSpeedKmh,
                });
              }
            } else {
              // Henüz eşiğe ulaşılmadı - kalan süreyi logla
              final remaining = stopThreshold - stopDuration;
              if (stopDuration % 5 == 0 && stopDuration > 0) {
                debugPrint('[TripDetection] Stopped for ${stopDuration}min, ${remaining}min until trip end (threshold: ${stopThreshold}min)');
              }
            }
          }
        } else {
          // Hareket ediyor - duruş süresini sıfırla
          if (_stopStartTime != null) {
            debugPrint('[TripDetection] Movement resumed - trip continues');
          }
          _stopStartTime = null;
          await prefs.remove(_lastStopTimeKey);
        }
        break;

      case TripState.ending:
        // Kullanıcı onayı bekleniyor
        // Tekrar hareket etmeye başladı mı?
        if (isMoving && speedKmh >= TripDetectionConfig.minSpeedToStart) {
          // Hareket etti - aktif duruma geri dön
          _currentState = TripState.active;
          _stopStartTime = null;
          await prefs.setString(_tripStateKey, _currentState.name);
          await prefs.remove(_lastStopTimeKey);
          debugPrint('[TripDetection] Movement resumed, trip continues');
        }
        break;
    }

    return _currentState;
  }

  /// Seferi başlat
  static Future<void> _startTrip(SharedPreferences prefs, Position position) async {
    _currentState = TripState.active;
    _movingStartTime = null;
    _stopStartTime = null;

    // Sefer istatistiklerini sıfırla ve başlat
    _resetTripStats();
    _lastLatitude = position.latitude;
    _lastLongitude = position.longitude;
    await _saveTripStats(prefs);

    await prefs.setString(_tripStateKey, _currentState.name);
    await prefs.setString(_tripStartTimeKey, DateTime.now().toIso8601String());
    await prefs.setString(_tripStartLocationKey, json.encode({
      'latitude': position.latitude,
      'longitude': position.longitude,
    }));
    await prefs.remove(_movingStartTimeKey);

    debugPrint('[TripDetection] Trip started automatically at (${position.latitude}, ${position.longitude})');

    // Sunucuya bildir
    await _notifyServer('trip_started', {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'started_at': DateTime.now().toUtc().toIso8601String(),
    });

    _notifyStateChange({
      'latitude': position.latitude,
      'longitude': position.longitude,
      'started_at': DateTime.now().toIso8601String(),
    });
  }

  /// Seferi bitir
  static Future<void> _endTrip(SharedPreferences prefs, Position position) async {
    final startTimeStr = prefs.getString(_tripStartTimeKey);
    final startLocationStr = prefs.getString(_tripStartLocationKey);

    // Sefer istatistiklerini kaydet (temizlemeden önce)
    final finalDistanceKm = _totalDistanceKm;
    final finalAvgSpeedKmh = averageSpeedKmh;
    final finalMaxSpeedKmh = _maxSpeedKmh ?? 0;
    final tripTypeStr = tripType.name;

    _currentState = TripState.idle;
    _movingStartTime = null;
    _stopStartTime = null;

    await prefs.setString(_tripStateKey, _currentState.name);
    await prefs.remove(_tripStartTimeKey);
    await prefs.remove(_tripStartLocationKey);
    await prefs.remove(_lastStopTimeKey);
    await prefs.remove(_movingStartTimeKey);
    await prefs.remove(_tripStatsKey);

    // İstatistikleri sıfırla
    _resetTripStats();

    debugPrint('[TripDetection] Trip ended - total: ${finalDistanceKm.toStringAsFixed(1)}km, avgSpeed: ${finalAvgSpeedKmh.toStringAsFixed(1)}km/h, maxSpeed: ${finalMaxSpeedKmh.toStringAsFixed(1)}km/h, type: $tripTypeStr');

    // Sefer verilerini hesapla
    Map<String, dynamic> tripData = {
      'end_latitude': position.latitude,
      'end_longitude': position.longitude,
      'ended_at': DateTime.now().toUtc().toIso8601String(),
      // Akıllı sefer istatistikleri
      'total_distance_km': finalDistanceKm,
      'avg_speed_kmh': finalAvgSpeedKmh,
      'max_speed_kmh': finalMaxSpeedKmh,
      'trip_type': tripTypeStr,
    };

    if (startTimeStr != null) {
      final startTime = DateTime.tryParse(startTimeStr);
      if (startTime != null) {
        tripData['started_at'] = startTime.toUtc().toIso8601String();
        tripData['duration_minutes'] = DateTime.now().difference(startTime).inMinutes;
      }
    }

    if (startLocationStr != null) {
      final startLoc = json.decode(startLocationStr);
      tripData['start_latitude'] = startLoc['latitude'];
      tripData['start_longitude'] = startLoc['longitude'];

      // Kuş uçuşu mesafe (karşılaştırma için)
      final straightLineDistance = Geolocator.distanceBetween(
        startLoc['latitude'],
        startLoc['longitude'],
        position.latitude,
        position.longitude,
      );
      tripData['straight_line_distance_km'] = straightLineDistance / 1000;
    }

    // Sunucuya bildir
    await _notifyServer('trip_ended', tripData);

    _notifyStateChange(tripData);
  }

  /// Manuel sefer başlat
  static Future<void> startTripManually(Position position) async {
    final prefs = await SharedPreferences.getInstance();
    await _startTrip(prefs, position);
  }

  /// Manuel sefer bitir
  static Future<void> endTripManually(Position position) async {
    final prefs = await SharedPreferences.getInstance();
    await _endTrip(prefs, position);
  }

  /// Sefer başlama önerisini onayla
  static Future<void> confirmTripStart(Position position) async {
    if (_currentState == TripState.starting) {
      final prefs = await SharedPreferences.getInstance();
      await _startTrip(prefs, position);
    }
  }

  /// Sefer bitiş önerisini onayla
  static Future<void> confirmTripEnd(Position position) async {
    if (_currentState == TripState.ending) {
      final prefs = await SharedPreferences.getInstance();
      await _endTrip(prefs, position);
    }
  }

  /// Sefer önerisini reddet
  static Future<void> dismissSuggestion() async {
    final prefs = await SharedPreferences.getInstance();

    if (_currentState == TripState.starting) {
      _currentState = TripState.idle;
      _movingStartTime = null;
      await prefs.remove(_movingStartTimeKey);
    } else if (_currentState == TripState.ending) {
      _currentState = TripState.active;
      _stopStartTime = null;
      await prefs.remove(_lastStopTimeKey);
    }

    await prefs.setString(_tripStateKey, _currentState.name);
  }

  /// State değişikliğini bildir
  static void _notifyStateChange(Map<String, dynamic>? data) {
    _onStateChange?.call(_currentState, data);
  }

  /// Sunucuya bildir
  static Future<void> _notifyServer(String eventType, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString(StorageKeys.accessToken);
      if (accessToken == null) return;

      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      ));

      await dio.post('/driver/trip-events', data: {
        'event_type': eventType,
        ...data,
      });

      debugPrint('[TripDetection] Server notified: $eventType');
    } catch (e) {
      debugPrint('[TripDetection] Server notification failed: $e');
    }
  }

  /// Aktif sefer var mı?
  static bool get hasActiveTrip => _currentState == TripState.active;

  /// Sefer başlangıç zamanını getir
  static Future<DateTime?> getTripStartTime() async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_tripStartTimeKey);
    return str != null ? DateTime.tryParse(str) : null;
  }

  /// Sefer başlangıç konumunu getir
  static Future<Map<String, double>?> getTripStartLocation() async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_tripStartLocationKey);
    if (str != null) {
      final data = json.decode(str);
      return {
        'latitude': data['latitude'],
        'longitude': data['longitude'],
      };
    }
    return null;
  }
}
