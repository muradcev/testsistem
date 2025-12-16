import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/questions_provider.dart';

class QuestionsScreen extends StatefulWidget {
  const QuestionsScreen({super.key});

  @override
  State<QuestionsScreen> createState() => _QuestionsScreenState();
}

class _QuestionsScreenState extends State<QuestionsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQuestions();
    });
  }

  Future<void> _loadQuestions() async {
    if (!mounted) return;
    await context.read<QuestionsProvider>().loadPendingQuestions();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sorular'),
      ),
      body: Consumer<QuestionsProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(provider.error!, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _loadQuestions,
                    child: const Text('Tekrar Dene'),
                  ),
                ],
              ),
            );
          }

          if (provider.questions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 64, color: Colors.green.shade400),
                  const SizedBox(height: 16),
                  const Text(
                    'Cevaplanacak soru yok',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Tebrikler! Tum sorulari cevaplamissiniz.',
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _loadQuestions,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.questions.length,
              itemBuilder: (context, index) {
                final question = provider.questions[index];
                return _QuestionCard(
                  question: question,
                  onAnswered: () {
                    // Refresh after answering
                    setState(() {});
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _QuestionCard extends StatefulWidget {
  final Question question;
  final VoidCallback onAnswered;

  const _QuestionCard({
    required this.question,
    required this.onAnswered,
  });

  @override
  State<_QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends State<_QuestionCard> {
  String? _selectedOption;
  String? _selectedProvince;
  String? _selectedDistrict;
  final _textController = TextEditingController();
  DateTime? _startTime;

  @override
  void initState() {
    super.initState();
    _startTime = DateTime.now();
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  int get _answerDuration {
    if (_startTime == null) return 0;
    return DateTime.now().difference(_startTime!).inSeconds;
  }

  Future<void> _submitAnswer(String answer) async {
    final provider = context.read<QuestionsProvider>();

    final success = await provider.answerQuestion(
      questionId: widget.question.id,
      answerValue: answer,
      answerDurationSeconds: _answerDuration,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cevabiniz kaydedildi'),
          backgroundColor: Colors.green,
        ),
      );
      widget.onAnswered();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Bir hata olustu'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<QuestionsProvider>();

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Priority badge
            if (widget.question.priority > 5)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Oncelikli',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.orange.shade800,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),

            // Question text
            Text(
              widget.question.questionText,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 16),

            // Answer input based on question type
            _buildAnswerInput(),

            // Submit button for text/number types
            if (widget.question.questionType == 'text' ||
                widget.question.questionType == 'number' ||
                widget.question.questionType == 'price')
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: provider.isAnswering
                        ? null
                        : () {
                            if (_textController.text.isNotEmpty) {
                              _submitAnswer(_textController.text);
                            }
                          },
                    child: provider.isAnswering
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Gonder'),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnswerInput() {
    final provider = context.watch<QuestionsProvider>();

    switch (widget.question.questionType) {
      case 'yes_no':
        return Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed:
                    provider.isAnswering ? null : () => _submitAnswer('true'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                ),
                child: provider.isAnswering
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Evet'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                onPressed:
                    provider.isAnswering ? null : () => _submitAnswer('false'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
                child: provider.isAnswering
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Hayir'),
              ),
            ),
          ],
        );

      case 'multiple_choice':
        if (widget.question.options == null ||
            widget.question.options!.isEmpty) {
          return const Text('Secenekler yuklenemedi');
        }
        return Column(
          children: widget.question.options!.map((option) {
            final isSelected = _selectedOption == option;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                onTap: provider.isAnswering
                    ? null
                    : () {
                        setState(() => _selectedOption = option);
                        _submitAnswer(option);
                      },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isSelected
                          ? Theme.of(context).primaryColor
                          : Colors.grey.shade300,
                      width: isSelected ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(8),
                    color: isSelected
                        ? Theme.of(context).primaryColor.withValues(alpha: 0.1)
                        : null,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isSelected
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked,
                        color: isSelected
                            ? Theme.of(context).primaryColor
                            : Colors.grey,
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(option)),
                      if (isSelected && provider.isAnswering)
                        const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        );

      case 'number':
      case 'price':
        return TextField(
          controller: _textController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: widget.question.questionType == 'price'
                ? 'Tutar (TL)'
                : 'Deger',
            prefixIcon: widget.question.questionType == 'price'
                ? const Icon(Icons.attach_money)
                : const Icon(Icons.numbers),
            border: const OutlineInputBorder(),
          ),
        );

      case 'province':
        // İl seçimi - options içinde iller var
        if (widget.question.options == null ||
            widget.question.options!.isEmpty) {
          return const Text('İller yüklenemedi');
        }
        return _buildProvinceSelector();

      case 'province_district':
        // İl-İlçe seçimi
        if (widget.question.options == null ||
            widget.question.options!.isEmpty) {
          return const Text('İller yüklenemedi');
        }
        return _buildProvinceDistrictSelector();

      case 'text':
      default:
        return TextField(
          controller: _textController,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Cevabin',
            border: OutlineInputBorder(),
          ),
        );
    }
  }

  Widget _buildProvinceSelector() {
    final provider = context.watch<QuestionsProvider>();
    final provinces = widget.question.options ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(8),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              hint: const Text('İl seçin'),
              value: _selectedProvince,
              items: provinces.map((province) {
                return DropdownMenuItem<String>(
                  value: province,
                  child: Text(province),
                );
              }).toList(),
              onChanged: provider.isAnswering
                  ? null
                  : (value) {
                      setState(() => _selectedProvince = value);
                    },
            ),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: provider.isAnswering || _selectedProvince == null
                ? null
                : () => _submitAnswer(_selectedProvince!),
            child: provider.isAnswering
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Gönder'),
          ),
        ),
      ],
    );
  }

  Widget _buildProvinceDistrictSelector() {
    final provider = context.watch<QuestionsProvider>();
    final provinces = widget.question.options ?? [];

    // İlçe listesi - basit bir eşleştirme
    final districts = _getDistrictsForProvince(_selectedProvince);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // İl seçimi
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(8),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              hint: const Text('İl seçin'),
              value: _selectedProvince,
              items: provinces.map((province) {
                return DropdownMenuItem<String>(
                  value: province,
                  child: Text(province),
                );
              }).toList(),
              onChanged: provider.isAnswering
                  ? null
                  : (value) {
                      setState(() {
                        _selectedProvince = value;
                        _selectedDistrict = null; // İlçeyi sıfırla
                      });
                    },
            ),
          ),
        ),
        const SizedBox(height: 12),

        // İlçe seçimi
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            border: Border.all(
              color: _selectedProvince == null
                  ? Colors.grey.shade200
                  : Colors.grey.shade300,
            ),
            borderRadius: BorderRadius.circular(8),
            color:
                _selectedProvince == null ? Colors.grey.shade100 : Colors.white,
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              hint: Text(
                _selectedProvince == null ? 'Önce il seçin' : 'İlçe seçin',
                style: TextStyle(
                  color: _selectedProvince == null
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              value: _selectedDistrict,
              items: districts.map((district) {
                return DropdownMenuItem<String>(
                  value: district,
                  child: Text(district),
                );
              }).toList(),
              onChanged: _selectedProvince == null || provider.isAnswering
                  ? null
                  : (value) {
                      setState(() => _selectedDistrict = value);
                    },
            ),
          ),
        ),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: provider.isAnswering ||
                    _selectedProvince == null ||
                    _selectedDistrict == null
                ? null
                : () =>
                    _submitAnswer('$_selectedProvince / $_selectedDistrict'),
            child: provider.isAnswering
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Gönder'),
          ),
        ),
      ],
    );
  }

  List<String> _getDistrictsForProvince(String? province) {
    if (province == null) return [];

    // İlçe verileri - yaygın kullanılan ilçeler
    final districtMap = {
      'Adana': [
        'Seyhan',
        'Yüreğir',
        'Çukurova',
        'Sarıçam',
        'Ceyhan',
        'Kozan',
        'İmamoğlu',
        'Karaisalı'
      ],
      'Ankara': [
        'Çankaya',
        'Keçiören',
        'Mamak',
        'Etimesgut',
        'Sincan',
        'Yenimahalle',
        'Altındağ',
        'Pursaklar',
        'Polatlı'
      ],
      'Antalya': [
        'Muratpaşa',
        'Kepez',
        'Konyaaltı',
        'Aksu',
        'Döşemealtı',
        'Alanya',
        'Manavgat',
        'Serik'
      ],
      'Bursa': [
        'Osmangazi',
        'Yıldırım',
        'Nilüfer',
        'İnegöl',
        'Gemlik',
        'Mudanya',
        'Gürsu',
        'Kestel'
      ],
      'Gaziantep': [
        'Şahinbey',
        'Şehitkamil',
        'Nizip',
        'İslahiye',
        'Nurdağı',
        'Araban',
        'Oğuzeli'
      ],
      'İstanbul': [
        'Kadıköy',
        'Üsküdar',
        'Beşiktaş',
        'Fatih',
        'Bakırköy',
        'Beyoğlu',
        'Maltepe',
        'Pendik',
        'Kartal',
        'Ataşehir',
        'Ümraniye',
        'Şişli',
        'Sarıyer',
        'Beykoz',
        'Beylikdüzü',
        'Esenyurt',
        'Küçükçekmece',
        'Bağcılar',
        'Bahçelievler',
        'Tuzla',
        'Sancaktepe',
        'Sultanbeyli',
        'Arnavutköy',
        'Silivri'
      ],
      'İzmir': [
        'Konak',
        'Karşıyaka',
        'Bornova',
        'Buca',
        'Bayraklı',
        'Çiğli',
        'Gaziemir',
        'Karabağlar',
        'Narlıdere',
        'Aliağa',
        'Bergama',
        'Çeşme',
        'Menemen',
        'Torbalı'
      ],
      'Kocaeli': [
        'İzmit',
        'Gebze',
        'Darıca',
        'Körfez',
        'Gölcük',
        'Derince',
        'Başiskele',
        'Kartepe',
        'Çayırova'
      ],
      'Konya': [
        'Selçuklu',
        'Meram',
        'Karatay',
        'Ereğli',
        'Akşehir',
        'Beyşehir',
        'Cihanbeyli',
        'Seydişehir'
      ],
      'Mersin': [
        'Akdeniz',
        'Mezitli',
        'Toroslar',
        'Yenişehir',
        'Tarsus',
        'Erdemli',
        'Silifke',
        'Anamur'
      ],
      'Samsun': [
        'İlkadım',
        'Atakum',
        'Canik',
        'Tekkeköy',
        'Bafra',
        'Çarşamba',
        'Terme',
        'Vezirköprü'
      ],
      'Trabzon': [
        'Ortahisar',
        'Akçaabat',
        'Araklı',
        'Vakfıkebir',
        'Of',
        'Yomra',
        'Sürmene',
        'Maçka'
      ],
    };

    // Eğer ilçe listesi varsa döndür, yoksa genel ilçeler
    if (districtMap.containsKey(province)) {
      return districtMap[province]!;
    }

    // Diğer iller için varsayılan ilçeler
    return ['Merkez', 'Diğer'];
  }
}
