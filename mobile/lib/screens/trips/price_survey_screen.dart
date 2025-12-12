import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/cargo.dart';
import '../../providers/config_provider.dart';
import '../../services/api_service.dart';

class PriceSurveyScreen extends StatefulWidget {
  const PriceSurveyScreen({Key? key}) : super(key: key);

  @override
  State<PriceSurveyScreen> createState() => _PriceSurveyScreenState();
}

class _PriceSurveyScreenState extends State<PriceSurveyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _priceController = TextEditingController();
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();

  String? _fromProvince;
  String? _fromDistrict;
  String? _toProvince;
  String? _toDistrict;
  String? _selectedCargoTypeId;
  DateTime _tripDate = DateTime.now();
  bool _isLoading = false;

  // Türkiye illeri (basit liste)
  final List<String> _provinces = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya',
    'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu',
    'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır',
    'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun',
    'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir',
    'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya',
    'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
    'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop',
    'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
    'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale',
    'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük',
    'Kilis', 'Osmaniye', 'Düzce',
  ];

  @override
  void dispose() {
    _priceController.dispose();
    _weightController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _tripDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _tripDate = picked);
    }
  }

  Future<void> _submitSurvey() async {
    if (!_formKey.currentState!.validate()) return;

    if (_fromProvince == null || _toProvince == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lütfen güzergah bilgisini girin'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final apiService = Provider.of<ApiService>(context, listen: false);

      final survey = PriceSurvey(
        fromProvince: _fromProvince!,
        fromDistrict: _fromDistrict,
        toProvince: _toProvince!,
        toDistrict: _toDistrict,
        price: double.parse(_priceController.text),
        cargoTypeId: _selectedCargoTypeId,
        weightTons: _weightController.text.isNotEmpty
            ? double.parse(_weightController.text)
            : null,
        notes: _notesController.text.isNotEmpty ? _notesController.text : null,
        tripDate: _tripDate.toIso8601String().split('T')[0],
      );

      await apiService.post('/driver/price-survey', data: survey.toJson());

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fiyat bilgisi kaydedildi. Teşekkürler!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
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
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final configProvider = Provider.of<ConfigProvider>(context);
    final cargoTypes = configProvider.cargoTypes;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Fiyat Bilgisi Paylaş'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bilgi kartı
              Card(
                color: Colors.blue.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue.shade700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Paylaştığınız fiyat bilgileri sektör analizlerinde kullanılacak ve kimliğiniz gizli tutulacaktır.',
                          style: TextStyle(color: Colors.blue.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Güzergah
              Text(
                'Güzergah',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),

              // Nereden
              DropdownButtonFormField<String>(
                value: _fromProvince,
                decoration: const InputDecoration(
                  labelText: 'Nereden (İl)',
                  prefixIcon: Icon(Icons.location_on),
                  border: OutlineInputBorder(),
                ),
                items: _provinces
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (value) {
                  setState(() => _fromProvince = value);
                },
                validator: (value) =>
                    value == null ? 'Lütfen bir il seçin' : null,
              ),
              const SizedBox(height: 12),

              // Nereye
              DropdownButtonFormField<String>(
                value: _toProvince,
                decoration: const InputDecoration(
                  labelText: 'Nereye (İl)',
                  prefixIcon: Icon(Icons.flag),
                  border: OutlineInputBorder(),
                ),
                items: _provinces
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (value) {
                  setState(() => _toProvince = value);
                },
                validator: (value) =>
                    value == null ? 'Lütfen bir il seçin' : null,
              ),
              const SizedBox(height: 24),

              // Tarih
              Text(
                'Sefer Tarihi',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: _selectDate,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.calendar_today),
                    border: OutlineInputBorder(),
                  ),
                  child: Text(
                    '${_tripDate.day}.${_tripDate.month}.${_tripDate.year}',
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Fiyat
              Text(
                'Fiyat Bilgisi',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _priceController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Toplam Ücret (TL)',
                  prefixIcon: Icon(Icons.attach_money),
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Lütfen ücreti girin';
                  }
                  if (double.tryParse(value) == null) {
                    return 'Geçerli bir sayı girin';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Yük Bilgisi
              Text(
                'Yük Bilgisi (Opsiyonel)',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                value: _selectedCargoTypeId,
                decoration: const InputDecoration(
                  labelText: 'Yük Tipi',
                  prefixIcon: Icon(Icons.inventory_2),
                  border: OutlineInputBorder(),
                ),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('Seçiniz'),
                  ),
                  ...cargoTypes.map((type) => DropdownMenuItem(
                        value: type.id,
                        child: Text(type.name),
                      )),
                ],
                onChanged: (value) {
                  setState(() => _selectedCargoTypeId = value);
                },
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _weightController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Tahmini Ağırlık (Ton)',
                  prefixIcon: Icon(Icons.scale),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _notesController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Notlar',
                  prefixIcon: Icon(Icons.note),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),

              // Gönder butonu
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _submitSurvey,
                  icon: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                  label: const Text('Gönder'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
