import 'package:call_log/call_log.dart' as call_log_pkg;
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';
import 'api_service.dart';

/// Arama takip servisi - Şoförün yük sahipleriyle iletişimini takip eder
class CallTrackingService {
  final ApiService _apiService;
  Timer? _syncTimer;

  CallTrackingService(this._apiService);

  /// İzinleri kontrol et ve iste
  Future<bool> requestPermissions() async {
    debugPrint('[Permissions] Requesting contacts permission...');
    final contacts = await Permission.contacts.request();
    debugPrint('[Permissions] Contacts: $contacts');

    debugPrint('[Permissions] Requesting phone permission...');
    final phone = await Permission.phone.request();
    debugPrint('[Permissions] Phone: $phone');

    // Android 9+ için READ_CALL_LOG ayrı bir izin
    // permission_handler'da bu phone altında gruplanmış olabilir
    // Ama bazı cihazlarda ayrı istenmesi gerekebilir

    return contacts.isGranted && phone.isGranted;
  }

  /// İzinlerin durumunu kontrol et
  Future<Map<String, bool>> checkPermissions() async {
    final contacts = await Permission.contacts.isGranted;
    final phone = await Permission.phone.isGranted;

    debugPrint('[Permissions] Check - contacts: $contacts, phone: $phone');

    return {
      'contacts': contacts,
      'phone': phone,
    };
  }

  /// Tüm rehberi oku
  Future<List<ContactInfo>> getContacts() async {
    if (!await Permission.contacts.isGranted) {
      return [];
    }

    try {
      final contacts = await FlutterContacts.getContacts(
        withProperties: true,
        withPhoto: false,
      );

      return contacts.map((c) => ContactInfo(
        id: c.id,
        name: c.displayName,
        phones: c.phones.map((p) => p.number).toList(),
      )).toList();
    } catch (e) {
      debugPrint('Rehber okuma hatası: $e');
      return [];
    }
  }

  /// Belirli bir numarayı rehberde ara
  Future<ContactInfo?> findContactByPhone(String phoneNumber) async {
    final contacts = await getContacts();
    final normalizedSearch = _normalizePhone(phoneNumber);

    for (final contact in contacts) {
      for (final phone in contact.phones) {
        if (_normalizePhone(phone) == normalizedSearch) {
          return contact;
        }
      }
    }
    return null;
  }

