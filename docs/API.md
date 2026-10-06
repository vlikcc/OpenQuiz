# OpenQuiz API reference

Base URL: `http://<host>:5080` (default Docker mapping).
OpenAPI document: `GET /openapi/v1.json` (Development env).
Errors follow RFC 7807 (`application/problem+json`).

All `Authorization: Bearer <accessToken>` headers must use the JWT returned by `/api/auth/*`.
Refresh tokens rotate on every `/api/auth/refresh` call.

## Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/google` | — | `{ idToken }` → tokens |
| POST | `/api/auth/register` | — | `{ email, password, displayName? }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| POST | `/api/auth/refresh` | — | `{ refreshToken }` |
| POST | `/api/auth/logout` | — | `{ refreshToken }` |
| GET | `/api/auth/me` | bearer | Current user |
| POST | `/api/auth/password-reset/request` | — | `{ email }`; 503 if SMTP unset |
| POST | `/api/auth/password-reset/confirm` | — | `{ token, newPassword }` |

The reset e-mail points the browser at `{PublicUrl}/reset-password?token=…`.
The SPA consumes that path; there is no separate static page.

`AuthResponse` shape:
```json
{
  "accessToken": "eyJ…",
  "refreshToken": "…",
  "accessTokenExpiresAt": "2026-05-20T20:00:00Z",
  "refreshTokenExpiresAt": "2026-06-19T20:00:00Z",
  "user": { "id": "…", "email": "…", "displayName": "…", "isAdmin": false, "canCreate": false }
}
```

## Paging

`GET /api/polls`, `GET /api/polls/{id}/votes` and `GET /api/polls/{id}/open-answers`
are paged. They accept `?page=` (1-based, default 1) and `?pageSize=`
(default 20, capped at 200) and answer with:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 137,
  "hasMore": true
}
```

Out-of-range values are clamped rather than rejected, so `pageSize=100000`
returns 200 rows and `page=0` returns the first page.

## Polls

| Method | Path | Auth |
|---|---|---|
| GET | `/api/polls` | bearer (own; admin sees all) — paged summaries |
| GET | `/api/polls/{id}` | — |
| POST | `/api/polls` | bearer + `canCreate` |
| PUT | `/api/polls/{id}` | bearer (owner/admin) |
| POST | `/api/polls/{id}/duplicate` | bearer (owner/admin) + `canCreate` — `{ title? }` |
| DELETE | `/api/polls/{id}` | bearer (owner/admin) |
| POST | `/api/polls/{id}/activate` | bearer (owner/admin) |
| POST | `/api/polls/{id}/next-question` | bearer (owner/admin) |
| POST | `/api/polls/{id}/prev-question` | bearer (owner/admin) |
| POST | `/api/polls/{id}/end` | bearer (owner/admin) |
| POST | `/api/polls/{id}/join` | — | `{ userName }` |

The list returns summaries (`PollSummaryDto`: the poll's own fields plus
`questionCount`) rather than the full `PollDto`. Fetch `/api/polls/{id}` for the
questions and options.

`duplicate` returns a new poll that owns copies of every question and option,
belongs to the caller, and is back in `Waiting` with no participants or answers —
a poll holds one session's worth of answers, so running the same material again
needs a fresh one. `title` is optional; the server appends a suffix when it is
omitted.

`PollType` enum: `1=Contest 2=Survey 3=Quiz 4=Exam 5=WordCloud`.
`PollStatus`: `1=Waiting 2=Live 3=Ended`. `QuestionType`: `1=MultipleChoice 2=Open 3=WordCloud`.

## Votes

| Method | Path | Auth |
|---|---|---|
| POST | `/api/polls/{id}/votes` | — | `{ questionIndex, selectedIndices[], responseTimeMs?, userName }` |
| POST | `/api/polls/{id}/open-answers` | — | `{ questionIndex, answerText, userName }` |
| GET | `/api/polls/{id}/votes` | bearer (owner/admin) — paged |
| GET | `/api/polls/{id}/open-answers` | bearer (owner/admin) — paged |
| PUT | `/api/polls/{id}/open-answers/{answerId}/score` | bearer (owner/admin) — `{ score }` |

Grading a written answer moves the difference onto the poll's leaderboard, so a
corrected grade replaces the earlier one and `{ "score": null }` takes the points
back. A grade above the question's `points` is a `400`.
| GET | `/api/polls/{id}/aggregates` | — | Per-question option counts |

## Word Cloud

| Method | Path | Auth |
|---|---|---|
| POST | `/api/polls/{id}/wordcloud/submit` | — | `{ questionIndex, terms[], userName }` |
| GET | `/api/polls/{id}/wordcloud/{questionIndex}?topN=` | — | `topN` defaults to the question's own setting |

Terms are normalized server-side (lowercase, trim, regex filter) and de-duplicated.

### Moderation

Each word cloud question carries its own moderation as JSON in
`question.wordCloudConfig`. Every field is optional and an unreadable config
falls back to the defaults rather than failing a live submission.

```json
{
  "maxWordsPerUser": 3,
  "minTermLength": 2,
  "maxTermLength": 64,
  "blacklist": ["spam"],
  "topN": 50,
  "allowDuplicatesFromSameUser": false,
  "profanityFilter": true
}
```

- `blacklist` and the built-in profanity list are applied to submissions *and* to
  what `GET` returns, so blocking a word mid-session also clears it from the wall.
- A submission whose every term is blocked is a `400`; one whose every term the
  same participant already sent is a `409`.
- `maxWordsPerUser` is only consulted when the question has no `maxWords`.

## Scores & Users

- `GET /api/scores?pollId=…&top=100` — leaderboard
- `GET /api/users/authorized` — admin
- `POST /api/users/authorized` — admin (`{ email }`)
- `DELETE /api/users/authorized/{email}` — admin
- `GET /api/users/registered` — admin

## Reactions

- `POST /api/polls/{id}/reactions` — `{ emoji, sender }`. Broadcasts via SignalR only.

## SignalR Hub: `/hubs/poll`

Client → server: `JoinPoll(pollId)`, `LeavePoll(pollId)`.
Authenticate via `?access_token=…` query string or `Authorization` header (Bearer).

Server → client events:

| Event | Payload |
|---|---|
| `PollUpdated` | full `PollDto` |
| `VoteCountsUpdated` | `{ questionIndex, questionId, totalRespondents, optionCounts }` (throttled 250 ms) |
| `WordCloudUpdated` | `{ questionIndex, terms: [{ term, count }] }` (throttled 250 ms) |
| `OpenAnswerSubmitted` | `{ questionIndex, userName }` |
| `ReactionBurst` | `{ emoji, sender, at }` |
| `LeaderboardUpdated` | `{ entries: [{ userName, points, totalTimeMs }] }` — top 10, after any answer or grade that moves points (throttled 250 ms) |
