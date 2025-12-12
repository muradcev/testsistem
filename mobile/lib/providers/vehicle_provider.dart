import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class VehicleProvider extends ChangeNotifier {
  final ApiService _apiService;

  bool _isLoading = false;
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _trailers = [];
  String? _error;

  VehicleProvider(this._apiService);

  bool get isLoading => _isLoading;
  List<Map<String, dynamic>> get vehicles => _vehicles;
  List<Map<String, dynamic>> get trailers => _trailers;
  String? get error => _error;

  Future<void> loadVehicles() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getVehicles();
      _vehicles = List<Map<String, dynamic>>.from(response.data['vehicles'] ?? []);
    } catch (e) {
      debugPrint('Failed to load vehicles: $e');
      _error = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadTrailers() async {
    try {
      final response = await _apiService.getTrailers();
      _trailers = List<Map<String, dynamic>>.from(response.data['trailers'] ?? []);
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to load trailers: $e');
    }
  }

  Future<bool> addVehicle(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.createVehicle(data);
      await loadVehicles();
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
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteVehicle(String id) async {
    try {
      await _apiService.deleteVehicle(id);
      await loadVehicles();
      return true;
    } catch (e) {
      _error = _parseError(e);
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
    try {
      await _apiService.deleteTrailer(id);
      await loadTrailers();
      return true;
    } catch (e) {
      _error = _parseError(e);
      notifyListeners();
      return false;
    }
  }

  String _parseError(dynamic e) {
    if (e.response?.data != null && e.response.data['error'] != null) {
      return e.response.data['error'];
    }
    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
