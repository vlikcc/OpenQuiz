# Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  React 19 SPA (Vite build → nginx)                               │
│  ├─ fetch wrapper (apiClient) — JWT, auto-refresh on 401         │
│  ├─ @microsoft/signalr — single HubConnection, auto-reconnect    │
│  ├─ @react-oauth/google — One Tap / ID token credential          │
│  └─ d3-cloud — word cloud rendering                              │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │  HTTPS / WSS
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  ASP.NET Core 10  (Kestrel)                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ OpenQuiz.Api                                                │  │
│  │  Controllers (Auth/Polls/Votes/Scores/Users/WordCloud/      │  │
│  │  Reactions/Info) + PollHub (SignalR)                        │  │
│  │  ExceptionHandlingMiddleware → ProblemDetails               │  │
│  │  RealtimeThrottle (per-key coalescing, 250 ms)              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ OpenQuiz.Application                                        │  │
│  │  DTOs, FluentValidation, IAuthService / IPollService /      │  │
│  │  IVoteService / IWordCloudService / IScoreService /         │  │
│  │  IUserService / IReactionService / IRealtimeNotifier /      │  │
│  │  IEmailSender / ITokenService / IGoogleTokenVerifier /      │  │
│  │  IPasswordHasher / ICurrentUser                             │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ OpenQuiz.Infrastructure                                     │  │
│  │  Services (Auth, Poll, Vote, WordCloud, Score, User,        │  │
│  │  Reaction), JwtTokenService, GoogleTokenVerifier,           │  │
│  │  BcryptPasswordHasher, MailKitEmailSender,                  │  │
│  │  EF Core 10 OpenQuizDbContext + Migrations                  │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ OpenQuiz.Domain                                             │  │
│  │  Entities + Enums (no dependencies)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │  Npgsql (TCP 5432)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL 17                                                   │
│  Users, RefreshTokens, PasswordResetTokens, Polls, Questions,    │
│  Options, Votes, OpenAnswers, WordCloudSubmissions,              │
│  WordCloudAggregates, Scores, Reactions                          │
└──────────────────────────────────────────────────────────────────┘
```

## Layering rules

- `Domain` ← nothing
- `Application` ← `Domain`
- `Infrastructure` ← `Application`, `Domain`
- `Api` ← all three

Application defines abstractions (interfaces), Infrastructure implements them; the Api
layer composes the whole graph in `Program.cs`.

## Auth flow

1. **Google**: frontend obtains ID token via `@react-oauth/google` → `POST /api/auth/google`.
   Server validates with `Google.Apis.Auth.GoogleJsonWebSignature.ValidateAsync` (audience =
   `Google:ClientId`). Matches user by `GoogleSub`, falls back to `Email`, creates one if
   neither exists. Issues access JWT (15 m default) + opaque refresh token (30 d, SHA-256
   hashed at rest, rotated on each refresh).
2. **Email/password**: BCrypt (12 rounds) via `BCrypt.Net-Next`.
3. **JWT** carries `sub`, `email`, `name`, `isAdmin`, `canCreate`, `jti`. SignalR accepts the
   same JWT via the `access_token` query string (handshake limitation).

## Real-time

- `IRealtimeNotifier` lives in Application; Api implements it with `SignalRRealtimeNotifier`
  wrapping `IHubContext<PollHub>`.
- High-frequency events (`VoteCountsUpdated`, `WordCloudUpdated`) pass through
  `RealtimeThrottle`: at most one delivery per key per 250 ms; latest payload wins.
- Frontend `realtimeService` keeps a single `HubConnection` per browser tab and exposes a
  `subscribe(pollId, handlers)` API; per-poll groups are added with `JoinPoll`.

## Word cloud

- Submit endpoint normalizes terms (lowercase, trim, regex `[\p{L}\p{N}…]`, max length 64).
- `WordCloudAggregates` is denormalized for fast lookups (`UNIQUE (QuestionId, Term)`); each
  submit issues `INSERT WordCloudSubmissions` + `INSERT-or-UPDATE WordCloudAggregates`.
- Presenter pulls top-N (default 50) via REST initially, then receives live deltas on
  `WordCloudUpdated`.

## Database

EF Core 10 on PostgreSQL 17 (`Npgsql.EntityFrameworkCore.PostgreSQL`).
Participant names and e-mail addresses use a case-insensitive ICU collation
(`case_insensitive`), so "Ali" and "ali" are one participant. Optimistic
concurrency on `Polls` and `BillingAccounts` uses PostgreSQL's `xmin`, and all
timestamps are `timestamptz` in UTC.
Migrations live in `OpenQuiz.Infrastructure/Persistence/Migrations/`. On startup, the API
applies pending migrations automatically (gated by `App:AutoMigrate`, default `true`).
