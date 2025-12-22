import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/device_info_service.dart';
import '../services/hybrid_location_service.dart';
import '../config/constants.dart';
import '../config/router.dart';

// HybridLocationService token güncellemesi için

class AuthProvider extends ChangeNotifier {
  final ApiService _apiService;
  Timer? _tokenRefreshTimer;

  bool _isLoading = false;
  bool _isLoggedIn = false;
  String? _userId;
  String? _phone;
  Map<String, dynamic>? _user;
  String? _error;
  bool _isRestoringSession = false;

  AuthProvider(this._apiService) {
    _checkLoginStatus();
  }

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  String? get userId => _userId;
  String? get phone => _phone;
  Map<String, dynamic>? get user => _user;
  String? get error => _error;
  ApiService get apiService => _apiService;

  /// Oturum durumunu kontrol et - token geçerliliği dahil
  Future<void> _checkLoginStatus() async {
    if (_isRestoringSession) return;
    _isRestoringSession = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final wasLoggedIn = prefs.getBool(StorageKeys.isLoggedIn) ?? false;
      _userId = prefs.getString(StorageKeys.userId);
      _phone = prefs.getString(StorageKeys.userPhone);
      final accessToken = prefs.getString(StorageKeys.accessToken);
      final refreshToken = prefs.getString(StorageKeys.refreshToken);

      debugPrint('[Auth] Checking login status: wasLoggedIn=$wasLoggedIn, hasToken=${accessToken != null}');

      if (!wasLoggedIn || accessToken == null) {
        _isLoggedIn = false;
        _isRestoringSession = false;
        notifyListeners();
        return;
      }

      // Token ile profile isteği yaparak geçerliliği kontrol et
      try {
        await loadProfile();
        _isLoggedIn = true;
        debugPrint('[Auth] Session restored successfully');

        // Token yenileme timer'ını başlat
        _startTokenRefreshTimer();
      } catch (e) {
        debugPrint('[Auth] Profile load failed, trying to refresh token: $e');

        // Token geçersiz olabilir, refresh dene
        if (refreshToken != null && refreshToken.isNotEmpty) {
          final refreshed = await _tryRefreshToken(prefs, refreshToken);
          if (refreshed) {
            // Refresh başarılı, profile yükle
            try {
              await loadProfile();
              _isLoggedIn = true;
              debugPrint('[Auth] Session restored after token refresh');
              _startTokenRefreshTimer();
            } catch (e2) {
              debugPrint('[Auth] Profile load failed after refresh: $e2');
              _isLoggedIn = false;
              await _clearSession(prefs);
            }
          } else {
            debugPrint('[Auth] Token refresh failed');
            _isLoggedIn = false;
            await _clearSession(prefs);
          }
        } else {
          debugPrint('[Auth] No refresh token available');
          _isLoggedIn = false;
          await _clearSession(prefs);
        }
      }
    } catch (e) {
      debugPrint('[Auth] Error checking login status: $e');
      _isLoggedIn = false;
    } finally {
      _isRestoringSession = false;
      notifyListeners();
    }
  }

  /// Refresh token ile access token yenile
  Future<bool> _tryRefreshToken(SharedPreferences prefs, String refreshToken) async {
    try {
      debugPrint('[Auth] Attempting to refresh token...');

      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ));

      final response = await dio.post(
        ApiConstants.refreshToken,
        data: {'refresh_token': refreshToken},
      );

      if (response.statusCode == 200) {
        final newAccessToken = response.data['access_token'];
        final newRefreshToken = response.data['refresh_token'];

        await _apiService.setToken(newAccessToken);
        await prefs.setString(StorageKeys.accessToken, newAccessToken);
        if (newRefreshToken != null) {
          await prefs.setString(StorageKeys.refreshToken, newRefreshToken);
        }

        // Foreground service'e yeni token'ı bildir (aktif sefer varsa)
        await HybridLocationService.updateToken(newAccessToken);

        debugPrint('[Auth] Token refreshed successfully');
        return true;
      }
    } catch (e) {
      debugPrint('[Auth] Token refresh failed: $e');
    }
    return false;
  }

  /// Oturum verilerini temizle
  Future<void> _clearSession(SharedPreferences prefs) async {
    await prefs.remove(StorageKeys.isLoggedIn);
    await prefs.remove(StorageKeys.accessToken);
    // refreshToken'ı silme - tekrar giriş için kullanılabilir
    _userId = null;
    _phone = null;
    _user = null;
    authNotifier.setLoggedIn(false);
  }

  /// Token yenileme timer'ını başlat (her 50 dakikada bir)
  void _startTokenRefreshTimer() {
    _tokenRefreshTimer?.cancel();
    // Token genellikle 1 saat geçerli, 50 dakikada bir yenile
    _tokenRefreshTimer = Timer.periodic(const Duration(minutes: 50), (_) async {
      debugPrint('[Auth] Periodic token refresh triggered');
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = prefs.getString(StorageKeys.refreshToken);
      if (refreshToken != null && _isLoggedIn) {
        await _tryRefreshToken(prefs, refreshToken);
      }
    });
  }

  /// Timer'ı durdur
  void _stopTokenRefreshTimer() {
    _tokenRefreshTimer?.cancel();
    _tokenRefreshTimer = null;
  }

  Future<bool> login(String phone, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.login(phone, password);
      final data = response.data;

      final accessToken = data['auth']['access_token'];
      final refreshToken = data['auth']['refresh_token'];

      await _apiService.setToken(accessToken);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(StorageKeys.isLoggedIn, true);
      await prefs.setString(StorageKeys.userId, data['driver']['id']);
      await prefs.setString(StorageKeys.userPhone, data['driver']['phone']);
      await prefs.setString(StorageKeys.accessToken, accessToken);
      await prefs.setString(StorageKeys.refreshToken, refreshToken);

      _isLoggedIn = true;
      _userId = data['driver']['id'];
      _phone = data['driver']['phone'];
      _user = data['driver'];

      // Router'ı bilgilendir
      authNotifier.setLoggedIn(true);

      // Token yenileme timer'ını başlat
      _startTokenRefreshTimer();

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
    debugPrint('[Auth] Logging out...');

    // Token yenileme timer'ını durdur
    _stopTokenRefreshTimer();

    // Konum servisini durdur
    await HybridLocationService.stopAll();

    await _apiService.clearToken();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.isLoggedIn);
    await prefs.remove(StorageKeys.userId);
    await prefs.remove(StorageKeys.userPhone);
    await prefs.remove(StorageKeys.accessToken);
    await prefs.remove(StorageKeys.refreshToken);
    // Konum buffer'ını da temizle
    await prefs.remove(StorageKeys.bufferedLocations);
    await prefs.remove(StorageKeys.lastSendTime);

    _isLoggedIn = false;
    _userId = null;
    _phone = null;
    _user = null;

    // Router'ı bilgilendir
    authNotifier.setLoggedIn(false);

    debugPrint('[Auth] Logout complete');
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
