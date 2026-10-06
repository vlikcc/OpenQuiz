## What changed

<!-- Describe the change and why it is needed. Link the issue it closes. -->

## How it was tested

<!-- Commands you ran, tests you added, scenarios you clicked through. -->

- [ ] `dotnet test backend/tests/OpenQuiz.Api.Tests/OpenQuiz.Api.Tests.csproj`
- [ ] `npm run lint && npm test && npm run build` (in `frontend/`)

## Checklist

- [ ] Behaviour changes are covered by a new or updated test
- [ ] New configuration keys are documented in `docs/SELF_HOSTING.md`
- [ ] Schema changes ship with an EF Core migration
- [ ] Nothing here weakens authentication, authorization, or answer redaction
