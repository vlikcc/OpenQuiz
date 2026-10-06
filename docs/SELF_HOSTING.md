# Self-Hosting OpenQuiz

A complete OpenQuiz stack (PostgreSQL + .NET API + React web) starts from a single
`docker compose up`. Everything in this guide assumes Docker 24+ with the Compose plugin.

> **Putting it on the internet?** Follow [DEPLOYMENT.md](DEPLOYMENT.md) (Turkish):
> it adds the bundled Caddy for automatic HTTPS, `scripts/deploy.sh` (refuses to
> start with placeholder secrets) and scheduled backups. This page covers the
> stack itself.

## 1. Prerequisites

- Docker Engine 24+ and `docker compose`
- A Google OAuth 2.0 **Web** client ID (only thing keeping a Google dependency — for Sign-In).
- (Optional) An SMTP relay for password reset e-mails.

## 2. Configure

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SIGNING_KEY, GOOGLE_CLIENT_ID, ADMIN_EMAIL …
```

Generate the secrets:

```bash
openssl rand -hex 24                   # POSTGRES_PASSWORD
openssl rand -base64 64 | tr -d '\n'   # JWT_SIGNING_KEY
```

### Google Sign-In setup

1. https://console.cloud.google.com/apis/credentials → **Create credentials** → **OAuth client ID** → **Web application**
2. **Authorized JavaScript origins**: add your `PUBLIC_URL` (e.g. `http://localhost:8080`)
3. No redirect URIs are required — the frontend uses the One Tap / ID token flow.
4. Copy the client ID to `GOOGLE_CLIENT_ID` in `.env`.

> **No other Google service is used.** No Firebase, no Firestore, no FCM, no Hosting.

## 3. Run

```bash
docker compose up -d --build
```

Three containers come up (four with `COMPOSE_PROFILES=proxy`):

| Service | Default port | Notes |
|---|---|---|
| `db` (PostgreSQL 17) | `127.0.0.1:5432` | data persisted in `pg-data` volume |
| `api` (.NET 10 / Kestrel) | `127.0.0.1:5080` | applies EF migrations on boot, logs to `api-logs` volume |
| `web` (nginx + React build) | `8080` | SPA served from `/usr/share/nginx/html` |
| `caddy` (profile `proxy`) | `80`, `443` | TLS via Let's Encrypt for `DOMAIN` |

`db` and `api` are published on loopback only (`POSTGRES_BIND`, `API_BIND`);
the browser reaches the API through `web` (or Caddy).

Open the app at `http://localhost:8080`.

`api`, `web` and `db` run as non-root (`app`, `nginx`, `postgres`), start with
`no-new-privileges`, restart `unless-stopped`, and carry a healthcheck. `web`
additionally runs with a read-only root filesystem. The `api` container waits
for `db` to report healthy, and `web` waits for `api`, so the first request
after `up` never lands on a half-started stack.

CPU and memory ceilings come from `.env` (`API_MEMORY_LIMIT`, `DB_CPU_LIMIT`,
…). The whole stack fits in 2 GB of RAM and runs on x86_64 and ARM64.

## 4. First admin

Set `ADMIN_EMAIL` in `.env` **before first login**. When that e-mail logs in (Google or email/password), the user is auto-elevated to admin and granted `CanCreate`.

After that, the admin can authorize other users via **Admin Paneli → Yetkili Kullanıcılar**.

## 5. Common operations

```bash
# follow logs
docker compose logs -f api
docker compose logs -f web

# rebuild after pulling new code
docker compose up -d --build

# wipe & restart (DESTRUCTIVE — drops all data)
docker compose down -v
```

### Health probes

| Endpoint | Answers | Use it for |
|---|---|---|
| `/health/live` | Is the process running? Never touches the database. | Restart / liveness probes |
| `/health/ready` | Can this instance serve traffic? Opens a database connection. | Load-balancer and startup gates |
| `/health` | Same as `/health/ready`. | Existing probes |

Keep liveness off the database. A probe that fails during a database outage
restarts every API instance in a loop, which turns a recoverable outage into a
total one.

### Logs

The API writes to stdout (`docker compose logs -f api`) *and* to a daily
rolling file under `/app/logs`, mounted as the `api-logs` volume so it survives
a container restart. Files roll at 50 MB and the last 14 are kept.

```bash
# read the current file
docker compose exec api sh -c 'tail -f /app/logs/openquiz-*.log'

# copy the whole history out
docker compose cp api:/app/logs ./api-logs
```

Health probes log at Debug so they do not drown the requests you are looking
for. Raise `Serilog__MinimumLevel__Default=Debug` to see them.

Question images are stored on disk at `/app/data/media` and mounted as the
`api-media` volume so they survive a container recreate. The API's
`SessionScheduler` hosted service mails a reminder 15 minutes before a
scheduled start (skipped when SMTP is not configured) and then activates the
session as the creator.

## 6. Rate limiting

Anonymous endpoints are rate limited per caller. Signed-in callers get a bucket keyed on
their user id, everyone else is bucketed by IP address. Defaults live under `RateLimiting`
in `appsettings.json` and can be overridden with environment variables:

| Policy | Endpoints | Default |
|---|---|---|
| `Auth` | register, login, refresh, Google sign-in, password reset | 10 / minute |
| `Participation` | poll fetch, join, votes, open answers, word cloud, aggregates | 240 / minute |
| `Reactions` | emoji reactions | 300 / minute |