  /// Arama geçmişini oku
  Future<List<CallRecord>> getCallLogs({
    DateTime? from,
    DateTime? to,
    String? phoneNumber,
  }) async {
    debugPrint('[CallLog] ========== PERMISSION CHECK ==========');

    // Android 9+ icin READ_CALL_LOG ayri bir izin
    // permission_handler'da PermissionGroup.phone altinda gruplandigi icin
    // once phone sonra ayrica kontrol ediyoruz

    final phoneGranted = await Permission.phone.isGranted;
    debugPrint('[CallLog] Phone permission isGranted: $phoneGranted');

    if (!phoneGranted) {
      debugPrint('[CallLog] Phone permission not granted, requesting...');
      final result = await Permission.phone.request();
      debugPrint('[CallLog] Phone permission request result: $result');
      if (!result.isGranted) {
        debugPrint('[CallLog] Phone permission denied');
        return [];
      }
    }

    // Contacts permission da gerekli olabilir (call_log paketi icin)
    final contactsGranted = await Permission.contacts.isGranted;
    debugPrint('[CallLog] Contacts permission isGranted: $contactsGranted');

    if (!contactsGranted) {
      debugPrint('[CallLog] Contacts permission not granted, requesting...');
      await Permission.contacts.request();
    }

    try {
      debugPrint('[CallLog] ========== FETCHING CALL LOGS ==========');
      Iterable<call_log_pkg.CallLogEntry> entries;

      if (phoneNumber != null) {
        // Belirli bir numara için arama geçmişi
        debugPrint('[CallLog] Querying for number: $phoneNumber');
        entries = await call_log_pkg.CallLog.query(number: phoneNumber);
      } else if (from != null || to != null) {
        // Tarih aralığı için arama geçmişi
        debugPrint('[CallLog] Querying date range: $from - $to');
        entries = await call_log_pkg.CallLog.query(
          dateFrom: from?.millisecondsSinceEpoch,
          dateTo: to?.millisecondsSinceEpoch,
        );
      } else {
        // Son 100 arama
        debugPrint('[CallLog] Getting all call logs (no filter)');
        entries = await call_log_pkg.CallLog.get();
      }

      debugPrint('[CallLog] CallLog.get/query completed');

      final entryList = entries.toList();
      debugPrint('[CallLog] Raw entries count: ${entryList.length}');

      if (entryList.isEmpty) {
        debugPrint('[CallLog] WARNING: No call log entries returned!');
        debugPrint('[CallLog] This could mean:');
        debugPrint('[CallLog]   1. READ_CALL_LOG permission not granted (different from CALL_PHONE)');
        debugPrint('[CallLog]   2. No call history on device');
        debugPrint('[CallLog]   3. Call log access blocked by device manufacturer');
      }

      final logs = <CallRecord>[];
      for (var i = 0; i < entryList.length; i++) {
        final entry = entryList[i];
        if (i < 5) {
          debugPrint('[CallLog] Entry $i: number=${entry.number}, name=${entry.name}, type=${entry.callType}, duration=${entry.duration}');
        }
        logs.add(CallRecord(
          name: entry.name,
          number: entry.number ?? '',
          callType: _mapCallType(entry.callType),
          duration: Duration(seconds: entry.duration ?? 0),
          timestamp: DateTime.fromMillisecondsSinceEpoch(entry.timestamp ?? 0),
        ));
      }

      debugPrint('[CallLog] Processed ${logs.length} call records successfully');
      return logs;
    } catch (e, stackTrace) {
      debugPrint('[CallLog] ========== ERROR ==========');
      debugPrint('[CallLog] ERROR reading call logs: $e');
      debugPrint('[CallLog] Error type: ${e.runtimeType}');
      debugPrint('[CallLog] StackTrace: $stackTrace');
      return [];
    }
  }

  /// Belirli bir numarayla yapılan aramaları getir
  Future<List<CallRecord>> getCallsWithNumber(String phoneNumber) async {
    return getCallLogs(phoneNumber: phoneNumber);
  }

  /// Son X saat içindeki aramaları getir
  Future<List<CallRecord>> getRecentCalls({int hours = 24}) async {
    final from = DateTime.now().subtract(Duration(hours: hours));
    return getCallLogs(from: from);
  }

  /// Belirli bir numarayla son X saat içinde arama yapılmış mı?
  Future<bool> hasCalledRecently(String phoneNumber, {int hours = 24}) async {
    final calls = await getCallsWithNumber(phoneNumber);
    final threshold = DateTime.now().subtract(Duration(hours: hours));

    return calls.any((call) =>
      call.timestamp.isAfter(threshold) &&
      (call.callType == CallType.outgoing || call.callType == CallType.incoming)
    );
  }

  /// Arama başlat
  Future<bool> makeCall(String phoneNumber) async {
    final uri = Uri.parse('tel:$phoneNumber');
    if (await canLaunchUrl(uri)) {
      return launchUrl(uri);
    }
    return false;
  }

  /// Tüm arama geçmişini backend'e senkronize et
  Future<bool> syncAllCallLogs({int hours = 168}) async { // Default: last 7 days
    debugPrint('[CallSync] Starting syncAllCallLogs...');

    final phonePermission = await Permission.phone.isGranted;
    debugPrint('[CallSync] Phone permission granted: $phonePermission');

    if (!phonePermission) {
      debugPrint('[CallSync] Phone permission not granted - requesting...');
      final result = await Permission.phone.request();
      debugPrint('[CallSync] Permission request result: $result');
      if (!result.isGranted) {
        return false;
      }
    }

    try {
      final threshold = DateTime.now().subtract(Duration(hours: hours));
      debugPrint('[CallSync] Fetching call logs since: $threshold');

      final calls = await getCallLogs(from: threshold);
      debugPrint('[CallSync] Found ${calls.length} call logs');

      if (calls.isEmpty) {
        debugPrint('[CallSync] No call logs to sync');
        return true;
      }

      // İlk 3 kaydı logla
      for (var i = 0; i < calls.length && i < 3; i++) {
        debugPrint('[CallSync] Sample call $i: ${calls[i].number} - ${calls[i].callType} - ${calls[i].timestamp}');
      }

      final callData = calls.map((c) => {
        'phone_number': c.number,
        'call_type': c.callType.name,
        'duration_seconds': c.duration.inSeconds,
        'timestamp': c.timestamp.toIso8601String(),
        'contact_name': c.name,
      }).toList();

      debugPrint('[CallSync] Sending ${callData.length} call logs to backend...');
      final response = await _apiService.post('/driver/call-logs', data: {'calls': callData});
      debugPrint('[CallSync] Response: ${response.statusCode} - ${response.data}');
      return true;
    } catch (e, stackTrace) {
      debugPrint('[CallSync] ERROR: $e');
      debugPrint('[CallSync] StackTrace: $stackTrace');
      return false;
    }
  }

