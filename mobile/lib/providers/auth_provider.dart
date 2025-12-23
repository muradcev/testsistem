import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/device_info_service.dart';
import '../services/hybrid_location_service.dart';
import '../config/constants.dart';
import '../config/router.dart';

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

      debugPrint('[Auth] Checking login status: wasLoggedIn=$wasLoggedIn, hasToken=${accessToken != null}, hasRefresh=${refreshToken != null}');

      // Hiç giriş yapılmamış veya token yok
      if (!wasLoggedIn || accessToken == null) {
        debugPrint('[Auth] No previous login or token found');
        _isLoggedIn = false;
        _isRestoringSession = false;
        notifyListeners();
        return;
      }

      // Token var, ApiService'e yükle
      await _apiService.setToken(accessToken);

      // Profile yüklemeyi dene
      try {
        await _loadProfileSilent();
        _isLoggedIn = true;
        authNotifier.setLoggedIn(true);
        debugPrint('[Auth] Session restored successfully');
        _startTokenRefreshTimer();
      } on DioException catch (e) {
        debugPrint('[Auth] Profile load failed with DioException: ${e.type} - ${e.message}');

        // Sadece 401 hatası için token yenileme dene
        if (e.response?.statusCode == 401) {
          debugPrint('[Auth] Got 401, trying to refresh token...');
          if (refreshToken != null && refreshToken.isNotEmpty) {
            final refreshed = await _tryRefreshToken(prefs, refreshToken);
            if (refreshed) {
              try {
                await _loadProfileSilent();
                _isLoggedIn = true;
                authNotifier.setLoggedIn(true);
                debugPrint('[Auth] Session restored after token refresh');
                _startTokenRefreshTimer();
              } catch (e2) {
                debugPrint('[Auth] Profile load failed after refresh: $e2');
                // Refresh başarılı oldu ama profile yüklenemedi - yine de giriş yapmış say
                // Çünkü token yenilendi, network sorunu olabilir
                _isLoggedIn = true;
                authNotifier.setLoggedIn(true);
                _startTokenRefreshTimer();
              }
            } else {
              debugPrint('[Auth] Token refresh failed - keeping session for retry');
              // Refresh token da başarısız - ama session'ı silme!
              // Kullanıcı tekrar deneyebilir
              _isLoggedIn = true;
              authNotifier.setLoggedIn(true);
              _startTokenRefreshTimer();
            }
          } else {
            debugPrint('[Auth] No refresh token - keeping session anyway');
            // Refresh token yok ama access token var
            // Kullanıcıyı login'de tut, sonraki isteklerde 401 alırsa ApiService handle eder
            _isLoggedIn = true;
            authNotifier.setLoggedIn(true);
            _startTokenRefreshTimer();
          }
        } else {
          // Network hatası veya başka bir sorun - kullanıcıyı login'de tut
          debugPrint('[Auth] Non-401 error (${e.response?.statusCode}) - keeping session, might be network issue');
          _isLoggedIn = true;
          authNotifier.setLoggedIn(true);
          _startTokenRefreshTimer();
        }
      } catch (e) {
        // Beklenmeyen hata - yine de session'ı koru
        debugPrint('[Auth] Unexpected error: $e - keeping session');
        _isLoggedIn = true;
        authNotifier.setLoggedIn(true);
        _startTokenRefreshTimer();
      }
    } catch (e) {
      debugPrint('[Auth] Critical error checking login status: $e');
      _isLoggedIn = false;
    } finally {
      _isRestoringSession = false;
      notifyListeners();
    }
  }

  /// Profile'ı sessizce yükle (hata fırlatır)
  Future<void> _loadProfileSilent() async {
    final response = await _apiService.getProfile();
    _user = response.data;
  }

  /// Refresh token ile access token yenile
  Future<bool> _tryRefreshToken(SharedPreferences prefs, String refreshToken) async {
    try {
      debugPrint('[Auth] Attempting to refresh token...');

      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Content-Type': 'application/json'},
      ));

      final response = await dio.post(
        ApiConstants.refreshToken,
        data: {'refresh_token': refreshToken},
      );

      if (response.statusCode == 200) {
        // Backend "auth" objesi içinde dönüyor
        final authData = response.data['auth'] ?? response.data;
        final newAccessToken = authData['access_token'];
        final newRefreshToken = authData['refresh_token'];

        if (newAccessToken == null) {
          debugPrint('[Auth] No access token in refresh response');
          return false;
        }

        await _apiService.setToken(newAccessToken);
        await prefs.setString(StorageKeys.accessToken, newAccessToken);
        if (newRefreshToken != null) {
          await prefs.setString(StorageKeys.refreshToken, newRefreshToken);
        }

        // Foreground service'e yeni token'ı bildir
        await HybridLocationService.updateToken(newAccessToken);

        debugPrint('[Auth] Token refreshed successfully');
        return true;
      }
    } on DioException catch (e) {
      debugPrint('[Auth] Token refresh DioException: ${e.type} - ${e.message}');
      // Network hatası için false dön ama session'ı silme
    } catch (e) {
      debugPrint('[Auth] Token refresh failed: $e');
    }
    return false;
  }

  /// Token yenileme timer'ını başlat
  /// Token 24 saat geçerli, her 12 saatte bir yenile (güvenli margin)
  void _startTokenRefreshTimer() {
    _tokenRefreshTimer?.cancel();
    // Token 24 saat geçerli, 12 saatte bir yenile (50% margin)
    _tokenRefreshTimer = Timer.periodic(const Duration(hours: 12), (_) async {
      debugPrint('[Auth] Periodic token refresh triggered (12 hour interval)');
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = prefs.getString(StorageKeys.refreshToken);
      if (refreshToken != null && _isLoggedIn) {
        await _tryRefreshToken(prefs, refreshToken);
      }
    });
    debugPrint('[Auth] Token refresh timer started (12 hour interval)');
  }

  /// Timer'ı durdur
  void _stopTokenRefreshTimer() {
    _tokenRefreshTimer?.cancel();
    _tokenRefreshTimer = null;
    debugPrint('[Auth] Token refresh timer stopped');
  }

  /// Dispose - Memory leak önleme
  @override
  void dispose() {
    _stopTokenRefreshTimer();
    super.dispose();
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
      final deviceInfoService = DeviceInfoService.instance;
      deviceInfoService.setApiService(_apiService);

      // Device info'yu arka planda gönder, login'i bloklama
      deviceInfoService.sendAllInfo(force: true).then((_) {
        debugPrint('[Auth] Device info sent via DeviceInfoService');
      }).catchError((e) {
        debugPrint('[Auth] Device info send failed (non-critical): $e');
      });

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

  /// Profile'ı yükle - UI için (hata gösterilmez)
  Future<void> loadProfile() async {
    try {
      final response = await _apiService.getProfile();
      _user = response.data;
      notifyListeners();
    } catch (e) {
      debugPrint('[Auth] Failed to load profile: $e');
      // UI çağrısı için hata fırlatma, sadece logla
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

  /// Manuel logout - sadece kullanıcı istediğinde çağrılır
  Future<void> logout() async {
    debugPrint('[Auth] User requested logout...');

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
    if (e is DioException) {
      if (e.response?.data != null && e.response!.data is Map) {
        final error = e.response!.data['error'];
        if (error != null) return error.toString();
      }
      // Network hataları için daha açıklayıcı mesajlar
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.';
        case DioExceptionType.connectionError:
          return 'İnternet bağlantınızı kontrol edin.';
        default:
          break;
      }
    }
    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