```bash
RateLimiting__Participation__PermitLimit=480
RateLimiting__Participation__WindowSeconds=60
```

A whole room usually shares one NAT address, so the participation budget is per venue
rather than per person — raise it for large audiences.

Behind a reverse proxy, set `RateLimiting__TrustForwardedHeaders=true` so the API buckets
on `X-Forwarded-For` instead of the proxy address. **Only enable this when the API is
unreachable except through the proxy**, otherwise a client can forge the header and mint
itself a fresh quota. The bundled Compose file keeps the `5080` mapping on loopback, and
`TRUST_FORWARDED_HEADERS` / `FORWARD_LIMIT` in `.env` set this for you: `FORWARD_LIMIT=1` when
the proxy sends `/api` straight to the API (the bundled Caddy does), `2` when it forwards
everything to the `web` container, whose nginx adds a hop of its own.

## 7. Running more than one API instance

SignalR keeps its groups in the memory of the process that owns the connection.
With a single `api` container that is fine. Add a second and the room splits:
a participant connected to instance A never hears an event published by
instance B, so their question never advances.

Point both instances at one Redis to fan the events out:

```bash
Realtime__RedisConnectionString=redis:6379
Realtime__ChannelPrefix=openquiz   # only matters if several deployments share a Redis
```

```yaml
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    restart: unless-stopped
```

Nothing is persisted in Redis — it carries live events only, so it can be
restarted and needs no volume. The API logs which mode it is in at startup:

```
SignalR is using the Redis backplane; this instance can be one of several.
SignalR is running without a backplane. Run a single API instance, or set Realtime:RedisConnectionString.
```

Vote-count and word-cloud broadcasts are coalesced per process, so N instances
can emit up to N batches per window instead of one. That trades a little extra
traffic for correctness and needs no configuration.

## 8. Metrics and traces

Instrumentation is registered only when there is somewhere to send it, so the
default deployment pays nothing for it.

```bash
# Prometheus scrape endpoint on the API port
PROMETHEUS_ENABLED=true      # exposes http://api:8080/metrics

# or push to an OpenTelemetry collector (metrics + traces)
OTLP_ENDPOINT=http://otel-collector:4317
```

Both can be on at once. What you get: ASP.NET Core request duration and count
by route and status, `HttpClient` call timings, and .NET runtime counters (GC,
thread pool, exceptions).

`/metrics` has no authentication. It exposes route names and status-code
distributions, which is not a secret but is not something to publish either —
leave the `5080` mapping bound to localhost, or scrape it over the Compose
network only.

## 9. Backing up the database

Everything durable lives in two volumes: `pg-data` (the database) and
`api-media` (uploaded question images). `scripts/backup.sh` captures both
while the stack keeps serving:

```bash
./scripts/backup.sh
# backups/openquiz-db-<utc>.dump     pg_dump custom format, verified after writing
# backups/openquiz-media-<utc>.tgz   question images
```

It prunes files older than `BACKUP_RETENTION_DAYS` (default 14). Schedule it
with cron and copy `BACKUP_DIR` off the machine; see
[DEPLOYMENT.md](DEPLOYMENT.md#5-yedekleme).

```bash
# Restore (stops the API, replaces the database in one transaction, restarts)
./scripts/restore.sh backups/openquiz-db-<utc>.dump backups/openquiz-media-<utc>.tgz
```

The same by hand:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > openquiz.dump
docker compose stop api
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < openquiz.dump
docker compose start api
```

The API applies any pending EF migrations on the next boot, so restoring an
older backup into a newer build is safe.

**Restore into a throwaway stack once before you need it** (`ENV_FILE=… ./scripts/restore.sh`).
An untested backup is not a backup.

## 10. Customizing

- **Domain / TLS** — set `COMPOSE_PROFILES=proxy` and `DOMAIN` to use the bundled Caddy,
  or put your own nginx/Traefik in front (see [DEPLOYMENT.md](DEPLOYMENT.md#8-kendi-reverse-proxynizle-caddy-olmadan)).
- **External DB** — drop the `db` service and point `ConnectionStrings__Default` at your
  managed PostgreSQL 15+ (`Host=…;Database=…;Username=…;Password=…`). The server must be
  built with ICU (all mainstream packages and managed services are).
- **Disable email** — leave `SMTP_HOST` blank. Password-reset endpoint then returns 503.
- **API on another origin** — the bundled `web` container proxies `/api` and `/hubs`, so
  the shipped Content-Security-Policy only allows `connect-src 'self'`. If you point
  `VITE_API_BASE_URL` at a different host, add that origin to `connect-src` in
  `frontend/security-headers.conf` and rebuild `web`, or the browser blocks every call.

## 11. Troubleshooting

- `api` logs *password authentication failed* → `POSTGRES_PASSWORD` changed after the first
  start. PostgreSQL only reads it when the volume is created; change it in the database
  (`ALTER USER openquiz PASSWORD '…'`) or restore the old value.
- `api` logs *Database not ready yet…* — normal for a few seconds on first start.
- `Google ile giriş başarısız` — your `GOOGLE_CLIENT_ID` doesn't list the current origin
  in **Authorized JavaScript origins**.
- `SMTP is not configured on this server` (503) — expected when `SMTP_HOST` is blank.
- Blank page and `Refused to connect …` in the browser console — the Content-Security-Policy
  in `frontend/security-headers.conf` does not list the origin you moved the API to. See
  **Customizing** above.
