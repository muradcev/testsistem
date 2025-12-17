import 'package:flutter/foundation.dart';
import '../models/announcement.dart';
import '../services/api_service.dart';

/// Duyurular provider - Admin panelinden gelen dinamik icerikleri yonetir
class AnnouncementsProvider with ChangeNotifier {
  final ApiService _apiService;

  List<Announcement> _announcements = [];
  bool _isLoading = false;
  String? _error;

  AnnouncementsProvider(this._apiService);

  List<Announcement> get announcements => _announcements;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasAnnouncements => _announcements.isNotEmpty;

  /// Duyurulari API'den yukle
  Future<void> loadAnnouncements() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      debugPrint('[AnnouncementsProvider] Loading announcements...');
      final response = await _apiService.getAnnouncements();

      if (response.statusCode == 200) {
        final data = response.data;
        final List<dynamic> announcementList = data['announcements'] ?? [];
        _announcements = announcementList
            .map((json) => Announcement.fromJson(json))
            .toList();
        debugPrint('[AnnouncementsProvider] Loaded ${_announcements.length} announcements');
      } else {
        _error = 'Duyurular yuklenemedi';
        debugPrint('[AnnouncementsProvider] Error: ${response.statusCode}');
      }
    } catch (e) {
      _error = e.toString();
      debugPrint('[AnnouncementsProvider] Exception: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Duyuruyu kapat (dismiss)
  Future<bool> dismissAnnouncement(String announcementId) async {
    try {
      debugPrint('[AnnouncementsProvider] Dismissing announcement: $announcementId');
      final response = await _apiService.dismissAnnouncement(announcementId);

      if (response.statusCode == 200) {
        // Listeden kaldir
        _announcements.removeWhere((a) => a.id == announcementId);
        notifyListeners();
        debugPrint('[AnnouncementsProvider] Announcement dismissed');
        return true;
      }
    } catch (e) {
      debugPrint('[AnnouncementsProvider] Dismiss error: $e');
    }
    return false;
  }

  /// Tek duyuruyu kapat (lokal - server olmadan)
  void removeLocally(String announcementId) {
    _announcements.removeWhere((a) => a.id == announcementId);
    notifyListeners();
  }
}
