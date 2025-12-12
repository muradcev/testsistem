import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/vehicle_provider.dart';
import '../../config/constants.dart';

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final vehicleProvider = context.read<VehicleProvider>();
    await vehicleProvider.loadVehicles();
    await vehicleProvider.loadTrailers();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Araçlarım'),
      ),
      body: Consumer<VehicleProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return RefreshIndicator(
            onRefresh: _loadData,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Vehicles section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Araçlar',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    TextButton.icon(
                      onPressed: () => context.goNamed('add-vehicle'),
                      icon: const Icon(Icons.add),
                      label: const Text('Ekle'),
                    ),
                  ],
                ),
                if (provider.vehicles.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                        child: Text('Henüz araç eklenmedi'),
                      ),
                    ),
                  )
                else
                  ...provider.vehicles.map((v) => _buildVehicleCard(context, v, provider)),
                const SizedBox(height: 24),

                // Trailers section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Dorseler',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    TextButton.icon(
                      onPressed: () => _showAddTrailerDialog(context),
                      icon: const Icon(Icons.add),
                      label: const Text('Ekle'),
                    ),
                  ],
                ),
                if (provider.trailers.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                        child: Text('Henüz dorse eklenmedi'),
                      ),
                    ),
                  )
                else
                  ...provider.trailers.map((t) => _buildTrailerCard(context, t, provider)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildVehicleCard(BuildContext context, Map<String, dynamic> vehicle, VehicleProvider provider) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const CircleAvatar(
          child: Icon(Icons.local_shipping),
        ),
        title: Text(vehicle['plate'] ?? ''),
        subtitle: Text('${vehicle['brand']} ${vehicle['model']} - ${VehicleTypes.types[vehicle['vehicle_type']] ?? ''}'),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'edit',
              child: Text('Düzenle'),
            ),
            const PopupMenuItem(
              value: 'delete',
              child: Text('Sil', style: TextStyle(color: Colors.red)),
            ),
          ],
          onSelected: (value) async {
            if (value == 'delete') {
              final confirm = await _showDeleteDialog(context);
              if (confirm == true) {
                await provider.deleteVehicle(vehicle['id']);
              }
            }
          },
        ),
      ),
    );
  }

  Widget _buildTrailerCard(BuildContext context, Map<String, dynamic> trailer, VehicleProvider provider) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const CircleAvatar(
          child: Icon(Icons.rv_hookup),
        ),
        title: Text(trailer['plate'] ?? ''),
        subtitle: Text(TrailerTypes.types[trailer['trailer_type']] ?? ''),
        trailing: IconButton(
          icon: const Icon(Icons.delete, color: Colors.red),
          onPressed: () async {
            final confirm = await _showDeleteDialog(context);
            if (confirm == true) {
              await provider.deleteTrailer(trailer['id']);
            }
          },
        ),
      ),
    );
  }

  Future<bool?> _showDeleteDialog(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('İptal'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _showAddTrailerDialog(BuildContext context) {
    final plateController = TextEditingController();
    String? selectedType;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Dorse Ekle'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: plateController,
              decoration: const InputDecoration(labelText: 'Plaka'),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'Dorse Tipi'),
              items: TrailerTypes.types.entries.map((e) => DropdownMenuItem(
                value: e.key,
                child: Text(e.value),
              )).toList(),
              onChanged: (value) => selectedType = value,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (plateController.text.isNotEmpty && selectedType != null) {
                await context.read<VehicleProvider>().addTrailer({
                  'plate': plateController.text,
                  'trailer_type': selectedType,
                });
                if (context.mounted) Navigator.pop(context);
              }
            },
            child: const Text('Ekle'),
          ),
        ],
      ),
    );
  }
}
