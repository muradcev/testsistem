import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../config/theme.dart';

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
  bool _isLoadingProvinces = true;
  bool _isCheckingPhone = false;
  String? _provincesError;
  String? _phoneError;

  List<String> _provinces = [];
  List<String> _districts = [];

  String? _selectedProvince;
  String? _selectedDistrict;

  int _currentStep = 0;

  @override
  void initState() {
    super.initState();
    // Use addPostFrameCallback to ensure context is available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadProvinces();
    });
  }

  Future<void> _loadProvinces() async {
    if (!mounted) return;
    setState(() {
      _isLoadingProvinces = true;
      _provincesError = null;
    });
    try {
      debugPrint('Loading provinces...');
      final apiService = context.read<ApiService>();
      debugPrint('ApiService obtained');
      final response = await apiService.getProvinces();
      debugPrint('Response received: ${response.statusCode}');
      debugPrint('Response data: ${response.data}');
      if (mounted) {
        final provinces = response.data['provinces'];
        debugPrint('Provinces count: ${provinces?.length ?? 0}');
        setState(() {
          _provinces = List<String>.from(provinces ?? []);
          _isLoadingProvinces = false;
        });
        debugPrint('Provinces loaded successfully: ${_provinces.length}');
      }
    } catch (e, stackTrace) {
      debugPrint('Failed to load provinces: $e');
      debugPrint('Stack trace: $stackTrace');
      if (mounted) {
        setState(() {
          _isLoadingProvinces = false;
          _provincesError = 'İller yüklenemedi: $e';
        });
      }
    }
  }

  Future<void> _loadDistricts(String province) async {
    if (!mounted) return;
    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.getDistricts(province);
      if (mounted) {
        setState(() {
          _districts = List<String>.from(response.data['districts'] ?? []);
          _selectedDistrict = null;
        });
      }
    } catch (e) {
      debugPrint('Failed to load districts: $e');
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
    });

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
              SizedBox(width: 12),
              Text('Kayit basarili! Hos geldiniz.'),
            ],
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          margin: const EdgeInsets.all(16),
        ),
      );
      context.goNamed('home');
    } else if (mounted && authProvider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 20),
              const SizedBox(width: 12),
              Expanded(child: Text(authProvider.error!)),
            ],
          ),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          margin: const EdgeInsets.all(16),
        ),
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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          onPressed: () => context.goNamed('login'),
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
        ),
        title: const Text(
          'Hesap Oluştur',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Indicator
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: _buildProgressBar(0),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildProgressBar(1),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildProgressBar(2),
                  ),
                ],
              ),
            ),

            // Form Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 24),

                      // Step Title
                      Text(
                        _getStepTitle(),
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _getStepSubtitle(),
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Step Content
                      if (_currentStep == 0) _buildPersonalInfoStep(),
                      if (_currentStep == 1) _buildLocationStep(),
                      if (_currentStep == 2) _buildPasswordStep(),

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),

            // Bottom Buttons
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.background,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: Row(
                children: [
                  if (_currentStep > 0)
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: OutlinedButton(
                          onPressed: () {
                            setState(() => _currentStep--);
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.textPrimary,
                            side: BorderSide(color: Colors.grey.shade300, width: 1.5),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Geri',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (_currentStep > 0) const SizedBox(width: 16),
                  Expanded(
                    flex: _currentStep == 0 ? 1 : 1,
                    child: Consumer<AuthProvider>(
                      builder: (context, auth, _) {
                        final isLoading = auth.isLoading || _isCheckingPhone;
                        return SizedBox(
                          height: 56,
                          child: ElevatedButton(
                            onPressed: isLoading ? null : _onNextPressed,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.6),
                            ),
                            child: isLoading
                                ? const SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    _currentStep == 2 ? 'Kayıt Ol' : 'Devam Et',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressBar(int step) {
    return Container(
      height: 4,
      decoration: BoxDecoration(
        color: _currentStep >= step ? AppColors.primary : Colors.grey.shade200,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  String _getStepTitle() {
    switch (_currentStep) {
      case 0:
        return 'Kişisel Bilgiler';
      case 1:
        return 'Konum Bilgileri';
      case 2:
        return 'Şifre Oluştur';
      default:
        return '';
    }
  }

  String _getStepSubtitle() {
    switch (_currentStep) {
      case 0:
        return 'Ad, soyad ve telefon bilgilerinizi girin';
      case 1:
        return 'Bulunduğunuz ili ve ilçeyi seçin';
      case 2:
        return 'Güvenli bir şifre belirleyin';
      default:
        return '';
    }
  }

  Widget _buildPersonalInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Name Field
        _buildFieldLabel('Ad'),
        const SizedBox(height: 8),
        _buildTextField(
          controller: _nameController,
          hintText: 'Adınızı girin',
          prefixIcon: Icons.person_outline,
          textCapitalization: TextCapitalization.words,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Ad gerekli';
            }
            return null;
          },
        ),
        const SizedBox(height: 20),

        // Surname Field
        _buildFieldLabel('Soyad'),
        const SizedBox(height: 8),
        _buildTextField(
          controller: _surnameController,
          hintText: 'Soyadınızı girin',
          prefixIcon: Icons.person_outline,
          textCapitalization: TextCapitalization.words,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Soyad gerekli';
            }
            return null;
          },
        ),
        const SizedBox(height: 20),

        // Phone Field
        _buildFieldLabel('Telefon Numarası'),
        const SizedBox(height: 8),
        _buildTextField(
          controller: _phoneController,
          hintText: '5XX XXX XX XX',
          prefixIcon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Telefon numarası gerekli';
            }
            if (value.length < 10) {
              return 'Geçerli bir telefon numarası girin';
            }
            if (_phoneError != null) {
              return _phoneError;
            }
            return null;
          },
        ),
        if (_phoneError != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppColors.error, size: 16),
                const SizedBox(width: 4),
                Text(
                  _phoneError!,
                  style: const TextStyle(color: AppColors.error, fontSize: 12),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildLocationStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Error message with retry button
        if (_provincesError != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _provincesError!,
                    style: const TextStyle(color: AppColors.error, fontSize: 14),
                  ),
                ),
                TextButton(
                  onPressed: _loadProvinces,
                  child: const Text('Tekrar Dene'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Province Field
        _buildFieldLabel('İl'),
        const SizedBox(height: 8),
        _buildDropdown(
          value: _selectedProvince,
          hintText: _isLoadingProvinces ? 'Yükleniyor...' : 'İl seçin',
          items: _provinces,
          isLoading: _isLoadingProvinces,
          onChanged: (value) {
            setState(() => _selectedProvince = value);
            if (value != null) _loadDistricts(value);
          },
          validator: (value) => value == null ? 'İl seçin' : null,
        ),
        const SizedBox(height: 20),

        // District Field
        _buildFieldLabel('İlçe'),
        const SizedBox(height: 8),
        _buildDropdown(
          value: _selectedDistrict,
          hintText: 'İlçe seçin',
          items: _districts,
          enabled: _selectedProvince != null,
          onChanged: (value) {
            setState(() => _selectedDistrict = value);
          },
          validator: (value) => value == null ? 'İlçe seçin' : null,
        ),
      ],
    );
  }

  Widget _buildPasswordStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Password Field
        _buildFieldLabel('Şifre'),
        const SizedBox(height: 8),
        _buildTextField(
          controller: _passwordController,
          hintText: 'En az 6 karakter',
          prefixIcon: Icons.lock_outline,
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: Colors.grey.shade600,
            ),
            onPressed: () {
              setState(() => _obscurePassword = !_obscurePassword);
            },
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
        const SizedBox(height: 20),

        // Confirm Password Field
        _buildFieldLabel('Şifre Tekrar'),
        const SizedBox(height: 8),
        _buildTextField(
          controller: _confirmPasswordController,
          hintText: 'Şifrenizi tekrar girin',
          prefixIcon: Icons.lock_outline,
          obscureText: _obscureConfirmPassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: Colors.grey.shade600,
            ),
            onPressed: () {
              setState(() => _obscureConfirmPassword = !_obscureConfirmPassword);
            },
          ),
          validator: (value) {
            if (value != _passwordController.text) {
              return 'Şifreler eşleşmiyor';
            }
            return null;
          },
        ),
        const SizedBox(height: 24),

        // Terms
        RichText(
          text: TextSpan(
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade600,
            ),
            children: const [
              TextSpan(text: 'Kayıt olarak '),
              TextSpan(
                text: 'Kullanım Koşullarını',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              TextSpan(text: ' ve '),
              TextSpan(
                text: 'Gizlilik Politikasını',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              TextSpan(text: ' kabul etmiş olursunuz.'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData prefixIcon,
    String? Function(String?)? validator,
    TextInputType? keyboardType,
    bool obscureText = false,
    Widget? suffixIcon,
    TextCapitalization textCapitalization = TextCapitalization.none,
  }) {
    return TextFormField(
      controller: controller,
      validator: validator,
      keyboardType: keyboardType,
      obscureText: obscureText,
      textCapitalization: textCapitalization,
      style: const TextStyle(
        fontSize: 16,
        color: AppColors.textPrimary,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(color: Colors.grey.shade400),
        prefixIcon: Icon(prefixIcon, color: Colors.grey.shade600),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String? value,
    required String hintText,
    required List<String> items,
    required void Function(String?) onChanged,
    String? Function(String?)? validator,
    bool isLoading = false,
    bool enabled = true,
  }) {
    return DropdownButtonFormField<String>(
      value: value,
      validator: validator,
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(color: Colors.grey.shade400),
        prefixIcon: isLoading
            ? Padding(
                padding: const EdgeInsets.all(12),
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.grey.shade400,
                  ),
                ),
              )
            : Icon(Icons.location_on_outlined, color: Colors.grey.shade600),
        filled: true,
        fillColor: enabled ? AppColors.surface : Colors.grey.shade100,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 1),
        ),
      ),
      items: items.map((item) => DropdownMenuItem(
        value: item,
        child: Text(item),
      )).toList(),
      onChanged: enabled ? onChanged : null,
      isExpanded: true,
      icon: Icon(Icons.keyboard_arrow_down, color: Colors.grey.shade600),
      dropdownColor: AppColors.background,
    );
  }

  Future<void> _onNextPressed() async {
    // Validate current step
    bool isValid = true;

    if (_currentStep == 0) {
      if (_nameController.text.isEmpty ||
          _surnameController.text.isEmpty ||
          _phoneController.text.isEmpty ||
          _phoneController.text.length < 10) {
        isValid = false;
        _formKey.currentState!.validate();
      } else {
        // Telefon numarası kontrolü yap
        isValid = await _checkPhoneNumber();
      }
    } else if (_currentStep == 1) {
      if (_selectedProvince == null || _selectedDistrict == null) {
        isValid = false;
        _formKey.currentState!.validate();
      }
    } else if (_currentStep == 2) {
      if (!_formKey.currentState!.validate()) {
        isValid = false;
      }
    }

    if (isValid) {
      if (_currentStep < 2) {
        setState(() => _currentStep++);
        // If moving to location step and provinces aren't loaded, try again
        if (_currentStep == 1 && _provinces.isEmpty && !_isLoadingProvinces) {
          _loadProvinces();
        }
      } else {
        _register();
      }
    }
  }

  /// Telefon numarasının kayıtlı olup olmadığını kontrol eder
  Future<bool> _checkPhoneNumber() async {
    if (!mounted) return false;

    setState(() {
      _isCheckingPhone = true;
      _phoneError = null;
    });

    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.checkPhoneExists(_phoneController.text.trim());

      if (!mounted) return false;

      final exists = response.data['exists'] == true;

      if (exists) {
        setState(() {
          _phoneError = 'Bu telefon numarası zaten kayıtlı';
          _isCheckingPhone = false;
        });
        // Hata mesajını göster
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.error_outline, color: Colors.white, size: 20),
                SizedBox(width: 12),
                Text('Bu telefon numarası zaten kayıtlı'),
              ],
            ),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            margin: const EdgeInsets.all(16),
          ),
        );
        return false;
      }

      setState(() {
        _isCheckingPhone = false;
      });
      return true;
    } catch (e) {
      debugPrint('Phone check error: $e');
      if (!mounted) return false;

      setState(() {
        _isCheckingPhone = false;
      });
      // API hatası olsa bile devam etmesine izin ver, kayıt sırasında tekrar kontrol edilecek
      return true;
    }
  }
}
