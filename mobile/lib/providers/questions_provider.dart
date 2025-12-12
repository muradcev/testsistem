import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class Question {
  final String id;
  final String questionText;
  final String questionType; // yes_no, multiple_choice, text, number, price
  final List<String>? options;
  final int priority;
  final DateTime? expiresAt;

  Question({
    required this.id,
    required this.questionText,
    required this.questionType,
    this.options,
    this.priority = 0,
    this.expiresAt,
  });

  factory Question.fromJson(Map<String, dynamic> json) {
    List<String>? options;
    if (json['options'] != null) {
      if (json['options'] is List) {
        options = List<String>.from(json['options']);
      }
    }

    return Question(
      id: json['id'] ?? '',
      questionText: json['question_text'] ?? '',
      questionType: json['question_type'] ?? 'text',
      options: options,
      priority: json['priority'] ?? 0,
      expiresAt: json['expires_at'] != null
          ? DateTime.tryParse(json['expires_at'])
          : null,
    );
  }
}

class QuestionsProvider extends ChangeNotifier {
  final ApiService _apiService;

  bool _isLoading = false;
  List<Question> _questions = [];
  String? _error;
  bool _isAnswering = false;

  QuestionsProvider(this._apiService);

  bool get isLoading => _isLoading;
  List<Question> get questions => _questions;
  int get pendingCount => _questions.length;
  String? get error => _error;
  bool get isAnswering => _isAnswering;

  Future<void> loadPendingQuestions() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getPendingQuestions();
      final questionsData = response.data['questions'] as List? ?? [];
      _questions = questionsData
          .map((q) => Question.fromJson(q as Map<String, dynamic>))
          .toList();

      // Sort by priority (higher first)
      _questions.sort((a, b) => b.priority.compareTo(a.priority));
    } catch (e) {
      debugPrint('Failed to load questions: $e');
      _error = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> answerQuestion({
    required String questionId,
    required String answerValue,
    List<Map<String, dynamic>>? followUpAnswers,
    int? answerDurationSeconds,
    double? latitude,
    double? longitude,
  }) async {
    _isAnswering = true;
    _error = null;
    notifyListeners();

    try {
      final data = <String, dynamic>{
        'answer_value': answerValue,
      };

      if (followUpAnswers != null && followUpAnswers.isNotEmpty) {
        data['follow_up_answers'] = followUpAnswers;
      }
      if (answerDurationSeconds != null) {
        data['answer_duration_seconds'] = answerDurationSeconds;
      }
      if (latitude != null) {
        data['latitude'] = latitude;
      }
      if (longitude != null) {
        data['longitude'] = longitude;
      }

      await _apiService.answerQuestion(questionId, data);

      // Remove answered question from list
      _questions.removeWhere((q) => q.id == questionId);

      _isAnswering = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Failed to answer question: $e');
      _error = _parseError(e);
      _isAnswering = false;
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
