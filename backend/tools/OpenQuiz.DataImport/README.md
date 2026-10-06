# OpenQuiz DataImport

Firestore'daki mevcut OpenQuiz verilerini PostgreSQL veritabanına aktaran konsol uygulaması.

## Gereksinimler

- .NET 10 SDK
- Firestore projesine erişim sağlayan **servis hesabı JSON** dosyası
- Çalışır durumda PostgreSQL veritabanı (migrations otomatik uygulanır). Production'da
  veritabanı portu yalnızca sunucunun loopback'inde açıktır; SSH tüneli kullanın
  (bkz. [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md)).

## Taşınan Veriler

| Kaynak (Firestore)         | Hedef (PostgreSQL)           |
|----------------------------|------------------------------|
| `authorizedUsers/{email}`  | `Users` (CanCreate = true)   |
| `registeredUsers/{uid}`    | `Users`                      |
| `polls/{pollId}`           | `Polls`, `Questions`, `Options` |
| `polls/{pollId}/votes/*`   | `Votes` (yanıt süresi `rt` dahil), `OpenAnswers` |
| `polls/{pollId}/scores/*`  | `Scores` (poll'a özel sıralama) |
| `scores/{userName}`        | `Scores` (eski global tablo, PollId=null) |

Haziran 2026 öncesi poll'larda `scores` alt koleksiyonu yoktur; bu poll'ların
sıralaması aktarılan oylardan (doğru cevap × soru puanı, toplam süre) yeniden
hesaplanır.

## Kullanım

```bash
dotnet run --project tools/OpenQuiz.DataImport -- \
    --FirebaseProjectId=openquiz-c9a0c \
    --GoogleCredentials=/path/to/service-account.json \
    --ConnectionString="Host=localhost;Port=5432;Database=openquiz;Username=openquiz;Password=…"
```

### Parametreler

| Parametre            | Zorunlu | Varsayılan       | Açıklama |
|----------------------|---------|------------------|----------|
| `FirebaseProjectId`  | ✅      | —                | Firebase proje ID'si |
| `GoogleCredentials`  | ❌      | `GOOGLE_APPLICATION_CREDENTIALS` env | Servis hesabı JSON dosya yolu |
| `ConnectionString`   | ✅      | —                | PostgreSQL bağlantı dizesi (Npgsql formatı) |
| `AppId`              | ❌      | `quiz-master-pro` | Firestore artifact yolu (`artifacts/{AppId}/public/data`) |
| `DryRun`             | ❌      | `false`          | `true` ise sadece okur, veritabanına yazmaz |

Parametreler hem komut satırı argümanı (`--Key=Value`) hem de ortam değişkeni olarak verilebilir:

```bash
export FIREBASE_PROJECT_ID=openquiz-c9a0c
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
export OPENQUIZ_CONNECTION="Host=localhost;Port=5432;Database=openquiz;Username=openquiz;Password=…"
dotnet run --project tools/OpenQuiz.DataImport
```

## Dry Run

Veritabanına yazmadan kaç kayıt aktarılacağını görmek için:

```bash
dotnet run --project tools/OpenQuiz.DataImport -- \
    --FirebaseProjectId=openquiz-c9a0c \
    --ConnectionString="..." \
    --DryRun=true
```

## İdempotency (Tekrarlı Çalıştırma)

Araç tekrar çalıştırıldığında:

- **Users**: Email bazında kontrol; varsa atlar, `CanCreate`/`DisplayName` günceller.
- **Polls**: Başlık + oluşturucu bazında kontrol; varsa atlar.
- **Votes**: API'nin canlı oylarda kullandığı `QuestionId + VoterKey` (büyük/küçük harf duyarsız isim) bazında kontrol; varsa atlar.
- **Poll sıralamaları**: `PollId + UserName` bazında kontrol; varsa atlar.
- **Global skorlar**: `UserName` bazında kontrol; varsa puanı günceller.

## Çıkış Kodları

| Kod | Anlam |
|-----|-------|
| `0` | Başarılı |
| `1` | Yapılandırma hatası veya kritik hata |
| `2` | Import tamamlandı ama bazı kayıtlarda hata oluştu |

## Çıktı Örneği

```
───────────────── OpenQuiz DataImport ──────────────────
┌───────────────────┬─────────────────────────────┐
│ Parameter         │ Value                       │
├───────────────────┼─────────────────────────────┤
│ Firebase project  │ openquiz-c9a0c              │
│ App id            │ quiz-master-pro             │
│ Dry-run           │ NO                          │
└───────────────────┴─────────────────────────────┘

✓ Connected to Firestore
✓ Database migrations applied

1/5 Importing users...
  Users: 12 imported, 3 skipped, 0 errors
2/5 Importing polls...
  Polls: 8 imported, 0 skipped, 0 errors
3/5 Importing votes...
  Votes: 245 imported, 12 skipped, 0 errors
4/5 Importing per-poll standings...
  Standings: 24 imported, 0 skipped, 0 errors
5/5 Importing legacy global scores...
  Scores: 6 imported, 0 skipped, 0 errors

───────────────────── Summary ─────────────────────────
┌────────┬──────────┬─────────┬────────┬───────┐
│ Entity │ Imported │ Skipped │ Errors │ Total │
├────────┼──────────┼─────────┼────────┼───────┤
│ Users  │       12 │       3 │      0 │    15 │
│ Polls  │        8 │       0 │      0 │     8 │
│ Votes  │      245 │      12 │      0 │   257 │
│ Scores │       30 │       0 │      0 │    30 │
│        │          │         │        │       │
│ Total  │      295 │      15 │      0 │   310 │
└────────┴──────────┴─────────┴────────┴───────┘

✓ Import complete!
```
