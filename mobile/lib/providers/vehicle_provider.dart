import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';

class VehicleProvider extends ChangeNotifier {
  final ApiService _apiService;
  final CacheService _cacheService;

  bool _isLoading = false;
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _trailers = [];
  String? _error;

  VehicleProvider(this._apiService, this._cacheService) {
    _loadFromCache();
  }

  void _loadFromCache() {
    _vehicles = _cacheService.getCachedVehicles();
    _trailers = _cacheService.getCachedTrailers();
    if (_vehicles.isNotEmpty || _trailers.isNotEmpty) {
      debugPrint('[VehicleProvider] Loaded from cache: ${_vehicles.length} vehicles, ${_trailers.length} trailers');
      notifyListeners();
    }
  }

  bool get isLoading => _isLoading;
  List<Map<String, dynamic>> get vehicles => _vehicles;
  List<Map<String, dynamic>> get trailers => _trailers;
  String? get error => _error;

  Future<void> loadVehicles() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      debugPrint('[VehicleProvider] Loading vehicles...');
      final response = await _apiService.getVehicles();
      debugPrint('[VehicleProvider] Response: ${response.statusCode}');
      debugPrint('[VehicleProvider] Data: ${response.data}');

      if (response.data == null) {
        _error = 'Sunucudan veri alınamadı';
        // Don't clear - keep cache
      } else {
        _vehicles = List<Map<String, dynamic>>.from(response.data['vehicles'] ?? []);
        // Save to cache
        await _cacheService.cacheVehicles(_vehicles);
      }
      debugPrint('[VehicleProvider] Loaded ${_vehicles.length} vehicles');
    } catch (e, stackTrace) {
      debugPrint('[VehicleProvider] Failed to load vehicles: $e');
      debugPrint('[VehicleProvider] Stack: $stackTrace');
      _error = _parseError(e);
      // Don't clear - keep cache for offline use
    } finally {
      _isLoading = false;
      notifyListeners();
      debugPrint('[VehicleProvider] Loading completed, isLoading: $_isLoading');
    }
  }

  Future<void> loadTrailers() async {
    try {
      debugPrint('[VehicleProvider] Loading trailers...');
      final response = await _apiService.getTrailers();

      if (response.data == null) {
        debugPrint('[VehicleProvider] Trailers response is null');
        // Don't clear - keep cache
      } else {
        _trailers = List<Map<String, dynamic>>.from(response.data['trailers'] ?? []);
        // Save to cache
        await _cacheService.cacheTrailers(_trailers);
      }
      debugPrint('[VehicleProvider] Loaded ${_trailers.length} trailers');
      notifyListeners();
    } catch (e) {
      debugPrint('[VehicleProvider] Failed to load trailers: $e');
      // Don't clear - keep cache for offline use
      notifyListeners();
    }
  }

  Future<bool> addVehicle(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.createVehicle(data);
      await loadVehicles();
      // loadVehicles zaten isLoading'i resetliyor, ama tutarlılık için
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateVehicle(String id, Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.updateVehicle(id, data);
      await loadVehicles();
      // loadVehicles zaten isLoading'i resetliyor
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteVehicle(String id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.deleteVehicle(id);
      await loadVehicles();
      // loadVehicles zaten isLoading'i resetliyor
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> addTrailer(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.createTrailer(data);
      await loadTrailers();
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

  Future<bool> deleteTrailer(String id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.deleteTrailer(id);
      await loadTrailers();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  String _parseError(dynamic e) {
    try {
      debugPrint('[VehicleProvider] Parsing error: $e');
      debugPrint('[VehicleProvider] Error type: ${e.runtimeType}');

      // DioException kontrolü
      if (e.toString().contains('DioException')) {
        final response = e.response;
        if (response != null) {
          debugPrint('[VehicleProvider] Response status: ${response.statusCode}');
          debugPrint('[VehicleProvider] Response data: ${response.data}');

          if (response.statusCode == 401) {
            return 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
          }

          if (response.data != null && response.data is Map && response.data['error'] != null) {
            return response.data['error'].toString();
          }
        }

        // Connection errors
        if (e.toString().contains('SocketException') || e.toString().contains('connection')) {
          return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
        }

        if (e.toString().contains('timeout')) {
          return 'Bağlantı zaman aşımına uğradı. Tekrar deneyin.';
        }
      }

      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
    } catch (parseErr) {
      debugPrint('[VehicleProvider] Error parsing error: $parseErr');
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
    }
  }
}
