import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/vehicle_provider.dart';
import '../../config/constants.dart';

class AddVehicleScreen extends StatefulWidget {
  const AddVehicleScreen({super.key});

  @override
  State<AddVehicleScreen> createState() => _AddVehicleScreenState();
}

class _AddVehicleScreenState extends State<AddVehicleScreen> {
  final _formKey = GlobalKey<FormState>();
  final _plateController = TextEditingController();
  final _modelController = TextEditingController();
  final _yearController = TextEditingController();
  final _tonnageController = TextEditingController();
  final _trailerPlateController = TextEditingController();

  String? _selectedBrand;
  String? _selectedVehicleType;
  String? _selectedTrailerType;
  bool _isSaving = false;

  @override
  void dispose() {
    _plateController.dispose();
    _modelController.dispose();
    _yearController.dispose();
    _tonnageController.dispose();
    _trailerPlateController.dispose();
    super.dispose();
  }

  bool get _isTir => _selectedVehicleType == 'tir';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    // TIR seçildiyse dorse bilgisi zorunlu
    if (_isTir && (_selectedTrailerType == null || _trailerPlateController.text.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('TIR için dorse bilgisi zorunludur'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    final provider = context.read<VehicleProvider>();

    // Önce aracı ekle
    final vehicleSuccess = await provider.addVehicle({
      'plate': _plateController.text.trim().toUpperCase(),
      'brand': _selectedBrand,
      'model': _modelController.text.trim(),
      'year': int.parse(_yearController.text),
      'vehicle_type': _selectedVehicleType,
      'tonnage': double.parse(_tonnageController.text),
    });

    if (!vehicleSuccess) {
      setState(() => _isSaving = false);
      if (mounted && provider.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(provider.error!), backgroundColor: Colors.red),
        );
      }
      return;
    }

    // TIR ise dorseyi de ekle
    if (_isTir && _selectedTrailerType != null) {
      await provider.addTrailer({
        'plate': _trailerPlateController.text.trim().toUpperCase(),
        'trailer_type': _selectedTrailerType,
      });
    }

    setState(() => _isSaving = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Araç başarıyla eklendi'),
          backgroundColor: Colors.green,
        ),
      );
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Araç Ekle'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Araç Tipi (önce seçilsin)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Araç Tipi Seçin',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _selectedVehicleType,
                        decoration: const InputDecoration(
                          labelText: 'Araç Tipi',
                          prefixIcon: Icon(Icons.local_shipping),
                          border: OutlineInputBorder(),
                        ),
                        items: VehicleTypes.types.entries.map((e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        )).toList(),
                        onChanged: (v) => setState(() {
                          _selectedVehicleType = v;
                          // TIR değilse dorse bilgilerini temizle
                          if (v != 'tir') {
                            _selectedTrailerType = null;
                            _trailerPlateController.clear();
                          }
                        }),
                        validator: (v) => v == null ? 'Araç tipi seçin' : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Araç Bilgileri
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Araç Bilgileri',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _plateController,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(
                          labelText: 'Plaka',
                          hintText: '34 ABC 123',
                          prefixIcon: Icon(Icons.pin),
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) => v?.isEmpty == true ? 'Plaka gerekli' : null,
                      ),
                      const SizedBox(height: 12),

                      DropdownButtonFormField<String>(
                        value: _selectedBrand,
                        decoration: const InputDecoration(
                          labelText: 'Marka',
                          prefixIcon: Icon(Icons.business),
                          border: OutlineInputBorder(),
                        ),
                        items: VehicleBrands.brands.map((b) => DropdownMenuItem(
                          value: b,
                          child: Text(b),
                        )).toList(),
                        onChanged: (v) => setState(() => _selectedBrand = v),
                        validator: (v) => v == null ? 'Marka seçin' : null,
                      ),
                      const SizedBox(height: 12),

                      TextFormField(
                        controller: _modelController,
                        decoration: const InputDecoration(
                          labelText: 'Model',
                          hintText: 'Actros, TGX, FH...',
                          prefixIcon: Icon(Icons.directions_car),
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) => v?.isEmpty == true ? 'Model gerekli' : null,
                      ),
                      const SizedBox(height: 12),

                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _yearController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Yıl',
                                hintText: '2020',
                                prefixIcon: Icon(Icons.calendar_today),
                                border: OutlineInputBorder(),
                              ),
                              validator: (v) {
                                if (v?.isEmpty == true) return 'Yıl gerekli';
                                final year = int.tryParse(v!);
                                if (year == null || year < 1990 || year > DateTime.now().year + 1) {
                                  return 'Geçerli yıl girin';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _tonnageController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Tonaj (ton)',
                                hintText: '25',
                                prefixIcon: Icon(Icons.scale),
                                border: OutlineInputBorder(),
                              ),
                              validator: (v) {
                                if (v?.isEmpty == true) return 'Tonaj gerekli';
                                final tonnage = double.tryParse(v!);
                                if (tonnage == null || tonnage <= 0) {
                                  return 'Geçerli tonaj girin';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Dorse Bilgileri (sadece TIR için)
              if (_isTir) ...[
                const SizedBox(height: 16),
                Card(
                  color: Colors.blue.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.rv_hookup, color: Colors.blue.shade700),
                            const SizedBox(width: 8),
                            Text(
                              'Dorse Bilgileri',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.blue.shade700,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.orange,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Text(
                                'Zorunlu',
                                style: TextStyle(color: Colors.white, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _trailerPlateController,
                          textCapitalization: TextCapitalization.characters,
                          decoration: const InputDecoration(
                            labelText: 'Dorse Plakası',
                            hintText: '34 ABC 456',
                            prefixIcon: Icon(Icons.pin),
                            border: OutlineInputBorder(),
                            filled: true,
                            fillColor: Colors.white,
                          ),
                          validator: _isTir
                            ? (v) => v?.isEmpty == true ? 'Dorse plakası gerekli' : null
                            : null,
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: _selectedTrailerType,
                          decoration: const InputDecoration(
                            labelText: 'Dorse Tipi',
                            prefixIcon: Icon(Icons.category),
                            border: OutlineInputBorder(),
                            filled: true,
                            fillColor: Colors.white,
                          ),
                          items: TrailerTypes.types.entries.map((e) => DropdownMenuItem(
                            value: e.key,
                            child: Text(e.value),
                          )).toList(),
                          onChanged: (v) => setState(() => _selectedTrailerType = v),
                          validator: _isTir
                            ? (v) => v == null ? 'Dorse tipi seçin' : null
                            : null,
                        ),
                      ],
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isSaving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Kaydet', style: TextStyle(fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