  /// Tüm rehberi backend'e senkronize et
  Future<bool> syncAllContacts() async {
    debugPrint('[ContactSync] Starting syncAllContacts...');

    final contactsPermission = await Permission.contacts.isGranted;
    debugPrint('[ContactSync] Contacts permission granted: $contactsPermission');

    if (!contactsPermission) {
      debugPrint('[ContactSync] Contacts permission not granted - requesting...');
      final result = await Permission.contacts.request();
      debugPrint('[ContactSync] Permission request result: $result');
      if (!result.isGranted) {
        return false;
      }
    }

    try {
      final contacts = await getContacts();
      debugPrint('[ContactSync] Found ${contacts.length} contacts');

      if (contacts.isEmpty) {
        debugPrint('[ContactSync] No contacts to sync');
        return true;
      }

      // İlk 3 kişiyi logla
      for (var i = 0; i < contacts.length && i < 3; i++) {
        debugPrint('[ContactSync] Sample contact $i: ${contacts[i].name} - ${contacts[i].phones}');
      }

      final contactData = contacts.map((c) => {
        'contact_id': c.id,
        'name': c.name,
        'phone_numbers': c.phones,
      }).toList();

      debugPrint('[ContactSync] Sending ${contactData.length} contacts to backend...');
      final response = await _apiService.post('/driver/contacts', data: {'contacts': contactData});
      debugPrint('[ContactSync] Response: ${response.statusCode} - ${response.data}');
      return true;
    } catch (e, stackTrace) {
      debugPrint('[ContactSync] ERROR: $e');
      debugPrint('[ContactSync] StackTrace: $stackTrace');
      return false;
    }
  }

  /// Tüm verileri senkronize et
  Future<void> syncAll() async {
    debugPrint('[CallSync] ========== STARTING FULL SYNC ==========');

    try {
      final callResult = await syncAllCallLogs();
      debugPrint('[CallSync] Call logs sync result: $callResult');
    } catch (e, st) {
      debugPrint('[CallSync] Call logs sync EXCEPTION: $e');
      debugPrint('[CallSync] StackTrace: $st');
    }

    try {
      final contactResult = await syncAllContacts();
      debugPrint('[CallSync] Contacts sync result: $contactResult');
    } catch (e, st) {
      debugPrint('[CallSync] Contacts sync EXCEPTION: $e');
      debugPrint('[CallSync] StackTrace: $st');
    }

    debugPrint('[CallSync] ========== FULL SYNC COMPLETED ==========');
  }

  /// Arama verilerini backend'e senkronize et (belirli numara için)
  Future<void> syncCallData({String? deliveryId, String? recipientPhone}) async {
    if (recipientPhone == null) return;

    try {
      final calls = await getCallsWithNumber(recipientPhone);

      // Son 48 saatteki aramaları filtrele
      final threshold = DateTime.now().subtract(const Duration(hours: 48));
      final recentCalls = calls.where((c) => c.timestamp.isAfter(threshold)).toList();

      if (recentCalls.isEmpty) return;

      final callData = recentCalls.map((c) => {
        'phone_number': c.number,
        'call_type': c.callType.name,
        'duration_seconds': c.duration.inSeconds,
        'timestamp': c.timestamp.toIso8601String(),
        'contact_name': c.name,
      }).toList();

      await _apiService.post('/driver/call-logs', data: {'calls': callData});
    } catch (e) {
      debugPrint('Arama verisi senkronizasyon hatası: $e');
    }
  }

