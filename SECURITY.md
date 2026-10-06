# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository instead.

Include the affected version or commit, what an attacker can achieve, and the
steps to reproduce it. A proof of concept against a local `docker compose up`
deployment is the most useful form.

Expect an acknowledgement within a few days and a fix or a mitigation plan
before any public disclosure.

## Supported versions

OpenQuiz is distributed as source you deploy yourself. Only `main` receives
fixes; there are no long-lived release branches.

## Deployment expectations

The threat model assumes the operator has done the following. Reports that
depend on skipping them will be closed as configuration issues.

- `Jwt:SigningKey` is set to a random secret of at least 32 bytes. The server
  refuses to start without one outside Development.
- The database and API ports are not published to untrusted networks. The
  Compose file exposes them for local development convenience.
- TLS terminates in front of the frontend container, and
  `RateLimiting:TrustForwardedHeaders` is enabled only when that proxy is the
  single entry point. See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).
- `App:AdminEmail` names an account you control, since it is granted admin on
  first sign-in.

## What the application already guards

- Poll answer keys are withheld from participants until the poll ends, both in
  the REST response and in the SignalR broadcast.
- Anonymous and signed-in votes are deduplicated per question, and answers are
  only accepted for the question a live poll is currently on.
- Confirming a password reset revokes every refresh token for that account and
  invalidates the other pending reset links.
- Anonymous endpoints (authentication, joining, voting, word cloud, reactions)
  are rate limited per IP address, and per account once signed in.

Regressions in any of the above are security bugs. They are covered by
`backend/tests/OpenQuiz.Api.Tests`.

## Dependencies

`npm audit` and `dotnet list package --vulnerable` are expected to report
nothing. Dependabot opens updates weekly; see
[.github/dependabot.yml](.github/dependabot.yml).

`xlsx` is installed from `https://cdn.sheetjs.com`, not from npm. SheetJS
stopped publishing to npm at 0.18.5, which is still affected by the prototype
pollution and ReDoS advisories, so the registry version can never go green.
Keep the CDN URL when bumping it.

## Known gaps

- The SignalR hub accepts anonymous connections, so anyone who knows a poll id
  can observe its (redacted) events.
- There is no audit log of administrative actions.
