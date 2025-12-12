# Railway Deployment Kılavuzu

## Ön Gereksinimler

1. Railway hesabı: https://railway.app
2. GitHub hesabı (projeyi GitHub'a yükleyin)

## Adım 1: GitHub'a Yükle

```bash
cd /Users/selmur/Desktop/nakliyeo-mobil
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/testsistem.git
git push -u origin main
```

## Adım 2: Railway'de Yeni Proje

1. https://railway.app adresine gidin
2. "New Project" → "Deploy from GitHub repo"
3. GitHub reponuzu seçin

## Adım 3: PostgreSQL Ekle

1. Proje dashboard'unda "+ New" → "Database" → "Add PostgreSQL"
2. PostgreSQL oluşturulduktan sonra "Variables" sekmesine gidin
3. `DATABASE_URL` otomatik olarak ayarlanacak

## Adım 4: Redis Ekle

1. "+ New" → "Database" → "Add Redis"
2. `REDIS_URL` otomatik olarak ayarlanacak

## Adım 5: Backend Servisi

1. "+ New" → "GitHub Repo" → Reponuzu seçin
2. "Settings" → "Root Directory" = `backend`
3. "Variables" sekmesinde şunları ekleyin:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=guclu-bir-sifre-girin-buraya
GIN_MODE=release
PORT=8080
ADMIN_EMAIL=admin@testsistem.com
ADMIN_PASSWORD=admin123
```

4. "Settings" → "Networking" → "Generate Domain" (Public URL alın)

**Örnek URL:** `https://backend-production-xxxx.up.railway.app`

## Adım 6: Frontend Servisi

1. "+ New" → "GitHub Repo" → Aynı repoyu seçin
2. "Settings" → "Root Directory" = `admin-panel`
3. "Variables" sekmesinde:

```
VITE_API_URL=https://backend-production-xxxx.up.railway.app/api/v1
VITE_WS_URL=wss://backend-production-xxxx.up.railway.app/ws
```

> Not: Backend URL'sini adım 5'ten alın

4. "Settings" → "Networking" → "Generate Domain"

## Adım 7: Veritabanı Migration

Railway CLI ile migration çalıştırın:

```bash
# Railway CLI kur
npm install -g @railway/cli

# Login
railway login

# Proje seç
railway link

# Backend servisine bağlan ve migration çalıştır
railway run --service backend psql $DATABASE_URL < migrations/001_init.sql
```

## Ortam Değişkenleri Özeti

### Backend
| Değişken | Açıklama |
|----------|----------|
| DATABASE_URL | PostgreSQL bağlantısı (Railway sağlar) |
| REDIS_URL | Redis bağlantısı (Railway sağlar) |
| JWT_SECRET | JWT token şifresi |
| GIN_MODE | `release` |
| PORT | `8080` |
| ADMIN_EMAIL | Admin e-posta |
| ADMIN_PASSWORD | Admin şifresi |

### Frontend
| Değişken | Açıklama |
|----------|----------|
| VITE_API_URL | Backend API URL |
| VITE_WS_URL | Backend WebSocket URL |

## Erişim

- **Admin Panel:** https://frontend-production-xxxx.up.railway.app
- **Ön Şifre:** `murad011270`
- **Admin Girişi:** admin@testsistem.com / admin123

## Maliyet

Railway ücretsiz tier ile başlayabilirsiniz:
- $5/ay kredi (hobbyist plan)
- PostgreSQL ve Redis dahil
- Custom domain desteği

## Sorun Giderme

### Build hatası
- Railway dashboard'dan "Deployments" → "View Logs"

### Database bağlantı hatası
- DATABASE_URL doğru mu kontrol edin
- PostgreSQL servisinin çalıştığından emin olun

### WebSocket bağlanamıyor
- VITE_WS_URL'in `wss://` ile başladığından emin olun
- Backend'in çalıştığını kontrol edin
