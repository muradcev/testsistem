import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class SurveyScreen extends StatefulWidget {
  final String surveyId;

  const SurveyScreen({super.key, required this.surveyId});

  @override
  State<SurveyScreen> createState() => _SurveyScreenState();
}

class _SurveyScreenState extends State<SurveyScreen> {
  // TODO: Load survey from API
  final Map<String, dynamic> _responses = {};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Anket'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Expanded(
              child: ListView(
                children: [
                  // Sample survey questions - will be loaded from API
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '1. Bu sefer için yük taşıdınız mı?',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: RadioListTile<String>(
                                  title: const Text('Evet'),
                                  value: 'yes',
                                  groupValue: _responses['q1'],
                                  onChanged: (v) => setState(() => _responses['q1'] = v),
                                ),
                              ),
                              Expanded(
                                child: RadioListTile<String>(
                                  title: const Text('Hayır'),
                                  value: 'no',
                                  groupValue: _responses['q1'],
                                  onChanged: (v) => setState(() => _responses['q1'] = v),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '2. Taşıma ücreti ne kadardı?',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Tutar (TL)',
                              prefixIcon: Icon(Icons.attach_money),
                            ),
                            onChanged: (v) => _responses['q2'] = v,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () {
                // TODO: Submit survey
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Anket gönderildi!')),
                );
                context.pop();
              },
              child: const Text('Gönder'),
            ),
          ],
        ),
      ),
    );
  }
}
