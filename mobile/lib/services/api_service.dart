import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';

class ApiService {
  late final Dio _dio;
  String? _accessToken;
  String? _refreshToken;
  bool _tokenLoaded = false;

  // Token refresh için mutex mekanizması
  // Completer kullanarak eşzamanlı refresh isteklerini senkronize ediyoruz
  Completer<bool>? _refreshCompleter;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json; charset=utf-8',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Token yüklenene kadar bekle
        await _ensureTokenLoaded();
        if (_accessToken != null) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        debugPrint('[API] ${options.method} ${options.path}');
        return handler.next(options);
      },
      onResponse: (response, handler) {
        debugPrint('[API] Response ${response.statusCode}: ${response.requestOptions.path}');
        return handler.next(response);
      },
      onError: (error, handler) async {
        debugPrint('[API] Error ${error.response?.statusCode}: ${error.requestOptions.path}');
        debugPrint('[API] Error message: ${error.message}');

        if (error.response?.statusCode == 401) {
          // Token geçersiz veya süresi dolmuş
          debugPrint('[API] 401 Unauthorized - attempting token refresh');

          // Refresh endpoint'ine giden isteklerde tekrar deneme yapma
          if (error.requestOptions.path.contains('/auth/refresh')) {
            debugPrint('[API] Refresh token also expired - will propagate error');
            // Otomatik logout yapmıyoruz - hatayı yukarı ilet
            // Kullanıcı kendisi logout yapmadıkça oturumu koruyoruz
            return handler.next(error);
          }

          // Token yenilemeyi dene
          final refreshed = await _tryRefreshToken();
          if (refreshed) {
            // Token yenilendi, isteği tekrar dene
            debugPrint('[API] Token refreshed - retrying request');
            try {
              final opts = Options(
                method: error.requestOptions.method,
                headers: {
                  ...error.requestOptions.headers,
                  'Authorization': 'Bearer $_accessToken',
                },
              );
              final response = await _dio.request(
                error.requestOptions.path,
                data: error.requestOptions.data,
                queryParameters: error.requestOptions.queryParameters,
                options: opts,
              );
              return handler.resolve(response);
            } catch (e) {
              debugPrint('[API] Retry failed: $e');
              return handler.next(error);
            }
          } else {
            // Token yenilenemedi - ama otomatik logout YAPMA!
            // Kullanıcıyı login'de tutuyoruz, sonraki istekte tekrar deneyecek
            debugPrint('[API] Token refresh failed - keeping session, error will propagate');
          }
        }
        return handler.next(error);
      },
    ));

    _loadToken();
  }

  /// Token yenileme - Mutex mekanizması ile
  /// Eşzamanlı 401 hatalarında sadece bir refresh isteği yapılır,
  /// diğer istekler sonucu bekler
  Future<bool> _tryRefreshToken() async {
    // Zaten bir refresh işlemi devam ediyorsa, sonucunu bekle
    if (_refreshCompleter != null) {
      debugPrint('[API] Token refresh already in progress, waiting...');
      return _refreshCompleter!.future;
    }

    if (_refreshToken == null) {
      debugPrint('[API] No refresh token available');
      return false;
    }

    // Yeni Completer oluştur - diğer istekler bunu bekleyecek
    _refreshCompleter = Completer<bool>();

    try {
      debugPrint('[API] Refreshing token...');
      final response = await _dio.post(
        ApiConstants.refreshToken,
        data: {'refresh_token': _refreshToken},
        options: Options(headers: {}), // Authorization header olmadan
      );

      if (response.statusCode == 200) {
        // Backend "auth" objesi içinde dönüyor
        final authData = response.data['auth'] ?? response.data;
        final newAccessToken = authData['access_token'];
        final newRefreshToken = authData['refresh_token'];

        if (newAccessToken == null || newAccessToken.isEmpty) {
          debugPrint('[API] Token refresh response missing access_token');
          _refreshCompleter!.complete(false);
          _refreshCompleter = null;
          return false;
        }

        await setToken(newAccessToken);
        if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
          await _setRefreshToken(newRefreshToken);
        }

        // Notify background service about new token
        _updateBackgroundServiceToken(newAccessToken);

        debugPrint('[API] Token refreshed successfully');
        _refreshCompleter!.complete(true);
        _refreshCompleter = null;
        return true;
      }
    } catch (e) {
      debugPrint('[API] Token refresh failed: $e');
    }

    _refreshCompleter!.complete(false);
    _refreshCompleter = null;
    return false;
  }

  Future<void> _setRefreshToken(String token) async {
    _refreshToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.refreshToken, token);
  }

  void _updateBackgroundServiceToken(String token) {
    try {
      final service = FlutterBackgroundService();
      service.invoke('updateToken', {'token': token});
      debugPrint('[API] Background service token updated');
    } catch (e) {
      debugPrint('[API] Failed to update background service token: $e');
    }
  }

  Future<void> _ensureTokenLoaded() async {
    if (!_tokenLoaded) {
      final prefs = await SharedPreferences.getInstance();
      _accessToken = prefs.getString(StorageKeys.accessToken);
      _refreshToken = prefs.getString(StorageKeys.refreshToken);
      _tokenLoaded = true;
    }
  }

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString(StorageKeys.accessToken);
    _refreshToken = prefs.getString(StorageKeys.refreshToken);
    _tokenLoaded = true;
  }

  Future<void> setToken(String token) async {
    _accessToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.accessToken, token);
  }

  Future<void> clearToken() async {
    _accessToken = null;
    _refreshToken = null;
    _tokenLoaded = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.accessToken);
    await prefs.remove(StorageKeys.refreshToken);
  }

  /// Public method for token refresh - AuthProvider ve diğer servisler tarafından kullanılabilir
  /// Bu sayede tüm token refresh işlemleri merkezi mutex mekanizmasından geçer
  Future<bool> refreshToken() async {
    await _ensureTokenLoaded();
    return _tryRefreshToken();
  }

  /// Token'ın mevcut olup olmadığını kontrol et
  bool get hasToken => _accessToken != null && _accessToken!.isNotEmpty;

  // Auth
  Future<Response> login(String phone, String password) async {
    return _dio.post(ApiConstants.login, data: {
      'phone': phone,
      'password': password,
    });
  }

  Future<Response> register(Map<String, dynamic> data) async {
    return _dio.post(ApiConstants.register, data: data);
  }

  /// Telefon numarasının kayıtlı olup olmadığını kontrol eder
  Future<Response> checkPhoneExists(String phone) async {
    return _dio.post(ApiConstants.checkPhone, data: {'phone': phone});
  }

  Future<Response> sendOtp(String phone) async {
    return _dio.post(ApiConstants.sendOtp, data: {'phone': phone});
  }

  Future<Response> verifyOtp(String phone, String code) async {
    return _dio.post(ApiConstants.verifyOtp, data: {
      'phone': phone,
      'code': code,
    });
  }

  // Profile
  Future<Response> getProfile() async {
    return _dio.get(ApiConstants.profile);
  }

  Future<Response> updateProfile(Map<String, dynamic> data) async {
    return _dio.put(ApiConstants.profile, data: data);
  }

  Future<Response> updateFcmToken(String token) async {
    return _dio.put(ApiConstants.fcmToken, data: {'token': token});
  }

  Future<Response> sendDeviceInfo(Map<String, dynamic> data) async {
    return _dio.post(ApiConstants.deviceInfo, data: data);
  }

  // Vehicles
  Future<Response> getVehicles() async {
    return _dio.get(ApiConstants.vehicles);
  }

  Future<Response> createVehicle(Map<String, dynamic> data) async {
    return _dio.post(ApiConstants.vehicles, data: data);
  }

  Future<Response> updateVehicle(String id, Map<String, dynamic> data) async {
    return _dio.put('${ApiConstants.vehicles}/$id', data: data);
  }

  Future<Response> deleteVehicle(String id) async {
    return _dio.delete('${ApiConstants.vehicles}/$id');
  }

  // Trailers
  Future<Response> getTrailers() async {
    return _dio.get(ApiConstants.trailers);
  }

  Future<Response> createTrailer(Map<String, dynamic> data) async {
    return _dio.post(ApiConstants.trailers, data: data);
  }

  Future<Response> updateTrailer(String id, Map<String, dynamic> data) async {
    return _dio.put('${ApiConstants.trailers}/$id', data: data);
  }

  Future<Response> deleteTrailer(String id) async {
    return _dio.delete('${ApiConstants.trailers}/$id');
  }

  // Location
  Future<Response> sendLocation(Map<String, dynamic> data) async {
    return _dio.post(ApiConstants.location, data: data);
  }

  Future<Response> sendBatchLocations(List<Map<String, dynamic>> locations) async {
    return _dio.post(ApiConstants.locationBatch, data: {'locations': locations});
  }

  // Surveys
  Future<Response> getPendingSurveys() async {
    return _dio.get(ApiConstants.surveys);
  }

  Future<Response> submitSurveyResponse(String surveyId, Map<String, dynamic> data) async {
    return _dio.post('${ApiConstants.surveys.replaceAll('/pending', '')}/$surveyId/respond', data: data);
  }

  // Questions (Akıllı Soru Sistemi)
  Future<Response> getPendingQuestions() async {
    return _dio.get(ApiConstants.questionsPending);
  }

  Future<Response> answerQuestion(String questionId, Map<String, dynamic> data) async {
    return _dio.post(ApiConstants.answerQuestion(questionId), data: data);
  }

  // Announcements (Duyurular)
  Future<Response> getAnnouncements() async {
    return _dio.get(ApiConstants.announcements);
  }

  Future<Response> dismissAnnouncement(String announcementId) async {
    return _dio.post(ApiConstants.dismissAnnouncement(announcementId));
  }

  // Driver Homes (Ev Adresleri)
  Future<Response> getDriverHomes() async {
    return _dio.get(ApiConstants.driverHomes);
  }

  // Generic methods
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return _dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data}) async {
    return _dio.post(path, data: data);
  }

  Future<Response> put(String path, {dynamic data}) async {
    return _dio.put(path, data: data);
  }

  Future<Response> delete(String path) async {
    return _dio.delete(path);
  }

  // Locations (provinces, districts, neighborhoods)
  Future<Response> getProvinces() async {
    return _dio.get(ApiConstants.provinces);
  }

  Future<Response> getDistricts(String province) async {
    return _dio.get(ApiConstants.districts(province));
  }

  Future<Response> getNeighborhoods(String province, String district) async {
    return _dio.get(ApiConstants.neighborhoods(province, district));
  }
}
