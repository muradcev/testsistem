import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../config/constants.dart';

/// Log seviyeleri
enum LogLevel {
  debug,
  info,
  warning,
  error,
  critical,
}

/// Log kategorileri
enum LogCategory {
  auth,
  location,
  network,
  ui,
  background,
  notification,
  trip,
  system,
  performance,
  other,
}

/// Tek bir log kaydı
class AppLog {
  final String id;
  final LogLevel level;
  final LogCategory category;
  final String message;
  final String? stackTrace;
  final Map<String, dynamic>? metadata;
  final DateTime timestamp;
  final String? screen;
  final String? action;

  AppLog({
    required this.id,
    required this.level,
    required this.category,
    required this.message,
    this.stackTrace,
    this.metadata,
    required this.timestamp,
    this.screen,
    this.action,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'level': level.name,
        'category': category.name,
        'message': message,
        'stack_trace': stackTrace,
        'metadata': metadata,
        'timestamp': timestamp.toUtc().toIso8601String(),
        'screen': screen,
        'action': action,
      };

  factory AppLog.fromJson(Map<String, dynamic> json) => AppLog(
        id: json['id'],
        level: LogLevel.values.firstWhere((e) => e.name == json['level']),
        category:
            LogCategory.values.firstWhere((e) => e.name == json['category']),
        message: json['message'],
        stackTrace: json['stack_trace'],
        metadata: json['metadata'],
        timestamp: DateTime.parse(json['timestamp']),
        screen: json['screen'],
        action: json['action'],
      );
}

/// Ana log servisi - Singleton
class AppLogService {
  static final AppLogService _instance = AppLogService._internal();
  factory AppLogService() => _instance;
  AppLogService._internal();

  static AppLogService get instance => _instance;

  // Konfigürasyon
  static const int _maxBufferSize = 500;
  static const int _batchSize = 50;
  static const Duration _sendInterval = Duration(minutes: 5);
  // ignore: unused_field - Reserved for future retry logic
  static const Duration _retryDelay = Duration(seconds: 30);

  // Durum
  bool _isInitialized = false;
  Timer? _sendTimer;
  final List<AppLog> _logBuffer = [];
  String? _deviceId;
  String? _deviceModel;
  String? _osVersion;
  String? _appVersion;
  String? _buildNumber;
  String? _driverId;

  // Connectivity
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isOnline = true;

  /// Servisi başlat
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Cihaz bilgilerini al
      await _loadDeviceInfo();

      // Buffered log'ları yükle
      await _loadBufferedLogs();

      // Connectivity dinle
      _connectivitySubscription =
          Connectivity().onConnectivityChanged.listen((result) {
        _isOnline = !result.contains(ConnectivityResult.none);
        if (_isOnline) {
          _sendBufferedLogs();
        }
      });

      // Periyodik gönderim timer'ı
      _sendTimer = Timer.periodic(_sendInterval, (_) => _sendBufferedLogs());

      _isInitialized = true;
      debugPrint('[AppLog] Service initialized');

