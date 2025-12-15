class Survey {
  final String id;
  final String title;
  final String? description;
  final String triggerType;
  final bool isActive;
  final List<SurveyQuestion> questions;
  final DateTime createdAt;

  Survey({
    required this.id,
    required this.title,
    this.description,
    required this.triggerType,
    required this.isActive,
    required this.questions,
    required this.createdAt,
  });

  factory Survey.fromJson(Map<String, dynamic> json) {
    return Survey(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      triggerType: json['trigger_type'] as String? ?? 'manual',
      isActive: json['is_active'] as bool? ?? true,
      questions: (json['questions'] as List<dynamic>?)
              ?.map((q) => SurveyQuestion.fromJson(q as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}

class SurveyQuestion {
  final String id;
  final String surveyId;
  final String questionText;
  final String questionType; // yes_no, multiple_choice, number, text
  final List<String>? options;
  final bool isRequired;
  final int order;

  SurveyQuestion({
    required this.id,
    required this.surveyId,
    required this.questionText,
    required this.questionType,
    this.options,
    required this.isRequired,
    required this.order,
  });

  factory SurveyQuestion.fromJson(Map<String, dynamic> json) {
    List<String>? options;
    if (json['options'] != null) {
      if (json['options'] is List) {
        options = (json['options'] as List).cast<String>();
      } else if (json['options'] is Map) {
        final optMap = json['options'] as Map<String, dynamic>;
        if (optMap['choices'] != null) {
          options = (optMap['choices'] as List).cast<String>();
        }
      }
    }

    return SurveyQuestion(
      id: json['id'] as String,
      surveyId: json['survey_id'] as String? ?? '',
      questionText: json['question_text'] as String,
      questionType: json['question_type'] as String? ?? 'text',
      options: options,
      isRequired: json['is_required'] as bool? ?? false,
      order: json['order'] as int? ?? 0,
    );
  }
}

class SurveyResponse {
  final String questionId;
  final String answer;

  SurveyResponse({
    required this.questionId,
    required this.answer,
  });

  Map<String, dynamic> toJson() {
    return {
      'question_id': questionId,
      'answer': answer,
    };
  }
}

class SurveySubmitRequest {
  final List<SurveyResponse> responses;
  final double? latitude;
  final double? longitude;

  SurveySubmitRequest({
    required this.responses,
    this.latitude,
    this.longitude,
  });

  Map<String, dynamic> toJson() {
    return {
      'responses': responses.map((r) => r.toJson()).toList(),
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    };
  }
}
