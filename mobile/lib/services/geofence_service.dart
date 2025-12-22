import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';

import '../config/constants.dart';

/// Geofence bölge modeli
class GeofenceZone {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final double radiusMeters;
  final String type; // 'depot', 'customer', 'restricted', 'delivery_point'
  final bool notifyOnEnter;
  final bool notifyOnExit;

  GeofenceZone({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    this.type = 'general',
    this.notifyOnEnter = true,
    this.notifyOnExit = true,
  });

  factory GeofenceZone.fromJson(Map<String, dynamic> json) {
    return GeofenceZone(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      radiusMeters: (json['radius_meters'] ?? json['radius'] ?? 100).toDouble(),
      type: json['type'] ?? 'general',
      notifyOnEnter: json['notify_on_enter'] ?? true,
      notifyOnExit: json['notify_on_exit'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'latitude': latitude,
    'longitude': longitude,
    'radius_meters': radiusMeters,
    'type': type,
    'notify_on_enter': notifyOnEnter,
    'notify_on_exit': notifyOnExit,
  };

  /// Konum bu bölgenin içinde mi?
  bool containsLocation(double lat, double lon) {
    final distance = Geolocator.distanceBetween(latitude, longitude, lat, lon);
    return distance <= radiusMeters;
  }
}

/// Geofence olay türü
enum GeofenceEventType { enter, exit, dwell }

/// Geofence olayı
class GeofenceEvent {
  final GeofenceZone zone;
  final GeofenceEventType eventType;
  final DateTime timestamp;
  final double latitude;
  final double longitude;

  GeofenceEvent({
    required this.zone,
    required this.eventType,
    required this.timestamp,
    required this.latitude,
    required this.longitude,
  });

  Map<String, dynamic> toJson() => {
    'zone_id': zone.id,
    'zone_name': zone.name,
    'zone_type': zone.type,
    'event_type': eventType.name,
    'timestamp': timestamp.toUtc().toIso8601String(),
    'latitude': latitude,
    'longitude': longitude,
  };
}

/// Geofence servisi - Bölgeye giriş/çıkış takibi
class GeofenceService {
  static const String _zonesKey = 'geofence_zones';
  static const String _zoneStatesKey = 'geofence_zone_states';
  static const String _pendingEventsKey = 'geofence_pending_events';
  static const String _lastSyncKey = 'geofence_last_sync';

  static List<GeofenceZone> _zones = [];
  static Map<String, bool> _zoneStates = {}; // zone_id -> isInside
  static Function(GeofenceEvent)? _onGeofenceEvent;

  /// Geofence callback'ini ayarla
  static void setGeofenceCallback(Function(GeofenceEvent) callback) {
    _onGeofenceEvent = callback;
  }

  /// Servisi başlat ve bölgeleri yükle
  static Future<void> initialize() async {
    debugPrint('[Geofence] Initializing...');
    final prefs = await SharedPreferences.getInstance();

    // Kayıtlı bölgeleri yükle
    await _loadZones(prefs);

    // Kayıtlı durumları yükle
    await _loadZoneStates(prefs);

    debugPrint('[Geofence] Initialized with ${_zones.length} zones');
  }

  /// Bölgeleri sunucudan senkronize et
  static Future<void> syncZonesFromServer(String accessToken) async {
    try {
      debugPrint('[Geofence] Syncing zones from server...');

      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      ));

      final response = await dio.get('/driver/geofences');

      if (response.statusCode == 200) {
        final List<dynamic> zonesJson = response.data['geofences'] ?? response.data ?? [];
        _zones = zonesJson.map((z) => GeofenceZone.fromJson(z)).toList();

        // Kaydet
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_zonesKey, json.encode(_zones.map((z) => z.toJson()).toList()));
        await prefs.setString(_lastSyncKey, DateTime.now().toIso8601String());

        debugPrint('[Geofence] Synced ${_zones.length} zones from server');
      }
    } catch (e) {
      debugPrint('[Geofence] Sync error: $e');
    }
  }

  /// Manuel bölge ekle (test veya lokal kullanım için)
  static Future<void> addZone(GeofenceZone zone) async {
    _zones.add(zone);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_zonesKey, json.encode(_zones.map((z) => z.toJson()).toList()));
    debugPrint('[Geofence] Added zone: ${zone.name}');
  }

  /// Bölge sil
  static Future<void> removeZone(String zoneId) async {
    _zones.removeWhere((z) => z.id == zoneId);
    _zoneStates.remove(zoneId);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_zonesKey, json.encode(_zones.map((z) => z.toJson()).toList()));
    await prefs.setString(_zoneStatesKey, json.encode(_zoneStates));

    debugPrint('[Geofence] Removed zone: $zoneId');
  }

  /// Konumu kontrol et ve gerekirse olay tetikle
  static Future<List<GeofenceEvent>> checkLocation(double latitude, double longitude) async {
    final events = <GeofenceEvent>[];
    final prefs = await SharedPreferences.getInstance();

    for (final zone in _zones) {
      final isInside = zone.containsLocation(latitude, longitude);
      final wasInside = _zoneStates[zone.id] ?? false;

      if (isInside && !wasInside) {
        // Bölgeye GİRİŞ
        if (zone.notifyOnEnter) {
          final event = GeofenceEvent(
            zone: zone,
            eventType: GeofenceEventType.enter,
            timestamp: DateTime.now(),
            latitude: latitude,
            longitude: longitude,
          );
          events.add(event);
          debugPrint('[Geofence] ENTER: ${zone.name}');
          _onGeofenceEvent?.call(event);
        }
        _zoneStates[zone.id] = true;
      } else if (!isInside && wasInside) {
        // Bölgeden ÇIKIŞ
        if (zone.notifyOnExit) {
          final event = GeofenceEvent(
            zone: zone,
            eventType: GeofenceEventType.exit,
            timestamp: DateTime.now(),
            latitude: latitude,
            longitude: longitude,
          );
          events.add(event);
          debugPrint('[Geofence] EXIT: ${zone.name}');
          _onGeofenceEvent?.call(event);
        }
        _zoneStates[zone.id] = false;
      }
    }

    // Durumları kaydet
    await prefs.setString(_zoneStatesKey, json.encode(_zoneStates));

    // Olayları sunucuya gönder
    if (events.isNotEmpty) {
      await _sendEventsToServer(events, prefs);
    }

    return events;
  }

  /// Olayları sunucuya gönder
  static Future<void> _sendEventsToServer(List<GeofenceEvent> events, SharedPreferences prefs) async {
    try {
      final accessToken = prefs.getString(StorageKeys.accessToken);
      if (accessToken == null) {
        // Offline - kuyruğa ekle
        await _queueEvents(events, prefs);
        return;
      }

      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      ));

      await dio.post('/driver/geofence-events', data: {
        'events': events.map((e) => e.toJson()).toList(),
      });

      debugPrint('[Geofence] Sent ${events.length} events to server');

      // Bekleyen olayları da göndermeyi dene
      await _sendPendingEvents(dio, prefs);
    } catch (e) {
      debugPrint('[Geofence] Send error, queuing: $e');
      await _queueEvents(events, prefs);
    }
  }

  /// Olayları kuyruğa ekle
  static Future<void> _queueEvents(List<GeofenceEvent> events, SharedPreferences prefs) async {
    final pendingJson = prefs.getString(_pendingEventsKey) ?? '[]';
    List<dynamic> pending = json.decode(pendingJson);
    pending.addAll(events.map((e) => e.toJson()));

    // Maksimum 100 olay tut
    while (pending.length > 100) {
      pending.removeAt(0);
    }

    await prefs.setString(_pendingEventsKey, json.encode(pending));
    debugPrint('[Geofence] Queued ${events.length} events, total pending: ${pending.length}');
  }

  /// Bekleyen olayları gönder
  static Future<void> _sendPendingEvents(Dio dio, SharedPreferences prefs) async {
    final pendingJson = prefs.getString(_pendingEventsKey) ?? '[]';
    List<dynamic> pending = json.decode(pendingJson);

    if (pending.isEmpty) return;

    try {
      await dio.post('/driver/geofence-events', data: {'events': pending});
      await prefs.setString(_pendingEventsKey, '[]');
      debugPrint('[Geofence] Sent ${pending.length} pending events');
    } catch (e) {
      debugPrint('[Geofence] Failed to send pending events: $e');
    }
  }

  /// Bölgeleri yükle
  static Future<void> _loadZones(SharedPreferences prefs) async {
    final zonesJson = prefs.getString(_zonesKey);
    if (zonesJson != null) {
      final List<dynamic> zonesList = json.decode(zonesJson);
      _zones = zonesList.map((z) => GeofenceZone.fromJson(z)).toList();
    }
  }

  /// Durum verilerini yükle
  static Future<void> _loadZoneStates(SharedPreferences prefs) async {
    final statesJson = prefs.getString(_zoneStatesKey);
    if (statesJson != null) {
      _zoneStates = Map<String, bool>.from(json.decode(statesJson));
    }
  }

  /// Mevcut bölgeleri getir
  static List<GeofenceZone> get zones => List.unmodifiable(_zones);

  /// Kullanıcı şu an hangi bölgelerde?
  static List<GeofenceZone> getZonesContainingLocation(double lat, double lon) {
    return _zones.where((z) => z.containsLocation(lat, lon)).toList();
  }

  /// En yakın bölgeyi ve mesafeyi bul
  static ({GeofenceZone? zone, double distance})? getNearestZone(double lat, double lon) {
    if (_zones.isEmpty) return null;

    GeofenceZone? nearest;
    double minDistance = double.infinity;

    for (final zone in _zones) {
      final distance = Geolocator.distanceBetween(zone.latitude, zone.longitude, lat, lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = zone;
      }
    }

    return (zone: nearest, distance: minDistance);
  }

  /// Bekleyen olay sayısı
  static Future<int> getPendingEventCount() async {
    final prefs = await SharedPreferences.getInstance();
    final pendingJson = prefs.getString(_pendingEventsKey) ?? '[]';
    final List<dynamic> pending = json.decode(pendingJson);
    return pending.length;
  }
}
