import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil'),
      ),
      body: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          final user = auth.user;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Profile header
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 50,
                        child: Text(
                          user?['name']?.substring(0, 1).toUpperCase() ?? 'N',
                          style: const TextStyle(fontSize: 36),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '${user?['name'] ?? ''} ${user?['surname'] ?? ''}',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?['phone'] ?? '',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Info
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.location_city),
                      title: const Text('İl'),
                      subtitle: Text(user?['province'] ?? '-'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.location_on),
                      title: const Text('İlçe'),
                      subtitle: Text(user?['district'] ?? '-'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.home),
                      title: const Text('Mahalle'),
                      subtitle: Text(user?['neighborhood'] ?? '-'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Actions
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.edit),
                      title: const Text('Profili Düzenle'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        // TODO: Edit profile
                      },
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.lock),
                      title: const Text('Şifre Değiştir'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        // TODO: Change password
                      },
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.info),
                      title: const Text('Hakkında'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        // TODO: About
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Logout
              OutlinedButton.icon(
                onPressed: () async {
                  await auth.logout();
                  if (context.mounted) {
                    context.goNamed('login');
                  }
                },
                icon: const Icon(Icons.logout, color: Colors.red),
                label: const Text('Çıkış Yap', style: TextStyle(color: Colors.red)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.red),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
