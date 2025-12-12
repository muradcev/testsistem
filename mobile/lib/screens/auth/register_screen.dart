import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  final _surnameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  List<String> _provinces = [];
  List<String> _districts = [];
  List<String> _neighborhoods = [];

  String? _selectedProvince;
  String? _selectedDistrict;
  String? _selectedNeighborhood;

  @override
  void initState() {
    super.initState();
    _loadProvinces();
  }

  Future<void> _loadProvinces() async {
    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.getProvinces();
      setState(() {
        _provinces = List<String>.from(response.data['provinces'] ?? []);
      });
    } catch (e) {
      debugPrint('Failed to load provinces: $e');
    }
  }

  Future<void> _loadDistricts(String province) async {
    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.getDistricts(province);
      setState(() {
        _districts = List<String>.from(response.data['districts'] ?? []);
        _selectedDistrict = null;
        _selectedNeighborhood = null;
        _neighborhoods = [];
      });
    } catch (e) {
      debugPrint('Failed to load districts: $e');
    }
  }

  Future<void> _loadNeighborhoods(String province, String district) async {
    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.getNeighborhoods(province, district);
      setState(() {
        _neighborhoods = List<String>.from(response.data['neighborhoods'] ?? []);
        _selectedNeighborhood = null;
      });
    } catch (e) {
      debugPrint('Failed to load neighborhoods: $e');
    }
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.register({
      'phone': _phoneController.text.trim(),
      'name': _nameController.text.trim(),
      'surname': _surnameController.text.trim(),
      'password': _passwordController.text,
      'province': _selectedProvince,
      'district': _selectedDistrict,
      'neighborhood': _selectedNeighborhood,
    });

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kayıt başarılı! Giriş yapabilirsiniz.')),
      );
      context.goNamed('login');
    } else if (mounted && authProvider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(authProvider.error!)),
      );
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    _surnameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kayıt Ol'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Phone
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Telefon Numarası',
                  prefixIcon: Icon(Icons.phone),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Telefon numarası gerekli';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Name
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Ad',
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Ad gerekli';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Surname
              TextFormField(
                controller: _surnameController,
                decoration: const InputDecoration(
                  labelText: 'Soyad',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Soyad gerekli';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Province dropdown
              DropdownButtonFormField<String>(
                value: _selectedProvince,
                decoration: const InputDecoration(
                  labelText: 'İl',
                  prefixIcon: Icon(Icons.location_city),
                ),
                items: _provinces.map((p) => DropdownMenuItem(
                  value: p,
                  child: Text(p),
                )).toList(),
                onChanged: (value) {
                  setState(() => _selectedProvince = value);
                  if (value != null) _loadDistricts(value);
                },
                validator: (value) => value == null ? 'İl seçin' : null,
              ),
              const SizedBox(height: 16),

              // District dropdown
              DropdownButtonFormField<String>(
                value: _selectedDistrict,
                decoration: const InputDecoration(
                  labelText: 'İlçe',
                  prefixIcon: Icon(Icons.location_on),
                ),
                items: _districts.map((d) => DropdownMenuItem(
                  value: d,
                  child: Text(d),
                )).toList(),
                onChanged: (value) {
                  setState(() => _selectedDistrict = value);
                  if (value != null && _selectedProvince != null) {
                    _loadNeighborhoods(_selectedProvince!, value);
                  }
                },
                validator: (value) => value == null ? 'İlçe seçin' : null,
              ),
              const SizedBox(height: 16),

              // Neighborhood dropdown
              DropdownButtonFormField<String>(
                value: _selectedNeighborhood,
                decoration: const InputDecoration(
                  labelText: 'Mahalle',
                  prefixIcon: Icon(Icons.home),
                ),
                items: _neighborhoods.map((n) => DropdownMenuItem(
                  value: n,
                  child: Text(n),
                )).toList(),
                onChanged: (value) => setState(() => _selectedNeighborhood = value),
                validator: (value) => value == null ? 'Mahalle seçin' : null,
              ),
              const SizedBox(height: 16),

              // Password
              TextFormField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Şifre',
                  prefixIcon: const Icon(Icons.lock),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Şifre gerekli';
                  }
                  if (value.length < 6) {
                    return 'Şifre en az 6 karakter olmalı';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Confirm Password
              TextFormField(
                controller: _confirmPasswordController,
                obscureText: _obscureConfirmPassword,
                decoration: InputDecoration(
                  labelText: 'Şifre Tekrar',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                  ),
                ),
                validator: (value) {
                  if (value != _passwordController.text) {
                    return 'Şifreler eşleşmiyor';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Register button
              Consumer<AuthProvider>(
                builder: (context, auth, _) {
                  return ElevatedButton(
                    onPressed: auth.isLoading ? null : _register,
                    child: auth.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Kayıt Ol'),
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
