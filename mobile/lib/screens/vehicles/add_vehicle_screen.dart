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

  String? _selectedBrand;
  String? _selectedVehicleType;

  @override
  void dispose() {
    _plateController.dispose();
    _modelController.dispose();
    _yearController.dispose();
    _tonnageController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<VehicleProvider>();
    final success = await provider.addVehicle({
      'plate': _plateController.text.trim().toUpperCase(),
      'brand': _selectedBrand,
      'model': _modelController.text.trim(),
      'year': int.parse(_yearController.text),
      'vehicle_type': _selectedVehicleType,
      'tonnage': double.parse(_tonnageController.text),
    });

    if (success && mounted) {
      context.pop();
    } else if (mounted && provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!)),
      );
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
              TextFormField(
                controller: _plateController,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Plaka',
                  hintText: '34 ABC 123',
                  prefixIcon: Icon(Icons.pin),
                ),
                validator: (v) => v?.isEmpty == true ? 'Plaka gerekli' : null,
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedBrand,
                decoration: const InputDecoration(
                  labelText: 'Marka',
                  prefixIcon: Icon(Icons.business),
                ),
                items: VehicleBrands.brands.map((b) => DropdownMenuItem(
                  value: b,
                  child: Text(b),
                )).toList(),
                onChanged: (v) => setState(() => _selectedBrand = v),
                validator: (v) => v == null ? 'Marka seçin' : null,
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _modelController,
                decoration: const InputDecoration(
                  labelText: 'Model',
                  hintText: 'Actros, TGX, FH...',
                  prefixIcon: Icon(Icons.directions_car),
                ),
                validator: (v) => v?.isEmpty == true ? 'Model gerekli' : null,
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _yearController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Yıl',
                  hintText: '2020',
                  prefixIcon: Icon(Icons.calendar_today),
                ),
                validator: (v) {
                  if (v?.isEmpty == true) return 'Yıl gerekli';
                  final year = int.tryParse(v!);
                  if (year == null || year < 1990 || year > DateTime.now().year + 1) {
                    return 'Geçerli bir yıl girin';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedVehicleType,
                decoration: const InputDecoration(
                  labelText: 'Araç Tipi',
                  prefixIcon: Icon(Icons.local_shipping),
                ),
                items: VehicleTypes.types.entries.map((e) => DropdownMenuItem(
                  value: e.key,
                  child: Text(e.value),
                )).toList(),
                onChanged: (v) => setState(() => _selectedVehicleType = v),
                validator: (v) => v == null ? 'Araç tipi seçin' : null,
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _tonnageController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Tonaj (ton)',
                  hintText: '25',
                  prefixIcon: Icon(Icons.scale),
                ),
                validator: (v) {
                  if (v?.isEmpty == true) return 'Tonaj gerekli';
                  final tonnage = double.tryParse(v!);
                  if (tonnage == null || tonnage <= 0) {
                    return 'Geçerli bir tonaj girin';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              Consumer<VehicleProvider>(
                builder: (context, provider, _) {
                  return ElevatedButton(
                    onPressed: provider.isLoading ? null : _save,
                    child: provider.isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Kaydet'),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
