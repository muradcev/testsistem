import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';

class ApiService {
  late final Dio _dio;
  String? _accessToken;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (_accessToken != null) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // TODO: Token yenileme
        }
        return handler.next(error);
      },
    ));

    _loadToken();
  }

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString(StorageKeys.accessToken);
  }

  Future<void> setToken(String token) async {
    _accessToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.accessToken, token);
  }

  Future<void> clearToken() async {
    _accessToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.accessToken);
  }

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
