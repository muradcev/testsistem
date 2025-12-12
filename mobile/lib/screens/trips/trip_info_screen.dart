import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/cargo.dart';
import '../../providers/config_provider.dart';
import '../../services/api_service.dart';

class TripInfoScreen extends StatefulWidget {
  final String? tripId;
  final String? fromProvince;
  final String? toProvince;
  final double? distanceKm;

  const TripInfoScreen({
    Key? key,
    this.tripId,
    this.fromProvince,
    this.toProvince,
    this.distanceKm,
  }) : super(key: key);

  @override
  State<TripInfoScreen> createState() => _TripInfoScreenState();
}

class _TripInfoScreenState extends State<TripInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _priceController = TextEditingController();
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();

  String? _selectedCargoTypeId;
  String? _cargoTypeOther;
  bool _isFullLoad = true;
  int _loadPercentage = 100;
  String _paidBy = 'sender';
  bool _isLoading = false;

  @override
  void dispose() {
    _priceController.dispose();
    _weightController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submitTripInfo() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final apiService = Provider.of<ApiService>(context, listen: false);

      // Fiyat bilgisi kaydet
      final pricing = TripPricing(
        tripId: widget.tripId,
        totalPrice: double.parse(_priceController.text),
        paidBy: _paidBy,
      );

      await apiService.post('/driver/trip/pricing', pricing.toJson());

      // Yük bilgisi kaydet
      if (_selectedCargoTypeId != null || _cargoTypeOther != null) {
        final cargo = TripCargo(
          tripId: widget.tripId,
          cargoTypeId: _selectedCargoTypeId,
          cargoTypeOther: _cargoTypeOther,
          weightTons: _weightController.text.isNotEmpty
              ? double.parse(_weightController.text)
              : null,
          isFullLoad: _isFullLoad,
          loadPercentage: _isFullLoad ? 100 : _loadPercentage,
          description: _notesController.text.isNotEmpty
              ? _notesController.text
              : null,
        );

        await apiService.post('/driver/trip/cargo', cargo.toJson());
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bilgiler kaydedildi'),
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
        title: const Text('Sefer Bilgileri'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Güzergah bilgisi
              if (widget.fromProvince != null && widget.toProvince != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${widget.fromProvince} → ${widget.toProvince}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (widget.distanceKm != null)
                          Text(
                            '${widget.distanceKm?.toStringAsFixed(1)} km',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 24),

              // Fiyat Bilgisi
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
              const SizedBox(height: 16),

              // Ödemeyi Kim Yaptı
              Text(
                'Ödemeyi Kim Yapacak?',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'sender',
                    label: Text('Gönderen'),
                  ),
                  ButtonSegment(
                    value: 'receiver',
                    label: Text('Alıcı'),
                  ),
                  ButtonSegment(
                    value: 'broker',
                    label: Text('Acente'),
                  ),
                ],
                selected: {_paidBy},
                onSelectionChanged: (value) {
                  setState(() => _paidBy = value.first);
                },
              ),
              const SizedBox(height: 24),

              // Yük Bilgisi
              Text(
                'Yük Bilgisi',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),

              // Yük Tipi Seçimi
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
                  const DropdownMenuItem(
                    value: 'other',
                    child: Text('Diğer'),
                  ),
                ],
                onChanged: (value) {
                  setState(() {
                    _selectedCargoTypeId = value == 'other' ? null : value;
                    if (value != 'other') {
                      _cargoTypeOther = null;
                    }
                  });
                },
              ),

              // Diğer yük tipi
              if (_selectedCargoTypeId == null &&
                  cargoTypes.isNotEmpty) ...[
                const SizedBox(height: 12),
                TextFormField(
                  decoration: const InputDecoration(
                    labelText: 'Yük Tipi (Diğer)',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (value) {
                    _cargoTypeOther = value;
                  },
                ),
              ],
              const SizedBox(height: 16),

              // Ağırlık
              TextFormField(
                controller: _weightController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Tahmini Ağırlık (Ton)',
                  prefixIcon: Icon(Icons.scale),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              // Tam yük mü?
              SwitchListTile(
                title: const Text('Tam Yük'),
                subtitle: Text(_isFullLoad
                    ? 'Dorse tamamen dolu'
                    : 'Parsiyel yük'),
                value: _isFullLoad,
                onChanged: (value) {
                  setState(() {
                    _isFullLoad = value;
                    if (value) _loadPercentage = 100;
                  });
                },
              ),

              // Doluluk yüzdesi (parsiyel için)
              if (!_isFullLoad) ...[
                const SizedBox(height: 8),
                Text('Doluluk: %$_loadPercentage'),
                Slider(
                  value: _loadPercentage.toDouble(),
                  min: 10,
                  max: 100,
                  divisions: 9,
                  label: '%$_loadPercentage',
                  onChanged: (value) {
                    setState(() => _loadPercentage = value.toInt());
                  },
                ),
              ],
              const SizedBox(height: 16),

              // Notlar
              TextFormField(
                controller: _notesController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Notlar (Opsiyonel)',
                  prefixIcon: Icon(Icons.note),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),

              // Kaydet butonu
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submitTripInfo,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Kaydet'),
                ),
              ),
              const SizedBox(height: 16),

              // Atla butonu
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Şimdilik Atla'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
