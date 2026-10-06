# Production Kurulumu (kendi sunucunuzda)

Bu rehber OpenQuiz'i internete açık bir Linux sunucusunda, kendi alan adınız ve
otomatik HTTPS ile çalıştırmayı adım adım anlatır. Genel self-hosting detayları
(sağlık uçları, loglar, Redis ile ölçekleme, metrikler) için
[SELF_HOSTING.md](SELF_HOSTING.md) dosyasına bakın.

## Mimari

```
İnternet ──443/80──▶ caddy (TLS, Let's Encrypt)
                       ├── /api/*, /hubs/*  ──▶ api   (.NET 10, SignalR)  ──▶ db (PostgreSQL 17)
                       └── diğer her şey    ──▶ web   (nginx + React)
```

- Sadece Caddy dışarıya açıktır (80/443). `db`, `api` ve `web` portları
  yalnızca `127.0.0.1` üzerinde yayınlanır.
- Veritabanı **PostgreSQL 17**'dir. Lisans gerektirmez ve x86_64 ile ARM64
  sunucularda native çalışır.
- Kalıcı veriler Docker volume'larında tutulur: `pg-data` (veritabanı),
  `api-media` (soru görselleri), `caddy-data` (TLS sertifikaları).

## 1. Sunucu gereksinimleri

| | Minimum | Önerilen |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04/24.04, Debian 12 (x86_64 veya ARM64) | |

- Docker Engine 24+ ve Compose eklentisi:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # sonra oturumu kapatıp açın
  ```
- Alan adınızın (ör. `quiz.ornek.com`) DNS **A/AAAA** kaydı sunucunun IP'sini
  göstermeli.
- Güvenlik duvarında **80** ve **443** (TCP, ayrıca HTTP/3 için 443/UDP) açık
  olmalı. Diğer her şey kapalı kalabilir:
  ```bash
  sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443 && sudo ufw enable
  ```
  > Docker, yayınladığı portlar için ufw kurallarını atlar. Bu yüzden compose
  > dosyası `db`/`api`/`web` portlarını zaten `127.0.0.1`'e bağlar.

## 2. Kodu alın ve yapılandırın

```bash
sudo mkdir -p /opt/openquiz && sudo chown $USER /opt/openquiz
git clone https://github.com/vlikcc/OpenQuiz.git /opt/openquiz
cd /opt/openquiz
cp .env.example .env
chmod 600 .env
```

`.env` içinde **en az** şunları ayarlayın:

```dotenv
COMPOSE_PROFILES=proxy
DOMAIN=quiz.ornek.com
PUBLIC_URL=https://quiz.ornek.com

POSTGRES_PASSWORD=<openssl rand -hex 24 çıktısı>
JWT_SIGNING_KEY=<openssl rand -base64 64 | tr -d '\n' çıktısı>
ADMIN_EMAIL=sizin@adresiniz.com

WEB_BIND=127.0.0.1
TRUST_FORWARDED_HEADERS=true
FORWARD_LIMIT=1
# Kalabalık salonlarda tüm katılımcılar tek NAT IP'sinden gelir:
RATE_LIMIT_PARTICIPATION=1200
```

İsteğe bağlı ama önerilen:

- **Google ile giriş:** `GOOGLE_CLIENT_ID`. Google Cloud Console → APIs &
  Services → Credentials → OAuth client ID (Web). *Authorized JavaScript
  origins* listesine `https://quiz.ornek.com` ekleyin.
- **E-posta (şifre sıfırlama, oturum hatırlatma):** `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`.

> `JWT_SIGNING_KEY`'i sonradan değiştirmek tüm kullanıcıların oturumunu
> kapatır. `POSTGRES_PASSWORD` ise yalnızca **ilk** başlatmada veritabanına
> yazılır; sonradan `.env`'de değiştirmek yetmez (bkz. Sorun giderme).

## 3. Yayına alın

```bash
./scripts/deploy.sh
```

Betik önce `.env`'i denetler (yer tutucu parolalar, kısa anahtarlar,
HTTPS/proxy tutarlılığı) ve bir sorun bulursa hiçbir şey başlatmadan durur.
Ardından imajları build eder, servisleri başlatır ve API'nin hazır olmasını
bekler. Veritabanı şeması ilk açılışta otomatik oluşturulur.

Sadece denetim için: `./scripts/deploy.sh --check`

`https://quiz.ornek.com` adresini açın. İlk istekte Caddy sertifikayı alır, bu
birkaç saniye sürebilir. `ADMIN_EMAIL` ile kayıt olan (veya Google ile giren)
hesap otomatik olarak admin olur. Diğer kullanıcılara içerik oluşturma yetkisi
**Admin Paneli**'nden verilir.

## 4. Güncelleme

```bash
cd /opt/openquiz
./scripts/backup.sh          # önce yedek
git pull
./scripts/deploy.sh
```

Bekleyen veritabanı migration'ları API açılırken otomatik uygulanır.

## 5. Yedekleme

`scripts/backup.sh` çalışan sistemi durdurmadan şunları üretir:

- `backups/openquiz-db-<tarih>.dump`: tutarlı `pg_dump` (sıkıştırılmış,
  yazıldıktan sonra doğrulanır)
- `backups/openquiz-media-<tarih>.tgz`: yüklenen soru görselleri

