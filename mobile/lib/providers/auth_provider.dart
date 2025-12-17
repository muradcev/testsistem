import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/device_info_service.dart';
import '../services/hybrid_location_service.dart';
import '../config/constants.dart';
import '../config/router.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _apiService;

  bool _isLoading = false;
  bool _isLoggedIn = false;
  String? _userId;
  String? _phone;
  Map<String, dynamic>? _user;
  String? _error;

  AuthProvider(this._apiService) {
    _checkLoginStatus();
  }

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  String? get userId => _userId;
  String? get phone => _phone;
  Map<String, dynamic>? get user => _user;
  String? get error => _error;

  Future<void> _checkLoginStatus() async {
    final prefs = await SharedPreferences.getInstance();
    _isLoggedIn = prefs.getBool(StorageKeys.isLoggedIn) ?? false;
    _userId = prefs.getString(StorageKeys.userId);
    _phone = prefs.getString(StorageKeys.userPhone);

    if (_isLoggedIn) {
      await loadProfile();
      // DeviceInfoService uzerinden cihaz bilgisi gonderilecek (FCM token ile birlikte)
      // NotificationService FCM token aldiginda otomatik DeviceInfoService'e iletecek
      debugPrint('[Auth] User is logged in, device info will be sent via DeviceInfoService');
      // WorkManager home_screen.dart'da başlatılıyor
    }

    notifyListeners();
  }

  Future<bool> login(String phone, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.login(phone, password);
      final data = response.data;

      await _apiService.setToken(data['auth']['access_token']);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(StorageKeys.isLoggedIn, true);
      await prefs.setString(StorageKeys.userId, data['driver']['id']);
      await prefs.setString(StorageKeys.userPhone, data['driver']['phone']);
      await prefs.setString(StorageKeys.refreshToken, data['auth']['refresh_token']);

      _isLoggedIn = true;
      _userId = data['driver']['id'];
      _phone = data['driver']['phone'];
      _user = data['driver'];

      // Router'ı bilgilendir
      authNotifier.setLoggedIn(true);

      // DeviceInfoService'e ApiService'i bagla ve bilgileri gonder
      // FCM token NotificationService tarafindan DeviceInfoService'e iletilecek
      final deviceInfoService = DeviceInfoService.instance;
      deviceInfoService.setApiService(_apiService);
      await deviceInfoService.sendAllInfo(force: true);
      debugPrint('[Auth] Device info sent via DeviceInfoService');
      // WorkManager home_screen.dart'da başlatılıyor

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.register(data);

      // Kayit basarili, simdi otomatik giris yap
      final phone = data['phone'] as String;
      final password = data['password'] as String;

      final loginResult = await login(phone, password);
      return loginResult;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> sendOtp(String phone) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.sendOtp(phone);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyOtp(String phone, String code) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.verifyOtp(phone, code);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> loadProfile() async {
    try {
      final response = await _apiService.getProfile();
      _user = response.data;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to load profile: $e');
    }
  }

  Future<bool> updateProfile(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.updateProfile(data);
      _user = response.data;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    // Konum servisini durdur
    await HybridLocationService.stopAll();

    await _apiService.clearToken();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.isLoggedIn);
    await prefs.remove(StorageKeys.userId);
    await prefs.remove(StorageKeys.userPhone);
    await prefs.remove(StorageKeys.accessToken);
    await prefs.remove(StorageKeys.refreshToken);

    _isLoggedIn = false;
    _userId = null;
    _phone = null;
    _user = null;

    // Router'ı bilgilendir
    authNotifier.setLoggedIn(false);

    notifyListeners();
  }

  /// Cihaz bilgisini DeviceInfoService uzerinden gonder
  Future<void> refreshDeviceInfo() async {
    try {
      final deviceInfoService = DeviceInfoService.instance;
      deviceInfoService.setApiService(_apiService);
      await deviceInfoService.sendAllInfo(force: true);
      debugPrint('[Auth] Device info refreshed via DeviceInfoService');
    } catch (e) {
      debugPrint('[Auth] Failed to refresh device info: $e');
    }
  }

  String _parseError(dynamic e) {
    if (e.response?.data != null && e.response.data['error'] != null) {
      return e.response.data['error'];
    }
    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
