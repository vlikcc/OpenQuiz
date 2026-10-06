# Contributing

Thanks for helping out. This guide covers getting the project running, the
checks CI enforces, and the conventions the codebase follows.

## Getting set up

You need the .NET 10 SDK, Node 22, and Docker (for PostgreSQL and for the
backend test suite).

```bash
# Database
docker run -d --name openquiz-postgres \
  -e POSTGRES_DB=openquiz -e POSTGRES_USER=openquiz -e POSTGRES_PASSWORD=openquiz \
  -p 5432:5432 \
  postgres:17-alpine

# Backend
cd backend && dotnet run --project src/OpenQuiz.Api

# Frontend
cd frontend && npm install && npm run dev
```

The API applies pending migrations on startup, so an empty database is fine.
See [README.md](README.md) and [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for
the full picture.

Installing the frontend needs network access to `cdn.sheetjs.com`, which hosts
the only patched `xlsx` build. [SECURITY.md](SECURITY.md) explains why.

## Running the checks

CI runs exactly these, so run them before pushing.

```bash
dotnet build backend/OpenQuiz.slnx
dotnet test backend/tests/OpenQuiz.Api.Tests/OpenQuiz.Api.Tests.csproj

cd frontend
npm run lint
npm test
npm run build
```

### Backend tests

The suite boots the real API with `WebApplicationFactory` and talks to a real
PostgreSQL, so it catches the authorization and redaction rules that a mocked
`DbContext` would not.

By default it starts a throwaway PostgreSQL through Testcontainers. If Docker
is unavailable, or you would rather reuse a server you already have running,
point the suite at it:

```bash
export OPENQUIZ_TEST_DB='Host=localhost;Port=5432;Username=openquiz;Password=openquiz'
dotnet test backend/tests/OpenQuiz.Api.Tests/OpenQuiz.Api.Tests.csproj
```

The suite creates and drops its own `openquiz_tests` database on that server, so
do not point it at anything you care about.

### Frontend tests

Vitest with React Testing Library, in jsdom. Tests live next to the code they
cover as `*.test.js` / `*.test.jsx`. `npm run test:watch` reruns on change.

## Conventions

- **Migrations.** Any change to an entity or an EF configuration needs a
  migration: `dotnet ef migrations add <Name> --project
  backend/src/OpenQuiz.Infrastructure --startup-project backend/src/OpenQuiz.Api`.
  If the change tightens a constraint, backfill and deduplicate existing rows in
  the migration so it can be applied to a live database.
- **Tailwind classes must be literals.** The JIT compiler only emits classes it
  can find written out in full, so `` `bg-${color}-600` `` renders unstyled in a
  production build. Per-type colours belong in the `TYPE_CLASSES` map in
  `src/config/constants.js`. A test enforces this.
- **Configuration.** New settings go in `appsettings.json` with a safe default,
  get a strongly typed options class, and are documented in
  `docs/SELF_HOSTING.md` together with their environment variable form.
- **Answer redaction.** Anything that returns or broadcasts a `PollDto` has to
  go through `PollService`, which strips the answer key for everyone except the
  owner, an admin, or a finished poll.
- **Commit messages.** `type(scope): summary in the imperative mood`, for
  example `fix(web): keep the voter question index in a ref`. Keep one logical
  change per commit.

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