      // Başlatma log'u
      info(
        LogCategory.system,
        'App log service initialized',
        metadata: {
          'device_model': _deviceModel,
          'os_version': _osVersion,
          'app_version': _appVersion,
        },
      );
    } catch (e) {
      debugPrint('[AppLog] Initialization error: $e');
    }
  }

  /// Driver ID'yi set et (login sonrası)
  void setDriverId(String? driverId) {
    _driverId = driverId;
  }

  /// Cihaz bilgilerini yükle
  Future<void> _loadDeviceInfo() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      final packageInfo = await PackageInfo.fromPlatform();

      _appVersion = packageInfo.version;
      _buildNumber = packageInfo.buildNumber;

      if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        _deviceId = androidInfo.id;
        _deviceModel = '${androidInfo.brand} ${androidInfo.model}';
        _osVersion = 'Android ${androidInfo.version.release}';
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        _deviceId = iosInfo.identifierForVendor;
        _deviceModel = iosInfo.model;
        _osVersion = '${iosInfo.systemName} ${iosInfo.systemVersion}';
      }
    } catch (e) {
      debugPrint('[AppLog] Device info error: $e');
    }
  }

  /// Buffered log'ları yükle
  Future<void> _loadBufferedLogs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final bufferedJson = prefs.getString(StorageKeys.bufferedLogs);

      if (bufferedJson != null && bufferedJson.isNotEmpty) {
        final List<dynamic> decoded = json.decode(bufferedJson);
        _logBuffer.addAll(decoded.map((e) => AppLog.fromJson(e)));
        debugPrint('[AppLog] Loaded ${_logBuffer.length} buffered logs');
      }
    } catch (e) {
      debugPrint('[AppLog] Load buffer error: $e');
    }
  }

  /// Buffered log'ları kaydet
  Future<void> _saveBufferedLogs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = json.encode(_logBuffer.map((e) => e.toJson()).toList());
      await prefs.setString(StorageKeys.bufferedLogs, encoded);
    } catch (e) {
      debugPrint('[AppLog] Save buffer error: $e');
    }
  }

  /// Log ekle
  void _addLog(AppLog log) {
    // Buffer'a ekle
    _logBuffer.add(log);

    // Buffer taşarsa en eskisini sil
    while (_logBuffer.length > _maxBufferSize) {
      _logBuffer.removeAt(0);
    }

    // Console'a yaz
    _printToConsole(log);

    // Async olarak kaydet
    _saveBufferedLogs();

    // Critical log'ları hemen gönder
    if (log.level == LogLevel.critical || log.level == LogLevel.error) {
      _sendBufferedLogs();
    }
  }

  /// Console'a yaz
  void _printToConsole(AppLog log) {
    final prefix = switch (log.level) {
      LogLevel.debug => '🔍 [DEBUG]',
      LogLevel.info => 'ℹ️ [INFO]',
      LogLevel.warning => '⚠️ [WARN]',
      LogLevel.error => '❌ [ERROR]',
      LogLevel.critical => '🚨 [CRITICAL]',
    };

    debugPrint('$prefix [${log.category.name}] ${log.message}');
    if (log.stackTrace != null) {
      debugPrint('Stack trace: ${log.stackTrace}');
    }
  }

  /// Buffered log'ları sunucuya gönder
  Future<void> _sendBufferedLogs() async {
    if (_logBuffer.isEmpty || !_isOnline) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString(StorageKeys.accessToken);

      if (accessToken == null || accessToken.isEmpty) {
        debugPrint('[AppLog] No access token, skipping send');
        return;
      }

      // Batch al
      final logsToSend = _logBuffer.take(_batchSize).toList();

      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      ));

      final response = await dio.post(
        ApiConstants.appLogsBatch,
        data: {
          'logs': logsToSend.map((e) => e.toJson()).toList(),
          'device_id': _deviceId,
          'device_model': _deviceModel,
          'os_version': _osVersion,
          'app_version': _appVersion,
          'build_number': _buildNumber,
          'driver_id': _driverId,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Gönderilen log'ları buffer'dan sil
        for (var log in logsToSend) {
          _logBuffer.remove(log);
        }
        await _saveBufferedLogs();
        await prefs.setString(
            StorageKeys.lastLogSendTime, DateTime.now().toIso8601String());

        debugPrint('[AppLog] Sent ${logsToSend.length} logs successfully');

        // Daha fazla log varsa tekrar gönder
        if (_logBuffer.length >= _batchSize) {
          Future.delayed(const Duration(seconds: 2), _sendBufferedLogs);
        }
      }
    } catch (e) {
      debugPrint('[AppLog] Send error: $e');
      // Retry sonra yapılacak
    }
  }

  // ========== PUBLIC LOG METHODS ==========

  /// Debug log
  void debug(
    LogCategory category,
    String message, {
    Map<String, dynamic>? metadata,
    String? screen,
    String? action,
  }) {
    if (kReleaseMode) return; // Release'de debug log'ları atla

    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.debug,
      category: category,
      message: message,
      metadata: metadata,
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// Info log
  void info(
    LogCategory category,
    String message, {
    Map<String, dynamic>? metadata,
    String? screen,
    String? action,
  }) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.info,
      category: category,
      message: message,
      metadata: metadata,
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// Warning log
  void warning(
    LogCategory category,
    String message, {
    Map<String, dynamic>? metadata,
    String? screen,
    String? action,
  }) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.warning,
      category: category,
      message: message,
      metadata: metadata,
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// Error log
  void error(
    LogCategory category,
    String message, {
    dynamic error,
    StackTrace? stackTrace,
    Map<String, dynamic>? metadata,
    String? screen,
    String? action,
  }) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.error,
      category: category,
      message: message,
      stackTrace: stackTrace?.toString() ?? error?.toString(),
      metadata: {
        ...?metadata,
        if (error != null) 'error_type': error.runtimeType.toString(),
      },
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// Critical log (hemen gönderilir)
  void critical(
    LogCategory category,
    String message, {
    dynamic error,
    StackTrace? stackTrace,
    Map<String, dynamic>? metadata,
    String? screen,
    String? action,
  }) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.critical,
      category: category,
      message: message,
      stackTrace: stackTrace?.toString() ?? error?.toString(),
      metadata: {
        ...?metadata,
        if (error != null) 'error_type': error.runtimeType.toString(),
      },
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// Performance log
  void performance(
    String action,
    Duration duration, {
    Map<String, dynamic>? metadata,
    String? screen,
  }) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.info,
      category: LogCategory.performance,
      message: 'Performance: $action took ${duration.inMilliseconds}ms',
      metadata: {
        ...?metadata,
        'duration_ms': duration.inMilliseconds,
        'action': action,
      },
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// Network request log
  void networkRequest(
    String method,
    String path, {
    int? statusCode,
    int? durationMs,
    String? errorMessage,
  }) {
    final isError = statusCode != null && statusCode >= 400;

    _addLog(AppLog(
      id: _generateId(),
      level: isError ? LogLevel.error : LogLevel.info,
      category: LogCategory.network,
      message: '$method $path - ${statusCode ?? 'pending'}',
      metadata: {
        'method': method,
        'path': path,
        if (statusCode != null) 'status_code': statusCode,
        if (durationMs != null) 'duration_ms': durationMs,
        if (errorMessage != null) 'error': errorMessage,
      },
      timestamp: DateTime.now(),
      action: '$method $path',
    ));
  }

  /// Screen navigation log
  void screenView(String screenName, {Map<String, dynamic>? params}) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.info,
      category: LogCategory.ui,
      message: 'Screen viewed: $screenName',
      metadata: params,
      timestamp: DateTime.now(),
      screen: screenName,
      action: 'screen_view',
    ));
  }

  /// User action log
  void userAction(
    String action, {
    String? screen,
    Map<String, dynamic>? metadata,
  }) {
    _addLog(AppLog(
      id: _generateId(),
      level: LogLevel.info,
      category: LogCategory.ui,
      message: 'User action: $action',
      metadata: metadata,
      timestamp: DateTime.now(),
      screen: screen,
      action: action,
    ));
  }

  /// ID üret
  String _generateId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${_logBuffer.length}';
  }

  /// Tüm log'ları zorla gönder
  Future<void> flush() async {
    await _sendBufferedLogs();
  }

  /// Buffer'daki log sayısı
  int get bufferCount => _logBuffer.length;

  /// Son log'ları al (debug için)
  List<AppLog> getRecentLogs({int count = 50}) {
    final start =
        _logBuffer.length > count ? _logBuffer.length - count : 0;
    return _logBuffer.sublist(start);
  }

  /// Dispose
  void dispose() {
    _sendTimer?.cancel();
    _connectivitySubscription?.cancel();
    _saveBufferedLogs();
  }
}

/// Global erişim için kısayol
AppLogService get appLog => AppLogService.instance;
