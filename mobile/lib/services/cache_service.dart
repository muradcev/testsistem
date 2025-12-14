import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CacheService {
  static const String _profileKey = 'cached_profile';
  static const String _vehiclesKey = 'cached_vehicles';
  static const String _trailersKey = 'cached_trailers';
  static const String _questionsKey = 'cached_questions';
  static const String _lastSyncKey = 'last_sync_time';

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Profile Cache
  Future<void> cacheProfile(Map<String, dynamic> profile) async {
    await _prefs?.setString(_profileKey, jsonEncode(profile));
    debugPrint('[CacheService] Profile cached');
  }

  Map<String, dynamic>? getCachedProfile() {
    final data = _prefs?.getString(_profileKey);
    if (data != null) {
      return jsonDecode(data) as Map<String, dynamic>;
    }
    return null;
  }

  // Vehicles Cache
  Future<void> cacheVehicles(List<Map<String, dynamic>> vehicles) async {
    await _prefs?.setString(_vehiclesKey, jsonEncode(vehicles));
    debugPrint('[CacheService] ${vehicles.length} vehicles cached');
  }

  List<Map<String, dynamic>> getCachedVehicles() {
    final data = _prefs?.getString(_vehiclesKey);
    if (data != null) {
      final list = jsonDecode(data) as List;
      return list.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  // Trailers Cache
  Future<void> cacheTrailers(List<Map<String, dynamic>> trailers) async {
    await _prefs?.setString(_trailersKey, jsonEncode(trailers));
    debugPrint('[CacheService] ${trailers.length} trailers cached');
  }

  List<Map<String, dynamic>> getCachedTrailers() {
    final data = _prefs?.getString(_trailersKey);
    if (data != null) {
      final list = jsonDecode(data) as List;
      return list.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  // Questions Cache
  Future<void> cacheQuestions(List<Map<String, dynamic>> questions) async {
    await _prefs?.setString(_questionsKey, jsonEncode(questions));
    await _prefs?.setString(_lastSyncKey, DateTime.now().toIso8601String());
    debugPrint('[CacheService] ${questions.length} questions cached');
  }

  List<Map<String, dynamic>> getCachedQuestions() {
    final data = _prefs?.getString(_questionsKey);
    if (data != null) {
      final list = jsonDecode(data) as List;
      return list.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  // Last Sync Time
  DateTime? getLastSyncTime() {
    final data = _prefs?.getString(_lastSyncKey);
    if (data != null) {
      return DateTime.parse(data);
    }
    return null;
  }

  // Clear all cache
  Future<void> clearAll() async {
    await _prefs?.remove(_profileKey);
    await _prefs?.remove(_vehiclesKey);
    await _prefs?.remove(_trailersKey);
    await _prefs?.remove(_questionsKey);
    await _prefs?.remove(_lastSyncKey);
    debugPrint('[CacheService] All cache cleared');
  }

  // Check if data is stale (older than 1 hour)
  bool isDataStale() {
    final lastSync = getLastSyncTime();
    if (lastSync == null) return true;
    return DateTime.now().difference(lastSync).inHours >= 1;
  }
}
