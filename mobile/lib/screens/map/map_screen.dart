import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../providers/location_provider.dart';
import '../../config/theme.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  bool _isFollowing = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Konumum'),
        actions: [
          Consumer<LocationProvider>(
            builder: (context, location, _) {
              return IconButton(
                icon: Icon(
                  _isFollowing ? Icons.gps_fixed : Icons.gps_not_fixed,
                  color: _isFollowing ? AppColors.accent : null,
                ),
                onPressed: () {
                  setState(() => _isFollowing = !_isFollowing);
                  if (_isFollowing && location.currentLocation != null) {
                    _mapController.move(
                      LatLng(
                        location.currentLocation!.latitude,
                        location.currentLocation!.longitude,
                      ),
                      15,
                    );
                  }
                },
                tooltip: _isFollowing ? 'Takibi durdur' : 'Konumu takip et',
              );
            },
          ),
        ],
      ),
      body: Consumer<LocationProvider>(
        builder: (context, locationProvider, _) {
          final currentLoc = locationProvider.currentLocation;

          // Default to Turkey center if no location
          final center = currentLoc != null
              ? LatLng(currentLoc.latitude, currentLoc.longitude)
              : const LatLng(39.925533, 32.866287); // Ankara

          // Move map if following
          if (_isFollowing && currentLoc != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              try {
                _mapController.move(center, _mapController.camera.zoom);
              } catch (_) {}
            });
          }

          return Stack(
            children: [
              // Map
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: 15,
                  minZoom: 4,
                  maxZoom: 18,
                  onPositionChanged: (position, hasGesture) {
                    if (hasGesture) {
                      setState(() => _isFollowing = false);
                    }
                  },
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.nakliyeo.mobile',
                  ),
                  // Current location marker
                  if (currentLoc != null)
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(currentLoc.latitude, currentLoc.longitude),
                          width: 60,
                          height: 60,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Accuracy circle effect
                              Container(
                                width: 60,
                                height: 60,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.accent.withValues(alpha: 0.2),
                                ),
                              ),
                              // Location dot
                              Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.accent,
                                  border: Border.all(color: Colors.white, width: 3),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.3),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                ],
              ),

              // Info card at bottom
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: locationProvider.isTracking
                                    ? AppColors.success.withValues(alpha: 0.1)
                                    : AppColors.error.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                locationProvider.isTracking
                                    ? Icons.location_on
                                    : Icons.location_off,
                                color: locationProvider.isTracking
                                    ? AppColors.success
                                    : AppColors.error,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    locationProvider.isTracking
                                        ? 'Konum Takibi Aktif'
                                        : 'Konum Takibi Kapalı',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  if (currentLoc != null)
                                    Text(
                                      '${currentLoc.latitude.toStringAsFixed(6)}, ${currentLoc.longitude.toStringAsFixed(6)}',
                                      style: TextStyle(
                                        color: Colors.grey.shade600,
                                        fontSize: 12,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (currentLoc != null) ...[
                          const SizedBox(height: 12),
                          // Hız Göstergesi
                          _buildSpeedGauge(currentLoc.speed),
                          const SizedBox(height: 12),
                          const Divider(height: 1),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _buildInfoItem(
                                Icons.gps_fixed,
                                'Doğruluk',
                                '±${currentLoc.accuracy?.toStringAsFixed(0) ?? '-'}m',
                              ),
                              _buildInfoItem(
                                Icons.battery_std,
                                'Batarya',
                                '%${locationProvider.batteryLevel}',
                              ),
                              _buildInfoItem(
                                Icons.wifi,
                                'Bağlantı',
                                locationProvider.isOnline ? 'Çevrimiçi' : 'Çevrimdışı',
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),

              // Recenter button
              if (!_isFollowing && currentLoc != null)
                Positioned(
                  right: 16,
                  bottom: 200,
                  child: FloatingActionButton.small(
                    onPressed: () {
                      setState(() => _isFollowing = true);
                      _mapController.move(
                        LatLng(currentLoc.latitude, currentLoc.longitude),
                        15,
                      );
                    },
                    child: const Icon(Icons.my_location),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, size: 20, color: Colors.grey.shade600),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.grey.shade600,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildSpeedGauge(double? speedMs) {
    // GPS hızı m/s olarak gelir, km/h'ye çevir
    final speedKmh = (speedMs ?? 0) * 3.6;
    final displaySpeed = speedKmh.clamp(0, 999).toInt();

    // Hız kategorisi için renk
    Color speedColor;
    String speedLabel;
    if (displaySpeed < 5) {
      speedColor = Colors.grey;
      speedLabel = 'Durgun';
    } else if (displaySpeed < 50) {
      speedColor = AppColors.success;
      speedLabel = 'Şehir İçi';
    } else if (displaySpeed < 90) {
      speedColor = AppColors.accent;
      speedLabel = 'Normal';
    } else if (displaySpeed < 120) {
      speedColor = Colors.orange;
      speedLabel = 'Hızlı';
    } else {
      speedColor = AppColors.error;
      speedLabel = 'Çok Hızlı';
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: speedColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: speedColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.speed, color: speedColor, size: 32),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$displaySpeed',
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: speedColor,
                      height: 1,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      'km/h',
                      style: TextStyle(
                        fontSize: 14,
                        color: speedColor,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                speedLabel,
                style: TextStyle(
                  fontSize: 12,
                  color: speedColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
