# OpenQuiz — Self-Hosted

Self-hostable, real-time **quiz / survey / exam / word cloud** platform. This is the
single, production-ready successor of the Firebase-based [vlikcc/OpenQuiz](https://github.com/vlikcc/OpenQuiz):
every feature of that app lives here, including its last additions (per-poll
scoring with idempotent votes, and clearing a poll's results to run it again),
and its Firestore data can be imported with `backend/tools/OpenQuiz.DataImport`.

- **Backend:** ASP.NET Core 10 + EF Core 10
- **Database:** PostgreSQL 17
- **Frontend:** React 19 + Vite + TailwindCSS
- **Real-time:** SignalR (auto-reconnecting WebSocket)
- **Auth:** JWT (email / password) **+** Google Sign-In (ID token verified server-side via `Google.Apis.Auth`)
- **E-mail:** MailKit SMTP (for password reset)
- **Deployment:** Docker Compose, optional bundled Caddy for automatic HTTPS

> The only remaining Google dependency is **Google Sign-In** — no Firestore, no Firebase Hosting, no FCM, no Cloud Functions.

## Quick start (local / LAN)

```bash
cp .env.example .env
# edit .env — set POSTGRES_PASSWORD, JWT_SIGNING_KEY, GOOGLE_CLIENT_ID, ADMIN_EMAIL
docker compose up -d --build
```

Then open <http://localhost:8080>.

## Production (your own server, HTTPS)

```bash
cp .env.example .env    # set COMPOSE_PROFILES=proxy, DOMAIN, PUBLIC_URL=https://DOMAIN, secrets
./scripts/deploy.sh     # validates .env, builds, starts, waits for health
./scripts/backup.sh     # nightly via cron; restore with scripts/restore.sh
```

Step-by-step guide (Turkish): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Stack
details: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Features

- **Yarışma** (contest) — multiple choice with correct answers and scoring
- **Anket** (survey) — multi/single select, no right answer
- **Quiz** — single-question burst poll
- **Sınav** (exam) — multi-choice + open-ended with KaTeX/Markdown
- **Kelime Bulutu** (word cloud) — live Mentimeter-style aggregation 🆕
- QR-based join, live emoji reactions, presenter mode, results export (PDF / Excel)
- Clear a poll's results to run it again with a new group (join code and QR stay valid)

## Project structure

```
.
├── backend/                       # .NET 10 solution
│   ├── src/
│   │   ├── OpenQuiz.Domain/       # entities + enums
│   │   ├── OpenQuiz.Application/  # DTOs, validators, abstractions
│   │   ├── OpenQuiz.Infrastructure/ # EF Core, services, options, auth, SMTP
│   │   └── OpenQuiz.Api/          # controllers, SignalR hub, middleware
│   ├── tests/OpenQuiz.Api.Tests/  # integration tests over the real API + PostgreSQL
│   └── Dockerfile
├── frontend/                      # React app
│   ├── src/
│   │   ├── services/              # apiClient, *Service, realtimeService
│   │   ├── hooks/                 # useAuth
│   │   ├── components/            # screens (incl. wordcloud/*)
│   │   └── config/                # constants (enum maps, CONTENT_TYPES)
│   ├── Dockerfile
│   └── nginx.conf
├── deploy/Caddyfile               # TLS edge (compose profile "proxy")
├── scripts/                       # deploy.sh, backup.sh, restore.sh
├── docs/
│   ├── DEPLOYMENT.md              # production runbook (Turkish)
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── SELF_HOSTING.md
├── .github/workflows/ci.yml       # backend build + test, frontend lint + test + build
├── docker-compose.yml
├── .env.example
├── CONTRIBUTING.md
├── SECURITY.md
├── MIGRATION_PLAN.md              # the full plan that drove this rewrite
└── README.md
```

## Local development (no Docker)

### Database

```bash
docker run -d --name openquiz-postgres \
  -e POSTGRES_DB=openquiz -e POSTGRES_USER=openquiz -e POSTGRES_PASSWORD=openquiz \
  -p 5432:5432 \
  postgres:17-alpine
```

### Backend

```bash
cd backend
dotnet build OpenQuiz.slnx
dotnet run --project src/OpenQuiz.Api
# API on http://localhost:5142 (or http://localhost:5080 if ASPNETCORE_URLS is set)
# OpenAPI doc at /openapi/v1.json
```

Update `backend/src/OpenQuiz.Api/appsettings.json` (or override with env vars) to set
`ConnectionStrings:Default`, `Jwt:SigningKey`, `Google:ClientId`.

### Frontend

```bash
cd frontend
cp .env.example .env       # set VITE_API_BASE_URL + VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
# Vite dev server on http://localhost:5173
```

## Tests

```bash
dotnet test backend/tests/OpenQuiz.Api.Tests/OpenQuiz.Api.Tests.csproj   # API against a real PostgreSQL
cd frontend && npm test                                                  # Vitest + React Testing Library
```

The backend suite starts its own PostgreSQL through Testcontainers; set
`OPENQUIZ_TEST_DB` to reuse a server you already have. Both suites, plus lint
and both builds, run on every pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- 📐 [Architecture](docs/ARCHITECTURE.md)
- 🛣️ [API reference](docs/API.md)
- 🛠️ [Self-hosting guide](docs/SELF_HOSTING.md)
- 📋 [Migration plan](MIGRATION_PLAN.md)

## License

MIT. Issues and PRs welcome.
