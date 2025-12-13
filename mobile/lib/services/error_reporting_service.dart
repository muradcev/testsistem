import 'package:flutter/foundation.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Centralized error reporting service that sends errors to both
/// Firebase Crashlytics and Sentry for comprehensive crash monitoring.
class ErrorReportingService {
  /// Reports an error to both Crashlytics and Sentry
  static Future<void> reportError(
    dynamic error,
    StackTrace? stackTrace, {
    Map<String, dynamic>? extras,
    bool fatal = false,
  }) async {
    debugPrint('Error reported: $error');

    try {
      // Report to Firebase Crashlytics
      if (!kDebugMode) {
        await FirebaseCrashlytics.instance.recordError(
          error,
          stackTrace,
          fatal: fatal,
          information: extras?.entries
                  .map((e) => '${e.key}: ${e.value}')
                  .toList() ??
              [],
        );
      }
    } catch (e) {
      debugPrint('Failed to report to Crashlytics: $e');
    }

    try {
      // Report to Sentry
      await Sentry.captureException(
        error,
        stackTrace: stackTrace,
        withScope: (scope) {
          if (extras != null) {
            extras.forEach((key, value) {
              scope.setExtra(key, value);
            });
          }
          if (fatal) {
            scope.level = SentryLevel.fatal;
          }
        },
      );
    } catch (e) {
      debugPrint('Failed to report to Sentry: $e');
    }
  }

  /// Reports a Flutter error (from ErrorWidget.builder or FlutterError.onError)
  static Future<void> reportFlutterError(FlutterErrorDetails details) async {
    debugPrint('Flutter error: ${details.exception}');

    try {
      // Report to Crashlytics
      if (!kDebugMode) {
        await FirebaseCrashlytics.instance.recordFlutterFatalError(details);
      }
    } catch (e) {
      debugPrint('Failed to report Flutter error to Crashlytics: $e');
    }

    try {
      // Report to Sentry
      await Sentry.captureException(
        details.exception,
        stackTrace: details.stack,
        withScope: (scope) {
          scope.setExtra('library', details.library);
          scope.setExtra('context', details.context?.toString());
          scope.level = SentryLevel.error;
        },
      );
    } catch (e) {
      debugPrint('Failed to report Flutter error to Sentry: $e');
    }
  }

  /// Sets user information for error tracking
  static Future<void> setUser({
    required String id,
    String? name,
    String? phone,
  }) async {
    try {
      // Set user in Crashlytics
      if (!kDebugMode) {
        await FirebaseCrashlytics.instance.setUserIdentifier(id);
        if (name != null) {
          await FirebaseCrashlytics.instance.setCustomKey('user_name', name);
        }
        if (phone != null) {
          await FirebaseCrashlytics.instance.setCustomKey('user_phone', phone);
        }
      }
    } catch (e) {
      debugPrint('Failed to set user in Crashlytics: $e');
    }

    try {
      // Set user in Sentry
      Sentry.configureScope((scope) {
        scope.setUser(SentryUser(
          id: id,
          name: name,
          data: phone != null ? {'phone': phone} : null,
        ));
      });
    } catch (e) {
      debugPrint('Failed to set user in Sentry: $e');
    }
  }

  /// Clears user information (on logout)
  static Future<void> clearUser() async {
    try {
      if (!kDebugMode) {
        await FirebaseCrashlytics.instance.setUserIdentifier('');
      }
    } catch (e) {
      debugPrint('Failed to clear user in Crashlytics: $e');
    }

    try {
      Sentry.configureScope((scope) {
        scope.setUser(null);
      });
    } catch (e) {
      debugPrint('Failed to clear user in Sentry: $e');
    }
  }

  /// Logs a custom event/breadcrumb
  static Future<void> logEvent(
    String message, {
    String? category,
    Map<String, dynamic>? data,
  }) async {
    try {
      if (!kDebugMode) {
        await FirebaseCrashlytics.instance.log(message);
      }
    } catch (e) {
      debugPrint('Failed to log to Crashlytics: $e');
    }

    try {
      Sentry.addBreadcrumb(Breadcrumb(
        message: message,
        category: category ?? 'app',
        data: data,
        level: SentryLevel.info,
      ));
    } catch (e) {
      debugPrint('Failed to add breadcrumb to Sentry: $e');
    }
  }

  /// Sets a custom key-value pair for debugging
  static Future<void> setCustomKey(String key, dynamic value) async {
    try {
      if (!kDebugMode) {
        await FirebaseCrashlytics.instance.setCustomKey(key, value.toString());
      }
    } catch (e) {
      debugPrint('Failed to set custom key in Crashlytics: $e');
    }

    try {
      Sentry.configureScope((scope) {
        scope.setExtra(key, value);
      });
    } catch (e) {
      debugPrint('Failed to set custom key in Sentry: $e');
    }
  }

  /// Force a test crash (only in debug mode)
  static void testCrash() {
    if (kDebugMode) {
      throw Exception('Test crash from ErrorReportingService');
    }
  }
}
