import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../models/survey.dart';
import '../../services/api_service.dart';

class SurveyScreen extends StatefulWidget {
  final String surveyId;

  const SurveyScreen({super.key, required this.surveyId});

  @override
  State<SurveyScreen> createState() => _SurveyScreenState();
}

class _SurveyScreenState extends State<SurveyScreen> {
  Survey? _survey;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;
  final Map<String, String> _responses = {};

  @override
  void initState() {
    super.initState();
    _loadSurvey();
  }

  Future<void> _loadSurvey() async {
    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final response = await apiService.get('/driver/surveys/pending');
      final data = response.data as Map<String, dynamic>?;

      if (data != null && data['surveys'] != null) {
        final surveys = (data['surveys'] as List)
            .map((s) => Survey.fromJson(s as Map<String, dynamic>))
            .toList();

        // Find the specific survey
        final survey = surveys.firstWhere(
          (s) => s.id == widget.surveyId,
          orElse: () => throw Exception('Anket bulunamadi'),
        );

        setState(() {
          _survey = survey;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Anket bulunamadi';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _submitSurvey() async {
    if (_survey == null) return;

    // Check required questions
    for (final question in _survey!.questions) {
      if (question.isRequired && !_responses.containsKey(question.id)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lutfen tum zorunlu sorulari cevaplayin'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

    setState(() => _isSubmitting = true);

    try {
      final apiService = Provider.of<ApiService>(context, listen: false);

      final submitRequest = SurveySubmitRequest(
        responses: _responses.entries
            .map((e) => SurveyResponse(questionId: e.key, answer: e.value))
            .toList(),
      );

      await apiService.post(
        '/driver/surveys/${widget.surveyId}/respond',
        data: submitRequest.toJson(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Anket basariyla gonderildi!'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Widget _buildQuestion(SurveyQuestion question, int index) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  '${index + 1}. ${question.questionText}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (question.isRequired)
                  const Text(
                    ' *',
                    style: TextStyle(color: Colors.red, fontSize: 18),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            _buildAnswerWidget(question),
          ],
        ),
      ),
    );
  }

  Widget _buildAnswerWidget(SurveyQuestion question) {
    switch (question.questionType) {
      case 'yes_no':
        return Row(
          children: [
            Expanded(
              child: RadioListTile<String>(
                title: const Text('Evet'),
                value: 'yes',
                groupValue: _responses[question.id],
                onChanged: (v) => setState(() => _responses[question.id] = v!),
              ),
            ),
            Expanded(
              child: RadioListTile<String>(
                title: const Text('Hayir'),
                value: 'no',
                groupValue: _responses[question.id],
                onChanged: (v) => setState(() => _responses[question.id] = v!),
              ),
            ),
          ],
        );

      case 'multiple_choice':
        if (question.options == null || question.options!.isEmpty) {
          return const Text('Secenekler yuklenmedi');
        }
        return Column(
          children: question.options!.map((option) {
            return RadioListTile<String>(
              title: Text(option),
              value: option,
              groupValue: _responses[question.id],
              onChanged: (v) => setState(() => _responses[question.id] = v!),
            );
          }).toList(),
        );

      case 'number':
        return TextFormField(
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Sayi girin',
            border: OutlineInputBorder(),
          ),
          onChanged: (v) => _responses[question.id] = v,
        );

      case 'text':
      default:
        return TextFormField(
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Cevabiniz',
            border: OutlineInputBorder(),
          ),
          onChanged: (v) => _responses[question.id] = v,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_survey?.title ?? 'Anket'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(_error!, style: const TextStyle(fontSize: 16)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => context.pop(),
                        child: const Text('Geri Don'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    if (_survey?.description != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        color: Colors.blue.shade50,
                        child: Text(
                          _survey!.description!,
                          style: TextStyle(color: Colors.blue.shade700),
                        ),
                      ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _survey?.questions.length ?? 0,
                        itemBuilder: (context, index) {
                          return _buildQuestion(
                              _survey!.questions[index], index);
                        },
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(16),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _isSubmitting ? null : _submitSurvey,
                          icon: _isSubmitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.send),
                          label: const Text('Gonder'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
