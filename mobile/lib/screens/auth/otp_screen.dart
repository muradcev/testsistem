import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

class OTPScreen extends StatefulWidget {
  final String phone;

  const OTPScreen({super.key, required this.phone});

  @override
  State<OTPScreen> createState() => _OTPScreenState();
}

class _OTPScreenState extends State<OTPScreen> {
  final _otpController = TextEditingController();

  Future<void> _verify() async {
    if (_otpController.text.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('6 haneli kodu girin')),
      );
      return;
    }

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.verifyOtp(
      widget.phone,
      _otpController.text,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Telefon doğrulandı!')),
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
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Telefon Doğrulama'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 40),
            const Icon(Icons.sms, size: 80, color: Colors.blue),
            const SizedBox(height: 24),
            Text(
              '${widget.phone} numarasına gönderilen 6 haneli kodu girin',
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            TextFormField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, letterSpacing: 8),
              decoration: const InputDecoration(
                hintText: '------',
                counterText: '',
              ),
            ),
            const SizedBox(height: 24),
            Consumer<AuthProvider>(
              builder: (context, auth, _) {
                return ElevatedButton(
                  onPressed: auth.isLoading ? null : _verify,
                  child: auth.isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Doğrula'),
                );
              },
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () async {
                final authProvider = context.read<AuthProvider>();
                final scaffoldMessenger = ScaffoldMessenger.of(context);
                await authProvider.sendOtp(widget.phone);
                if (mounted) {
                  scaffoldMessenger.showSnackBar(
                    const SnackBar(content: Text('Kod tekrar gönderildi')),
                  );
                }
              },
              child: const Text('Kodu tekrar gönder'),
            ),
          ],
        ),
      ),
    );
  }
}
