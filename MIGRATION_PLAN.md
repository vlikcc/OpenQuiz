# OpenQuiz — Self-Hosted Migration Plan

**Hedef:** Mevcut Firebase tabanlı OpenQuiz uygulamasını, Google bağımlılığını yalnızca **Google ile giriş** özelliğiyle sınırlayacak şekilde **.NET 10 + MSSQL** backend'ine taşımak, frontend'i React olarak korumak, **Mentimeter tarzı kelime bulutu (Word Cloud)** içerik türünü eklemek ve tüm sistemi **self-hosted** (Docker Compose) olarak çalıştırılabilir hale getirmek.

**Kaynak repo:** [vlikcc/OpenQuiz](https://github.com/vlikcc/OpenQuiz) — değiştirilmeyecek.
**Hedef repo:** Yeni oluşturulacak (`OpenQuiz-Selfhosted`).

---

## 1. Mevcut Sistem Analizi

### 1.1 Teknoloji Yığını (Şu Anki)
| Katman | Teknoloji |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS |
| Mobil shell | Capacitor (iOS/Android) |
| Auth | Firebase Auth (Google + Email/Password + Anonymous) |
| Veritabanı | Cloud Firestore (NoSQL) |
| Real-time | Firestore `onSnapshot` listener'ları |
| Hosting | Firebase Hosting |
| Diğer Google | Firebase SDK, Google OAuth Web Client |

### 1.2 Mevcut Veri Modeli (Firestore)
Tüm veriler `artifacts/quiz-master-pro/public/data/` altında:

```
polls/{pollId}                       # Anket/yarışma metadata + sorular + voteCounts (denormalize)
  ├─ votes/{voteId}                  # Her oy ayrı doc (qi, oi, ois, uid, un, c, ans, qt, ts)
  └─ reactions/{reactionId}          # Emoji reaksiyonlar (anlık)

scores/{userName}                    # Lider tablosu (score, totalTime)
authorizedUsers/{email}              # İçerik oluşturma yetkisi olan kullanıcılar
registeredUsers/{uid}                # Email/şifre ile kayıt olan kullanıcılar
```

Anket türleri ([src/config/firebase.js:46](src/config/firebase.js)):
- `contest` — Yarışma (doğru cevaplı, çoktan seçmeli, puanlama)
- `survey` — Anket (doğru cevap yok, çoklu seçim olabilir)
- `quiz` — Tek/birkaç sorulu hızlı test
- `exam` — Sınav (çoktan seçmeli + açık uçlu, KaTeX desteği)
- **(YENİ)** `wordcloud` — Kelime bulutu (Mentimeter tarzı)

### 1.3 Frontend Bileşen Haritası
| Dosya | Sorumluluk | Firestore Bağımlılığı |
|---|---|---|
| `src/App.jsx` | Routing, auth state | `onAuthStateChanged`, `signInWithPopup`, `signInAnonymously`, `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `sendPasswordResetEmail`, doc getDoc/setDoc |
| `src/config/firebase.js` | Firebase init | `initializeApp`, `getAuth`, `getFirestore`, `GoogleAuthProvider` |
| `src/utils/authHelper.js` | Native Google auth (Capacitor) | Firebase Auth + Capacitor Browser |
| `src/components/Dashboard.jsx` | Anket listesi, oluşturma/düzenleme | `collection`, `addDoc`, `setDoc`, `deleteDoc`, `onSnapshot`, `query+where+orderBy` |
| `src/components/PresenterMode.jsx` | Sunum modu, canlı sonuçlar | Poll/votes/reactions için `onSnapshot`, `updateDoc` |
| `src/components/VoterMode.jsx` | Katılımcı oy verme | `onSnapshot`, `addDoc` (votes/reactions), `runTransaction` (voteCounts), `setDoc` (scores), `updateDoc` (participantCount) |
| `src/components/AdminPanel.jsx` | Kullanıcı yetkilendirme | `setDoc`, `deleteDoc`, `onSnapshot` (authorizedUsers, registeredUsers) |
| `src/components/AuthScreen.jsx` | Giriş/kayıt formu | Firebase Auth çağrıları |
| `src/components/ResultsAnalysis.jsx` | İstatistik + export (PDF/Excel) | `onSnapshot` (votes, scores) |
| `src/components/WaitingRoom.jsx` | Bekleme odası | Pasif (props ile beslenir) |
| `src/components/FileImport.jsx` | Excel/Word'den soru import | Sadece client-side |
| `src/components/KatexRenderer.jsx` | KaTeX render | Bağımsız |
| `src/components/QrModal.jsx` | QR kod | Bağımsız |
| `src/components/LandingPage.jsx`, `LoginScreen.jsx`, `TabBar.jsx`, `ProfileScreen.jsx` | UI | Genelde bağımsız |

### 1.4 Kaldırılacak Bağımlılıklar
- `firebase` npm paketi (auth + firestore)
- `firebase.json`, `firestore.rules`, `.firebaserc`, `.firebase/`
- `src/config/firebase.js` (yerine `src/config/api.js` ve `src/config/auth.js`)
- `src/utils/authHelper.js` (yerine basit Google OAuth flow)
- `.env` içindeki `VITE_API_KEY`, `VITE_AUTH_DOMAIN`, `VITE_PROJECT_ID`, vb.

### 1.5 Korunacaklar
- Google OAuth ile giriş (yeni akış: Google Identity Services + backend JWT exchange)
- Capacitor mobil shell (opsiyonel — README'de belirtilecek)
- Recharts, KaTeX, jsPDF, xlsx, mammoth, lucide-react gibi UI/utility paketler
- Tüm UI bileşenlerinin görsel tasarımı ve UX akışı

---

## 2. Hedef Mimari

```
┌────────────────────────────────────────────────────────┐
│  React SPA (Vite build → nginx)                        │
│  ├─ HTTP: REST API (fetch)                             │
│  └─ WebSocket: SignalR (@microsoft/signalr)            │
└────────────────────────────────────────────────────────┘
                          ▲
                          │ HTTPS / WSS
                          ▼
┌────────────────────────────────────────────────────────┐
│  ASP.NET Core 10 (Kestrel)                             │
│  ├─ /api/auth        (Google ID token, email/password) │
│  ├─ /api/polls       (CRUD + lifecycle)                │
│  ├─ /api/votes       (submit, aggregate)               │
│  ├─ /api/scores      (leaderboard)                     │
│  ├─ /api/users       (admin: authorized list)          │
│  ├─ /api/wordcloud   (submit terms, fetch aggregated)  │
│  └─ /hubs/poll       (SignalR: poll state, votes,      │
│                        reactions, wordcloud updates)   │
└────────────────────────────────────────────────────────┘
                          ▲
                          │ EF Core 10
                          ▼
┌────────────────────────────────────────────────────────┐
│  MSSQL Server 2022                                     │
│  Users, Polls, Questions, Options, Votes,              │
│  OpenAnswers, WordCloudSubmissions, Scores,            │
│  Reactions, AuthorizedUsers, RefreshTokens             │
└────────────────────────────────────────────────────────┘
```

### 2.1 Backend Çözüm Yapısı
```
backend/
├── OpenQuiz.sln
├── src/
│   ├── OpenQuiz.Api/            # ASP.NET Core 10 host (Minimal API + Controllers karışık)
│   │   ├── Controllers/
│   │   │   ├── AuthController.cs
│   │   │   ├── PollsController.cs
│   │   │   ├── VotesController.cs
│   │   │   ├── ScoresController.cs
│   │   │   ├── UsersController.cs
│   │   │   └── WordCloudController.cs
│   │   ├── Hubs/
│   │   │   └── PollHub.cs       # SignalR
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── Dockerfile
│   ├── OpenQuiz.Domain/         # Entities, Enums, Domain Events
│   ├── OpenQuiz.Application/    # DTOs, Services, Validators (FluentValidation)
│   └── OpenQuiz.Infrastructure/ # EF Core DbContext, Migrations, Identity, Google verify
└── tests/
    ├── OpenQuiz.UnitTests/
    └── OpenQuiz.IntegrationTests/   # WebApplicationFactory + Testcontainers MSSQL
```

### 2.2 Frontend Yapısı (Değişiklikler)
```
src/
├── config/
│   ├── api.js               # API base URL + fetch wrapper (JWT ekler, refresh handler)
│   ├── auth.js              # Google Identity Services init + token storage
│   └── constants.js         # CONTENT_TYPES (wordcloud dahil), COLORS
├── services/                # YENİ: API + SignalR servisleri
│   ├── authService.js
│   ├── pollService.js
│   ├── voteService.js
│   ├── scoreService.js
│   ├── userService.js
│   ├── wordcloudService.js
│   └── realtimeService.js   # SignalR client wrapper (HubConnection + auto-reconnect)
├── hooks/                   # YENİ
│   ├── useAuth.js
│   ├── usePollSubscription.js
│   ├── useVotesSubscription.js
│   └── useWordCloudSubscription.js
└── components/
    ├── ... (mevcutlar düzenlenir)
    └── WordCloudMode.jsx    # YENİ: kelime bulutu sunum görünümü
```

---

## 3. Veri Modeli (MSSQL)

### 3.1 Tablolar

```sql
Users
  Id              UNIQUEIDENTIFIER PK
  Email           NVARCHAR(256) UNIQUE NOT NULL
  DisplayName     NVARCHAR(128)
  PasswordHash    NVARCHAR(512) NULL        -- BCrypt; null ise sadece Google
  GoogleSub       NVARCHAR(128) NULL UNIQUE -- Google "sub" claim
  IsAdmin         BIT NOT NULL DEFAULT 0
  CanCreate       BIT NOT NULL DEFAULT 0
  CreatedAt       DATETIME2 NOT NULL
  LastLoginAt     DATETIME2 NULL

RefreshTokens
  Id              UNIQUEIDENTIFIER PK
  UserId          FK → Users.Id
  TokenHash       NVARCHAR(256) NOT NULL
  ExpiresAt       DATETIME2 NOT NULL
  RevokedAt       DATETIME2 NULL
  CreatedAt       DATETIME2 NOT NULL

Polls
  Id              UNIQUEIDENTIFIER PK
  Title           NVARCHAR(256) NOT NULL
  Type            TINYINT NOT NULL          -- 1=contest 2=survey 3=quiz 4=exam 5=wordcloud
  Status          TINYINT NOT NULL          -- 1=waiting 2=live 3=ended
  CurrentQuestionIndex INT NOT NULL DEFAULT 0
  ParticipantCount INT NOT NULL DEFAULT 0
  CreatorId       FK → Users.Id
  CreatedAt       DATETIME2 NOT NULL
  UpdatedAt       DATETIME2 NULL
  IsActive        BIT NOT NULL DEFAULT 0

Questions
  Id              UNIQUEIDENTIFIER PK
  PollId          FK → Polls.Id (ON DELETE CASCADE)
  OrderIndex      INT NOT NULL
  Text            NVARCHAR(MAX) NOT NULL
  ImageUrl        NVARCHAR(1024) NULL
  TimeLimit       INT NOT NULL DEFAULT 30
  QuestionType    TINYINT NOT NULL          -- 1=multiple 2=open 3=wordcloud
  AllowMultiple   BIT NOT NULL DEFAULT 0
  CorrectOptionIndex INT NULL
  CorrectAnswer   NVARCHAR(MAX) NULL
  Points          INT NOT NULL DEFAULT 10
  MaxWords        INT NULL                  -- WordCloud için katılımcı başına max kelime
  WordCloudConfig NVARCHAR(MAX) NULL        -- JSON: min/max length, blacklist, vb.

Options
  Id              UNIQUEIDENTIFIER PK
  QuestionId      FK → Questions.Id (CASCADE)
  OrderIndex      INT NOT NULL
  Text            NVARCHAR(1024) NOT NULL

Votes                                       -- contest/survey/quiz/exam (multiple choice)
  Id              UNIQUEIDENTIFIER PK
  PollId          FK → Polls.Id (CASCADE)
  QuestionId      FK → Questions.Id
  UserId          FK → Users.Id NULL        -- anonim katılım olabilir
  UserName        NVARCHAR(128) NOT NULL
  SelectedOptionIndices NVARCHAR(256) NOT NULL  -- JSON array: [0,2]
  IsCorrect       BIT NULL
  ResponseTimeMs  INT NULL
  CreatedAt       DATETIME2 NOT NULL
  UNIQUE (QuestionId, UserId)               -- aynı kullanıcı aynı soruya bir kez

OpenAnswers                                 -- exam type=open
  Id              UNIQUEIDENTIFIER PK
  PollId, QuestionId, UserId, UserName
  AnswerText      NVARCHAR(MAX) NOT NULL
  Score           INT NULL                  -- elle değerlendirme sonrası
  CreatedAt       DATETIME2 NOT NULL

WordCloudSubmissions                        -- type=wordcloud
  Id              UNIQUEIDENTIFIER PK
  PollId, QuestionId
  UserId          FK NULL
  UserName        NVARCHAR(128) NOT NULL
  Term            NVARCHAR(64) NOT NULL     -- normalize edilmiş kelime (lower, trim)
  OriginalTerm    NVARCHAR(64) NOT NULL     -- kullanıcının gönderdiği orijinal
  CreatedAt       DATETIME2 NOT NULL
  INDEX (QuestionId, Term)

WordCloudAggregates                         -- materialize edilmiş sayım (perf için)
  Id              UNIQUEIDENTIFIER PK
  QuestionId      FK → Questions.Id
  Term            NVARCHAR(64) NOT NULL
  Count           INT NOT NULL
  UNIQUE (QuestionId, Term)

Scores                                      -- lider tablosu
  Id              UNIQUEIDENTIFIER PK
  PollId          FK NULL                   -- null = global skor
  UserName        NVARCHAR(128) NOT NULL
  Score           INT NOT NULL DEFAULT 0
  TotalTimeMs     BIGINT NOT NULL DEFAULT 0
  UNIQUE (PollId, UserName)

Reactions                                   -- emoji burst (ephemeral, sadece broadcast)
  Id              UNIQUEIDENTIFIER PK
  PollId          FK
  Emoji           NVARCHAR(16) NOT NULL
  Sender          NVARCHAR(128)
  CreatedAt       DATETIME2 NOT NULL
  -- TTL job: 1 saatten eski reaksiyonları sil
```

### 3.2 Tasarım Notları
- **`SelectedOptionIndices`** JSON kolon olarak tutuluyor; çoklu seçim için ana sayım `WHERE JSON_VALUE` ile yapılabilir, ama gerçek istatistik için `VoteCounts` view'ı veya runtime aggregation kullanılır.
- **`WordCloudAggregates`** denormalize sayım tablosudur — her submit'te `MERGE` ile artırılır, frontend tek sorgu ile en sık kelimeleri çeker.
- **Concurrency:** `Polls.CurrentQuestionIndex` ve `ParticipantCount` için EF Core `RowVersion` (`timestamp`) kolonu ile optimistic concurrency.
- **Soft delete yok** — yarışmalar fiziksel silinir (CASCADE).

---

## 4. API Tasarımı

### 4.1 Auth
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/auth/google` | Body: `{ idToken }` — Google ID token doğrula, kullanıcı oluştur/güncelle, JWT döndür |
| POST | `/api/auth/register` | Email + şifre + isim ile kayıt |
| POST | `/api/auth/login` | Email + şifre |
| POST | `/api/auth/refresh` | Refresh token → yeni access token |
| POST | `/api/auth/logout` | Refresh token'ı revoke et |
| POST | `/api/auth/password-reset/request` | Email ile reset kodu (SMTP varsa) |
| POST | `/api/auth/password-reset/confirm` | Token + yeni şifre |
| GET  | `/api/auth/me` | Mevcut kullanıcı bilgisi |

**JWT içeriği:** `sub` (UserId), `email`, `name`, `isAdmin`, `canCreate`, `exp` (15 dk). Refresh token httpOnly cookie veya body'de.

### 4.2 Polls
| Method | Endpoint | Auth | Açıklama |
|---|---|---|---|
| GET    | `/api/polls` | required | Kendi anketleri (admin → hepsi) |
| GET    | `/api/polls/{id}` | optional | Detay (katılım için anonim de erişebilir) |
| POST   | `/api/polls` | canCreate | Yeni anket (sorular + seçenekler iç içe) |
| PUT    | `/api/polls/{id}` | owner/admin | Güncelle |
| DELETE | `/api/polls/{id}` | owner/admin | Sil |
| POST   | `/api/polls/{id}/activate` | owner/admin | `status=live`, `currentQuestionIndex=0` |
| POST   | `/api/polls/{id}/next-question` | owner/admin | Index++ veya `status=ended` |
| POST   | `/api/polls/{id}/prev-question` | owner/admin | |
| POST   | `/api/polls/{id}/end` | owner/admin | `status=ended` |
| POST   | `/api/polls/{id}/join` | optional | `ParticipantCount++` ve SignalR grubuna ekle |

### 4.3 Votes
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/polls/{id}/votes` | Body: `{ questionIndex, selectedIndices[], responseTimeMs, userName, userId? }` |
| POST | `/api/polls/{id}/open-answers` | Açık uçlu cevap |
| GET  | `/api/polls/{id}/votes` | (owner/admin) tüm oylar (analiz için) |
| GET  | `/api/polls/{id}/aggregates` | Soru bazlı sayımlar (cached) |

### 4.4 Word Cloud
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/polls/{id}/wordcloud/submit` | Body: `{ questionIndex, terms: string[], userName }` — sunucu normalize eder (lowercase, trim, blacklist filter, max length), `WordCloudAggregates`'i atomik artırır |
| GET  | `/api/polls/{id}/wordcloud/{questionIndex}` | `[{ term, count }]` (top N) |

### 4.5 Reactions
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/polls/{id}/reactions` | `{ emoji, sender }` — DB'ye yaz, SignalR'a publish |

### 4.6 Scores
| GET | `/api/scores?pollId=...` | Lider tablosu (top 100) |

### 4.7 Admin / Users
| GET    | `/api/users/authorized` | admin |
| POST   | `/api/users/authorized` | admin (email) |
| DELETE | `/api/users/authorized/{email}` | admin |
| GET    | `/api/users/registered` | admin |

### 4.8 SignalR Hub: `/hubs/poll`
Client → server:
- `JoinPoll(pollId)` — group'a katıl
- `LeavePoll(pollId)`

Server → client events:
- `PollUpdated(poll)` — currentQuestionIndex, status, participantCount değişimi
- `VoteCountsUpdated(questionIndex, counts)` — anlık sayım (throttled 250 ms)
- `WordCloudUpdated(questionIndex, top50Terms)` — kelime bulutu güncellemesi (throttled 500 ms)
- `ReactionBurst({ emoji, sender })` — anlık emoji
- `OpenAnswerSubmitted({ questionIndex, userName })` — sunucu sayacı için

---

## 5. Auth Akışı (Google)

### 5.1 Google ile Giriş
1. Frontend, **Google Identity Services** (GIS) JavaScript library kullanır — `gsi/client` (Firebase yok).
2. Kullanıcı "Google ile giriş" butonuna tıklar → GIS popup açar → `credential` (ID token JWT) döner.
3. Frontend `POST /api/auth/google { idToken }` çağırır.
4. Backend:
   - `Google.Apis.Auth.GoogleJsonWebSignature.ValidateAsync(idToken, new ValidationSettings { Audience = [ClientId] })`
   - Payload'dan `sub`, `email`, `name`, `picture` alır.
   - Users tablosunda `GoogleSub` ile bul; yoksa email ile eşleştir; o da yoksa yeni kullanıcı oluştur.
   - JWT access token + refresh token üretir, döner.
5. Frontend token'ı `sessionStorage` veya `localStorage`'a koyar; tüm istekler `Authorization: Bearer <token>` header'ı ile gider.

**Capacitor (native) için:** GIS native'de çalışmaz. İki seçenek:
- (a) Capacitor için `@capgo/capacitor-social-login` veya `@codetrix-studio/capacitor-google-auth` ile native Google Sign-In → ID token → aynı `/api/auth/google` endpoint.
- (b) Mobil shell tamamen kaldırılır (basitlik için önerilen).

### 5.2 Email/Şifre
- Kayıt: `POST /api/auth/register` → BCrypt hash (`BCrypt.Net-Next`), 12 round.
- Giriş: `POST /api/auth/login` → hash karşılaştırma → JWT.

### 5.3 Anonim katılım
- QR ile gelen voter'lar için **giriş zorunlu değil**. Sadece `userName` text input ile katılırlar. Backend `UserId = null` ile vote/wordcloud submission kaydeder.

---

## 6. Real-Time Stratejisi (SignalR)

### 6.1 Bağlantı
- Frontend `@microsoft/signalr` paketi.
- `realtimeService.js` tek bir `HubConnection` yönetir, JWT'yi `accessTokenFactory` ile gönderir.
- Auto-reconnect: `withAutomaticReconnect([0, 2000, 5000, 10000])`.

### 6.2 Server-side
- Vote/wordcloud submit → backend aggregate günceller → **Channel** üzerinden throttled `Clients.Group(pollId).SendAsync(...)`.
- Throttle stratejisi: `IHostedService` + `ConcurrentDictionary<pollId+qi, ThrottleState>`. Her N ms'de bir grup başına en fazla 1 broadcast.

### 6.3 Geriye düşüş
- SignalR fallback: WebSocket → SSE → LongPolling (SignalR varsayılan).
- Bağlantı kopuk durumda kritik state için frontend `GET /api/polls/{id}` ile resync.

---

## 7. Word Cloud (Mentimeter Tarzı) Özelliği

### 7.1 Davranış
- **Sunum tarafı (`PresenterMode`):** "Word Cloud" sekmesinde gerçek zamanlı büyüyen kelimeler. Kelimeler büyüklüğe göre fontla render edilir (font-size = `min + (count/max) * (max - min)`).
- **Katılımcı tarafı (`VoterMode`):** Tek bir input (veya birden fazla, `maxWords` ayarına göre); kelime yazıp gönderir. Birden fazla gönderim olabilir (config'e bağlı).
- **Anketin tipi `wordcloud`** olduğunda Question modelinde `MaxWords` ve `WordCloudConfig` kullanılır.

### 7.2 Frontend Kütüphane
- [`react-wordcloud`](https://github.com/chrisrzhou/react-wordcloud) ya da [`d3-cloud`](https://github.com/jasondavies/d3-cloud) doğrudan.
- Yoksa kendi basit SVG layout (spiral placement) — basit versiyon yeterli.
- Karar: **`d3-cloud` + custom React wrapper** (bakım, lisans, modern React 19 uyumu için).

### 7.3 Backend Akışı
1. `POST /api/polls/{id}/wordcloud/submit` `{ questionIndex, terms[], userName }`.
2. Her term:
   - `Trim`, `ToLowerInvariant`, max 64 karakter, alfanumerik + Türkçe karakterler kabul (regex: `^[\p{L}\p{N}-]+$`).
   - Boşsa veya blacklist'te ise atla.
   - `WordCloudSubmissions` insert + `WordCloudAggregates` MERGE/UPSERT.
3. Sonra throttled broadcast `WordCloudUpdated(questionIndex, top50)`.

### 7.4 Mod Konfigürasyonu
`WordCloudConfig` JSON:
```json
{
  "maxWordsPerUser": 3,
  "minTermLength": 2,
  "maxTermLength": 24,
  "blacklist": ["spam"],
  "topN": 50,
  "allowDuplicatesFromSameUser": false
}
```

### 7.5 UI Genişletmeleri
- `CONTENT_TYPES.wordcloud = { label: 'Kelime Bulutu', icon: '☁️', color: 'sky', ... }`
- Dashboard'da yeni "Kelime Bulutu" oluştur butonu.
- Yeni `WordCloudMode.jsx` bileşeni — sunum tarafı render.
- `VoterMode.jsx` içine `WordCloudVoter` alt-bileşeni.

---

## 8. Self-Hosting (Docker Compose)

`docker-compose.yml`:
```yaml
services:
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "${MSSQL_SA_PASSWORD}"
      MSSQL_PID: Developer
    ports: ["1433:1433"]
    volumes: [mssql-data:/var/opt/mssql]
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $$MSSQL_SA_PASSWORD -No -Q 'SELECT 1'"]
      interval: 10s
      retries: 10

  api:
    build: ./backend
    depends_on:
      db: { condition: service_healthy }
    environment:
      ConnectionStrings__Default: "Server=db;Database=OpenQuiz;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True"
      Jwt__Issuer: "openquiz"
      Jwt__Audience: "openquiz"
      Jwt__SigningKey: "${JWT_SIGNING_KEY}"
      Google__ClientId: "${GOOGLE_CLIENT_ID}"
      Cors__AllowedOrigins: "${FRONTEND_ORIGIN}"
    ports: ["5080:8080"]

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
      args:
        VITE_API_BASE_URL: "${VITE_API_BASE_URL}"
        VITE_GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"
    ports: ["8080:80"]
    depends_on: [api]

volumes:
  mssql-data:
```

`.env.example`:
```
MSSQL_SA_PASSWORD=Replace_W1th_Strong_Pass!
JWT_SIGNING_KEY=generate-with-openssl-rand-base64-64
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
FRONTEND_ORIGIN=http://localhost:8080
VITE_API_BASE_URL=http://localhost:5080
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

**Migrations:** API container başlangıçta `dotnet ef database update` çalıştırır (veya `Database.MigrateAsync()` Program.cs'de). İlk seed: admin email (`OPENQUIZ_ADMIN_EMAIL`).

---

## 9. Frontend Refaktör Planı

### 9.1 Yeni Servisler
**`src/services/realtimeService.js`** — Tek HubConnection. `subscribe(pollId, handlers)` döner; bileşenler `useEffect` içinde `subscribe/unsubscribe`.

**`src/services/pollService.js`** örnek:
```js
export const pollService = {
  list: () => api.get('/api/polls'),
  get: (id) => api.get(`/api/polls/${id}`),
  create: (data) => api.post('/api/polls', data),
  update: (id, data) => api.put(`/api/polls/${id}`, data),
  remove: (id) => api.delete(`/api/polls/${id}`),
  activate: (id) => api.post(`/api/polls/${id}/activate`),
  nextQuestion: (id) => api.post(`/api/polls/${id}/next-question`),
  join: (id, userName) => api.post(`/api/polls/${id}/join`, { userName }),
};
```

### 9.2 Bileşen Değişiklikleri
| Bileşen | Değişiklik |
|---|---|
| `App.jsx` | Firebase auth state listener → `useAuth` hook (token decode + `/api/auth/me`). Email/şifre/Google handler'ları `authService` çağrısına döner. |
| `Dashboard.jsx` | `onSnapshot` → `useEffect` + `pollService.list()` + `realtimeService.subscribePollList()` (opsiyonel; basit POLL yeterli). `addDoc`/`setDoc`/`deleteDoc` → `pollService.create/update/remove`. |
| `PresenterMode.jsx` | Poll/votes/reactions için `usePollSubscription(pollId)` hook'u. `updateDoc({ currentQuestionIndex })` → `pollService.nextQuestion(id)`. |
| `VoterMode.jsx` | `addDoc(votes)` → `voteService.submit(...)`. `runTransaction(voteCounts)` → backend yapar. `setDoc(scores)` → backend yapar. `updateDoc(participantCount)` → `pollService.join(...)`. |
| `AdminPanel.jsx` | `userService.listAuthorized/add/remove/listRegistered`. |
| `AuthScreen.jsx` | Google butonu → GIS `google.accounts.id.prompt()` veya custom button + `credential` callback. |
| `ResultsAnalysis.jsx` | `votes`/`scores` snapshot → bir kez `GET /api/polls/{id}/votes` + `GET /api/scores?pollId=...` (analiz sayfası canlı olmak zorunda değil; ya da hub'a abone olur). |

### 9.3 CONTENT_TYPES güncellemesi
```js
wordcloud: {
  label: 'Kelime Bulutu',
  icon: '☁️',
  color: 'sky',
  description: 'Katılımcıların yazdığı kelimelerden anlık bulut oluştur',
  hasCorrectAnswer: false,
  multipleQuestions: true,
  questionType: 'wordcloud',
}
```

### 9.4 Kaldırılacak Paketler
```
firebase, @capacitor/* (eğer mobil shell de kaldırılırsa)
```
### 9.5 Eklenecek Paketler
```
@microsoft/signalr
@react-oauth/google     # GIS React wrapper (alternatif: doğrudan gsi/client)
d3-cloud (+ d3-scale, d3-selection)
```

---

## 10. Adım Adım Migration Roadmap

### Faz 0 — Hazırlık (½ gün)
- [x] Mevcut sistem analizi (bu doküman).
- [ ] Yeni GitHub repo oluştur (`OpenQuiz-Selfhosted`).
- [ ] `.gitignore`, `LICENSE`, README iskeleti.
- [ ] Google Cloud Console'da yeni OAuth Web Client (origin: localhost ve prod URL'leri).

### Faz 1 — Backend İskeleti (1 gün)
- [ ] `dotnet new sln`, 4 proje (Api / Domain / Application / Infrastructure).
- [ ] EF Core 10 + `Microsoft.EntityFrameworkCore.SqlServer`.
- [ ] Entity'ler + DbContext + İlk migration.
- [ ] JWT auth pipeline (`Microsoft.AspNetCore.Authentication.JwtBearer`).
- [ ] Google ID token doğrulama (`Google.Apis.Auth`).
- [ ] BCrypt parola.
- [ ] Health check endpoint.
- [ ] Serilog → console + dosya.
- [ ] Swagger/OpenAPI.

### Faz 2 — Core API'ler (1.5 gün)
- [ ] Auth controller (google, register, login, refresh, me).
- [ ] Polls CRUD + lifecycle endpoints.
- [ ] Votes endpoints (transaction ile aggregate update).
- [ ] Scores endpoint.
- [ ] Users (admin) endpoint.
- [ ] FluentValidation + ProblemDetails error format.
- [ ] Integration testler (Testcontainers MSSQL).

### Faz 3 — Real-time + Word Cloud (1 gün)
- [ ] `PollHub` SignalR.
- [ ] Vote submission sonrası throttled broadcast.
- [ ] WordCloud endpoint + aggregate UPSERT (raw SQL `MERGE`).
- [ ] WordCloud broadcast.
- [ ] Reactions broadcast (DB'siz, sadece in-memory + opsiyonel log).

### Faz 4 — Frontend Auth + API Layer (1 gün)
- [ ] `services/` katmanı.
- [ ] `realtimeService.js`.
- [ ] `useAuth` hook, token storage + refresh interceptor.
- [ ] `AuthScreen.jsx`'i `@react-oauth/google` ile baştan yaz.
- [ ] `firebase` paketini kaldır, build yeşil olana kadar tek tek bileşen migrate et.

### Faz 5 — Bileşen Migration (1.5 gün)
- [ ] `Dashboard.jsx` → REST + opsiyonel poll list polling.
- [ ] `PresenterMode.jsx` → SignalR + REST.
- [ ] `VoterMode.jsx` → SignalR + REST.
- [ ] `AdminPanel.jsx` → REST.
- [ ] `ResultsAnalysis.jsx` → REST (statik fetch).

### Faz 6 — Word Cloud UI (½ gün)
- [ ] `CONTENT_TYPES.wordcloud` ekle.
- [ ] Dashboard'a "Kelime Bulutu" oluşturma butonu.
- [ ] `WordCloudMode.jsx` (sunum tarafı, d3-cloud).
- [ ] `WordCloudVoter` alt-bileşeni (`VoterMode` içinde branch).
- [ ] ResultsAnalysis'e wordcloud snapshot/export.

### Faz 7 — Docker + Self-Host (½ gün)
- [ ] `backend/Dockerfile` (multi-stage, AOT opsiyonel).
- [ ] `Dockerfile.web` (nginx + Vite build).
- [ ] `docker-compose.yml`.
- [ ] `.env.example`.
- [ ] README — kurulum talimatları (Türkçe).
- [ ] İlk admin seed mekanizması (ENV ile).

### Faz 8 — QA, Dokümantasyon, Yayın (½ gün)
- [ ] E2E senaryolar: yarışma oluştur → QR ile katıl → oy ver → sonuçları gör.
- [ ] WordCloud senaryosu: çok kullanıcılı submit → canlı güncelleme.
- [ ] Performance smoke test (200 concurrent voter).
- [ ] README + ARCHITECTURE.md + API.md.
- [ ] v1.0.0 GitHub release.

**Tahmini toplam:** ~8 iş günü tek geliştirici.

---

## 11. Riskler ve Açık Kararlar

| Risk | Etki | Azaltma |
|---|---|---|
| .NET 10 henüz çok yeni — bazı paketler güncellenmemiş olabilir | Build sorunları | .NET 8 LTS'e gerekirse downgrade kolay; csproj `TargetFramework` tek satır |
| Capacitor mobil shell SignalR ile bazı network policy çakışmalarına girebilir | Mobil çalışmaz | İlk sürümde mobil'i devre dışı bırak, README'de "TODO" olarak işaretle |
| WordCloud yüksek frekansta yazımda DB lock | Geç broadcast | `WordCloudAggregates` için `WITH (ROWLOCK)` + retry; agresif throttle (500 ms) |
| Anonim katılımda spam | Veri kirliliği | `ParticipantCount` ve `WordCloudSubmissions` için IP rate limiting (`AspNetCoreRateLimit`) |
| Şu anki Firestore verileri | Veri kaybı | Self-hosted **yeni başlangıçtır**; eski veri import gerekirse Faz 8 sonrası ayrı script |
| Google OAuth client'ın native'de farklı client_id gerektirmesi | Mobil giriş çalışmaz | Mobil çıkana kadar tek "Web" client_id kullanılır |

### Karar Noktaları
1. **Mobil shell:** ❌ **Kaldırıldı** (2026-05-20). İlk sürüm sadece web. Capacitor paketleri ve native dizinler frontend migration fazında silinecek.
2. **Şifre sıfırlama:** ✅ **SMTP entegrasyonu** (2026-05-20). MailKit kullanılacak. `PasswordResetTokens` tablosu + `SmtpOptions` (Host/Port/User/Password/From/UseStartTls) eklenecek. Endpoint'ler: `POST /api/auth/password-reset/request` ve `POST /api/auth/password-reset/confirm`. SMTP yapılandırılmamışsa endpoint 503 döner ve loglar.
3. **Çoklu dil:** Açık (öneri: hayır, kapsam dışı).
4. **Veri migration:** Açık (öneri: hayır, sıfırdan başlasın).

---

## 12. Dosya/Dizin Değişim Özeti

### Yeni dizinler
```
backend/                    # tüm .NET projesi
docs/
  ARCHITECTURE.md
  API.md
  SELF_HOSTING.md
src/services/
src/hooks/
```

### Yeni dosyalar (frontend)
```
src/config/api.js
src/config/auth.js
src/services/*.js
src/hooks/*.js
src/components/WordCloudMode.jsx
src/components/wordcloud/WordCloudCanvas.jsx
src/components/wordcloud/WordCloudVoter.jsx
Dockerfile.web
nginx.conf
docker-compose.yml
.env.example
```

### Silinecek dosyalar
```
src/config/firebase.js
src/utils/authHelper.js
firebase.json
firestore.rules
.firebaserc
.firebase/
```

### Değişecek dosyalar
```
src/App.jsx
src/components/Dashboard.jsx
src/components/PresenterMode.jsx
src/components/VoterMode.jsx
src/components/AdminPanel.jsx
src/components/AuthScreen.jsx
src/components/ResultsAnalysis.jsx
src/components/WaitingRoom.jsx          # küçük props uyumu
package.json                            # firebase out, signalr/google in
.env                                    # yeni anahtarlar
README.md
```

---

## 13. Kabul Kriterleri

- [ ] `docker compose up` ile MSSQL + API + Web ayağa kalkar, hiçbir Google Cloud kaynağı (Firestore, Firebase Hosting, FCM) çağrılmaz.
- [ ] Sadece Google ile giriş **opsiyonel** akışıdır; backend ID token'ı kendisi doğrular.
- [ ] Email/şifre ile kayıt + giriş çalışır.
- [ ] Yarışma oluşturma, QR ile katılım, oy verme, anlık sonuç gösterimi mevcutla aynı UX.
- [ ] Kelime bulutu (yeni tip): oluşturma, katılımcı submit, canlı bulut render — tamamı çalışır.
- [ ] PDF/Excel export çalışmaya devam eder.
- [ ] Admin paneli yetkili kullanıcı ekleme/silme çalışır.
- [ ] README, sıfırdan kurulum için yeterlidir (Google OAuth client_id alma talimatı dahil).

---

**Sürüm:** v1.0 — Plan dokümanı
**Yazar:** Migration kapsamında oluşturuldu, [vlikcc/OpenQuiz](https://github.com/vlikcc/OpenQuiz) baz alındı.