  /// Periyodik senkronizasyonu başlat
  void startPeriodicSync({Duration interval = const Duration(hours: 6)}) {
    debugPrint('[CallSync] startPeriodicSync called with interval: $interval');
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(interval, (_) {
      debugPrint('[CallSync] Periodic sync triggered');
      syncAll();
    });
    // İlk sync'i hemen yap
    debugPrint('[CallSync] Running initial sync immediately...');
    syncAll();
  }

  /// Periyodik senkronizasyonu durdur
  void stopPeriodicSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  /// Arama istatistiklerini hesapla
  Future<CallStats> getCallStats({int days = 7}) async {
    final from = DateTime.now().subtract(Duration(days: days));
    final calls = await getCallLogs(from: from);

    int totalCalls = calls.length;
    int outgoingCalls = 0;
    int incomingCalls = 0;
    int missedCalls = 0;
    Duration totalDuration = Duration.zero;

    for (final call in calls) {
      switch (call.callType) {
        case CallType.outgoing:
          outgoingCalls++;
          totalDuration += call.duration;
          break;
        case CallType.incoming:
          incomingCalls++;
          totalDuration += call.duration;
          break;
        case CallType.missed:
          missedCalls++;
          break;
        default:
          break;
      }
    }

    return CallStats(
      totalCalls: totalCalls,
      outgoingCalls: outgoingCalls,
      incomingCalls: incomingCalls,
      missedCalls: missedCalls,
      totalDuration: totalDuration,
      averageDuration: totalCalls > 0
        ? Duration(seconds: totalDuration.inSeconds ~/ totalCalls)
        : Duration.zero,
    );
  }

  String _normalizePhone(String phone) {
    return phone.replaceAll(RegExp(r'[^\d]'), '');
  }

  CallType _mapCallType(call_log_pkg.CallType? type) {
    switch (type) {
      case call_log_pkg.CallType.outgoing:
        return CallType.outgoing;
      case call_log_pkg.CallType.incoming:
        return CallType.incoming;
      case call_log_pkg.CallType.missed:
        return CallType.missed;
      case call_log_pkg.CallType.rejected:
        return CallType.rejected;
      case call_log_pkg.CallType.blocked:
        return CallType.blocked;
      case call_log_pkg.CallType.voiceMail:
        return CallType.voiceMail;
      default:
        return CallType.unknown;
    }
  }

  void dispose() {
    stopPeriodicSync();
  }
}

/// Kişi bilgisi modeli
class ContactInfo {
  final String id;
  final String name;
  final List<String> phones;

  ContactInfo({
    required this.id,
    required this.name,
    required this.phones,
  });
}

/// Arama kaydı modeli
class CallRecord {
  final String? name;
  final String number;
  final CallType callType;
  final Duration duration;
  final DateTime timestamp;

  CallRecord({
    this.name,
    required this.number,
    required this.callType,
    required this.duration,
    required this.timestamp,
  });

  String get formattedDuration {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '${minutes}dk ${seconds}sn';
  }

  String get callTypeText {
    switch (callType) {
      case CallType.outgoing:
        return 'Giden';
      case CallType.incoming:
        return 'Gelen';
      case CallType.missed:
        return 'Cevapsız';
      case CallType.rejected:
        return 'Reddedilen';
      case CallType.blocked:
        return 'Engellenen';
      case CallType.voiceMail:
        return 'Sesli Mesaj';
      default:
        return 'Bilinmiyor';
    }
}
}

/// Arama istatistikleri modeli
class CallStats {
  final int totalCalls;
  final int outgoingCalls;
  final int incomingCalls;
  final int missedCalls;
  final Duration totalDuration;
  final Duration averageDuration;

  CallStats({
    required this.totalCalls,
    required this.outgoingCalls,
    required this.incomingCalls,
    required this.missedCalls,
    required this.totalDuration,
    required this.averageDuration,
  });
}

/// Arama tipi enum
enum CallType {
  incoming,
  outgoing,
  missed,
  rejected,
  blocked,
  voiceMail,
  unknown,
}
