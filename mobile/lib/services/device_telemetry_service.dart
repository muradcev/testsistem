import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:battery_plus/battery_plus.dart';

/// Cihaz telemetri servisi
/// Ağ, sensör ve cihaz durumu bilgilerini toplar
class DeviceTelemetryService {
  static final DeviceTelemetryService _instance = DeviceTelemetryService._internal();
  factory DeviceTelemetryService() => _instance;
  DeviceTelemetryService._internal();

  // Sensör verileri için son değerler
  AccelerometerEvent? _lastAccelerometer;
  GyroscopeEvent? _lastGyroscope;
  MagnetometerEvent? _lastMagnetometer;

  // Sensör stream subscriptions
  StreamSubscription? _accelerometerSub;
  StreamSubscription? _gyroscopeSub;
  StreamSubscription? _magnetometerSub;

  // Son hareket algılama
  DateTime? _lastSignificantMovement;
  double _maxAcceleration = 0;

  /// Sensör dinlemeyi başlat
  void startSensorListening() {
    // Accelerometer - ani fren/kaza tespiti için
    _accelerometerSub = accelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 500),
    ).listen((event) {
      _lastAccelerometer = event;

      // Toplam ivme hesapla (G kuvveti)
      final totalAccel = _calculateTotalAcceleration(event);
      if (totalAccel > _maxAcceleration) {
        _maxAcceleration = totalAccel;
      }

      // Ani hareket tespiti (3G üstü = ciddi olay)
      if (totalAccel > 3.0) {
        _lastSignificantMovement = DateTime.now();
        debugPrint('[Telemetry] Significant acceleration detected: ${totalAccel.toStringAsFixed(2)}G');
      }
    });

    // Gyroscope - dönüş tespiti
    _gyroscopeSub = gyroscopeEventStream(
      samplingPeriod: const Duration(milliseconds: 500),
    ).listen((event) {
      _lastGyroscope = event;
    });

    // Magnetometer - pusula
    _magnetometerSub = magnetometerEventStream(
      samplingPeriod: const Duration(seconds: 1),
    ).listen((event) {
      _lastMagnetometer = event;
    });

    debugPrint('[Telemetry] Sensor listening started');
  }

  /// Sensör dinlemeyi durdur
  void stopSensorListening() {
    _accelerometerSub?.cancel();
    _gyroscopeSub?.cancel();
    _magnetometerSub?.cancel();
    debugPrint('[Telemetry] Sensor listening stopped');
  }

  /// Toplam ivmeyi hesapla (G cinsinden)
  double _calculateTotalAcceleration(AccelerometerEvent event) {
    // Yerçekimi çıkarılmış toplam ivme
    final x = event.x;
    final y = event.y;
    final z = event.z;
    final total = (x * x + y * y + z * z);
    // G cinsine çevir (9.8 m/s² = 1G)
    return (total / 9.8).abs();
  }

  /// Ağ bilgilerini al
  Future<Map<String, dynamic>> getNetworkInfo() async {
    final result = <String, dynamic>{};

    try {
      final connectivity = Connectivity();
      final connectivityResult = await connectivity.checkConnectivity();

      // Bağlantı tipi
      if (connectivityResult.contains(ConnectivityResult.wifi)) {
        result['connection_type'] = 'wifi';
      } else if (connectivityResult.contains(ConnectivityResult.mobile)) {
        result['connection_type'] = 'mobile';
      } else if (connectivityResult.contains(ConnectivityResult.ethernet)) {
        result['connection_type'] = 'ethernet';
      } else {
        result['connection_type'] = 'none';
      }

      // WiFi bilgileri
      if (result['connection_type'] == 'wifi') {
        final networkInfo = NetworkInfo();
        try {
          result['wifi_ssid'] = await networkInfo.getWifiName();
          result['wifi_bssid'] = await networkInfo.getWifiBSSID();
          result['wifi_ip'] = await networkInfo.getWifiIP();
        } catch (e) {
          debugPrint('[Telemetry] WiFi info error: $e');
        }
      }

      // IP adresi (mobil için de)
      if (result['wifi_ip'] == null) {
        try {
          final interfaces = await NetworkInterface.list();
          for (var interface in interfaces) {
            for (var addr in interface.addresses) {
              if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
                result['ip_address'] = addr.address;
                break;
              }
            }
          }
        } catch (e) {
          debugPrint('[Telemetry] IP address error: $e');
        }
      }
    } catch (e) {
      debugPrint('[Telemetry] Network info error: $e');
    }

    return result;
  }

  /// Operatör bilgisini al (Android)
  Future<Map<String, dynamic>> getCarrierInfo() async {
    final result = <String, dynamic>{};

    if (Platform.isAndroid) {
      try {
        final deviceInfo = DeviceInfoPlugin();
        final androidInfo = await deviceInfo.androidInfo;

        // Android'de operatör bilgisi doğrudan alınamıyor
        // Ancak TelephonyManager kullanarak alınabilir (native kod gerekir)
        // Şimdilik cihaz bilgilerini ekleyelim
        result['device_brand'] = androidInfo.brand;
        result['device_manufacturer'] = androidInfo.manufacturer;
        result['android_version'] = androidInfo.version.release;
        result['sdk_version'] = androidInfo.version.sdkInt;
      } catch (e) {
        debugPrint('[Telemetry] Carrier info error: $e');
      }
    }

    return result;
  }

  /// Sensör verilerini al
  Map<String, dynamic> getSensorData() {
    final result = <String, dynamic>{};

    // Accelerometer
    if (_lastAccelerometer != null) {
      result['accelerometer'] = {
        'x': _lastAccelerometer!.x,
        'y': _lastAccelerometer!.y,
        'z': _lastAccelerometer!.z,
        'total_g': _calculateTotalAcceleration(_lastAccelerometer!),
      };
    }

    // Gyroscope
    if (_lastGyroscope != null) {
      result['gyroscope'] = {
        'x': _lastGyroscope!.x,
        'y': _lastGyroscope!.y,
        'z': _lastGyroscope!.z,
      };
    }

    // Magnetometer (pusula)
    if (_lastMagnetometer != null) {
      result['magnetometer'] = {
        'x': _lastMagnetometer!.x,
        'y': _lastMagnetometer!.y,
        'z': _lastMagnetometer!.z,
      };

      // Pusula yönü hesapla (derece)
      final heading = _calculateHeading(_lastMagnetometer!);
      result['compass_heading'] = heading;
    }

    // Maksimum ivme (son reset'ten beri)
    result['max_acceleration_g'] = _maxAcceleration;

    // Son ciddi hareket zamanı
    if (_lastSignificantMovement != null) {
      result['last_significant_movement'] = _lastSignificantMovement!.toIso8601String();
    }

    return result;
  }

  /// Pusula yönünü hesapla (derece)
  double _calculateHeading(MagnetometerEvent event) {
    var heading = (180 / math.pi) * math.atan2(event.x, event.y);
    if (heading < 0) heading += 360;
    return heading;
  }

  /// Cihaz durumu bilgilerini al
  Future<Map<String, dynamic>> getDeviceState() async {
    final result = <String, dynamic>{};

    try {
      // Pil bilgileri
      final battery = Battery();
      result['battery_level'] = await battery.batteryLevel;

      final batteryState = await battery.batteryState;
      result['battery_state'] = batteryState.name;
      result['is_charging'] = batteryState == BatteryState.charging ||
                               batteryState == BatteryState.full;

      // Pil tasarruf modu (Android)
      if (Platform.isAndroid) {
        try {
          final isInBatterySaveMode = await battery.isInBatterySaveMode;
          result['power_save_mode'] = isInBatterySaveMode;
        } catch (e) {
          // Bazı cihazlarda desteklenmiyor
        }
      }
    } catch (e) {
      debugPrint('[Telemetry] Device state error: $e');
    }

    return result;
  }

  /// Tüm telemetri verilerini al
  Future<Map<String, dynamic>> collectAllTelemetry() async {
    final telemetry = <String, dynamic>{};

    // Ağ bilgileri
    final networkInfo = await getNetworkInfo();
    telemetry.addAll(networkInfo);

    // Operatör bilgileri
    final carrierInfo = await getCarrierInfo();
    telemetry.addAll(carrierInfo);

    // Sensör verileri
    final sensorData = getSensorData();
    if (sensorData.isNotEmpty) {
      telemetry['sensors'] = sensorData;
    }

    // Cihaz durumu
    final deviceState = await getDeviceState();
    telemetry.addAll(deviceState);

    // Timestamp
    telemetry['telemetry_collected_at'] = DateTime.now().toUtc().toIso8601String();

    return telemetry;
  }

  /// Maksimum ivmeyi sıfırla
  void resetMaxAcceleration() {
    _maxAcceleration = 0;
  }

  /// Servis temizliği
  void dispose() {
    stopSensorListening();
  }
}
