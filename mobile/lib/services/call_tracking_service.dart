import 'package:call_log/call_log.dart' as call_log_pkg;
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import 'api_service.dart';

/// Arama takip servisi - Şoförün yük sahipleriyle iletişimini takip eder
class CallTrackingService {
  final ApiService _apiService;
  Timer? _syncTimer;
  DateTime? _lastSyncTime;

  CallTrackingService(this._apiService);

  /// İzinleri kontrol et ve iste
  Future<bool> requestPermissions() async {
    final contacts = await Permission.contacts.request();
    final phone = await Permission.phone.request();

    return contacts.isGranted && phone.isGranted;
  }

  /// İzinlerin durumunu kontrol et
  Future<Map<String, bool>> checkPermissions() async {
    final contacts = await Permission.contacts.isGranted;
    final phone = await Permission.phone.isGranted;

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
      print('Rehber okuma hatası: $e');
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
    if (!await Permission.phone.isGranted) {
      return [];
    }

    try {
      Iterable<call_log_pkg.CallLogEntry> entries;

      if (phoneNumber != null) {
        // Belirli bir numara için arama geçmişi
        entries = await call_log_pkg.CallLog.query(number: phoneNumber);
      } else if (from != null || to != null) {
        // Tarih aralığı için arama geçmişi
        entries = await call_log_pkg.CallLog.query(
          dateFrom: from?.millisecondsSinceEpoch,
          dateTo: to?.millisecondsSinceEpoch,
        );
      } else {
        // Son 100 arama
        entries = await call_log_pkg.CallLog.get();
      }

      final logs = <CallRecord>[];
      for (final entry in entries) {
        logs.add(CallRecord(
          name: entry.name,
          number: entry.number ?? '',
          callType: _mapCallType(entry.callType),
          duration: Duration(seconds: entry.duration ?? 0),
          timestamp: DateTime.fromMillisecondsSinceEpoch(entry.timestamp ?? 0),
        ));
      }

      return logs;
    } catch (e) {
      print('Arama geçmişi okuma hatası: $e');
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

  /// Arama verilerini backend'e senkronize et
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
        'delivery_id': deliveryId,
      }).toList();

      await _apiService.post('/driver/call-logs', data: {'calls': callData});
      _lastSyncTime = DateTime.now();
    } catch (e) {
      print('Arama verisi senkronizasyon hatası: $e');
    }
  }

  /// Periyodik senkronizasyonu başlat
  void startPeriodicSync({Duration interval = const Duration(hours: 1)}) {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(interval, (_) {
      syncCallData();
    });
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