`BACKUP_RETENTION_DAYS` (varsayılan 14) günden eski dosyalar silinir. Her gece
çalıştırmak için `crontab -e`:

```cron
15 3 * * * /opt/openquiz/scripts/backup.sh >> /var/log/openquiz-backup.log 2>&1
```

**Yedekleri sunucunun dışına da kopyalayın**, örneğin:
`rclone sync /opt/openquiz/backups remote:openquiz-backups` veya `rsync`.
Aynı diskteki yedek, disk arızasına karşı koruma sağlamaz.

### Geri yükleme

```bash
./scripts/restore.sh backups/openquiz-db-20261006-031500.dump backups/openquiz-media-20261006-031500.tgz
```

API durdurulur, veritabanı **tek transaction** içinde değiştirilir (hata olursa
eski veri olduğu gibi kalır) ve API yeniden başlatılır. Geri yüklemeyi ara sıra
ayrı bir test kurulumunda deneyin. Denenmemiş yedek, yedek sayılmaz:

```bash
ENV_FILE=.env.restore-test ./scripts/restore.sh --yes backups/openquiz-db-....dump
```

## 6. Firebase'deki eski verileri taşıma

Firebase/Firestore sürümünü kullanıyorduysanız kullanıcıları, içerikleri,
oyları ve poll'a özel sıralamaları aktarabilirsiniz. Ayrıntılar:
[backend/tools/OpenQuiz.DataImport/README.md](../backend/tools/OpenQuiz.DataImport/README.md).
Veritabanına SSH tüneliyle bağlanın (port sadece sunucunun loopback'inde açık):

```bash
ssh -L 15432:127.0.0.1:5432 kullanici@sunucu
dotnet run --project backend/tools/OpenQuiz.DataImport -- \
  --FirebaseProjectId=<proje-id> \
  --GoogleCredentials=/yol/service-account.json \
  --ConnectionString="Host=localhost;Port=15432;Database=openquiz;Username=openquiz;Password=<POSTGRES_PASSWORD>" \
  --DryRun=true            # önce deneme, sonra --DryRun olmadan
```

## 7. İşletim

```bash
docker compose ps                     # durum ve sağlık
docker compose logs -f api            # API logları
docker compose logs -f caddy          # TLS / erişim logları
docker compose exec db psql -U openquiz openquiz   # SQL konsolu
```

- API, logları ayrıca `api-logs` volume'unda günlük dosyalara yazar (14 gün).
- Sunucu yeniden başladığında tüm servisler kendiliğinden kalkar
  (`restart: unless-stopped`). Docker'ın açılışta başlaması için:
  `sudo systemctl enable docker`.
- İzleme için `https://quiz.ornek.com/api/info` veya sunucu içinden
  `curl -fsS http://127.0.0.1:5080/health/ready` kullanılabilir.

## 8. Kendi reverse proxy'nizle (Caddy olmadan)

Sunucuda zaten nginx/Traefik varsa `COMPOSE_PROFILES`'ı boş bırakın ve:

- En iyi seçenek: `/api/` ile `/hubs/` isteklerini `127.0.0.1:5080`'e (API),
  geri kalanını `127.0.0.1:8080`'e (web) yönlendirin. Ardından
  `TRUST_FORWARDED_HEADERS=true`, `FORWARD_LIMIT=1` ayarlayın.
- Her şeyi `127.0.0.1:8080`'e yönlendirirseniz web konteynerindeki nginx araya
  bir atlama daha ekler. Bu durumda `FORWARD_LIMIT=2` olmalıdır.
- `/hubs/` için WebSocket upgrade başlıklarını (`Upgrade`, `Connection`)
  iletmeyi ve okuma zaman aşımını uzun tutmayı (ör. 1 saat) unutmayın.
- `WEB_BIND=127.0.0.1` ve `PUBLIC_URL=https://...` ayarlayın.

## Sorun giderme

| Belirti | Neden / Çözüm |
|---|---|
| Sertifika alınamıyor (`caddy` logunda ACME hataları) | DNS kaydı sunucuyu göstermiyor veya 80/443 kapalı. `dig +short quiz.ornek.com` ve güvenlik duvarını kontrol edin. |
| `api` sağlıklı olmuyor, logda `password authentication failed` | `POSTGRES_PASSWORD` ilk kurulumdan sonra değiştirilmiş. Eski parolaya dönün veya veritabanında değiştirin: `docker compose exec db psql -U openquiz -c "ALTER USER openquiz PASSWORD '<yeni>'"` |
| Google ile giriş çalışmıyor | Google Console'da *Authorized JavaScript origins* `PUBLIC_URL` ile birebir aynı olmalı (https, port yok). |
| Katılımcılar `429 Too many requests` alıyor | Tek ağdan (okul Wi-Fi) çok kişi bağlanıyor. `RATE_LIMIT_PARTICIPATION` değerini artırıp `./scripts/deploy.sh` çalıştırın. Tüm IP'ler aynı görünüyorsa `TRUST_FORWARDED_HEADERS`/`FORWARD_LIMIT` değerlerini kontrol edin. |
| Canlı oturum ilerlemiyor / sonuçlar gecikiyor | Proxy WebSocket'i (`/hubs/`) geçirmiyor. Kendi proxy'nizde upgrade başlıklarını kontrol edin. |
