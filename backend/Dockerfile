FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Only the API's own project graph: .dockerignore keeps the test project out of
# the build context, so restoring the whole solution cannot work here.
COPY src/OpenQuiz.Domain/OpenQuiz.Domain.csproj src/OpenQuiz.Domain/
COPY src/OpenQuiz.Application/OpenQuiz.Application.csproj src/OpenQuiz.Application/
COPY src/OpenQuiz.Infrastructure/OpenQuiz.Infrastructure.csproj src/OpenQuiz.Infrastructure/
COPY src/OpenQuiz.Api/OpenQuiz.Api.csproj src/OpenQuiz.Api/
RUN dotnet restore src/OpenQuiz.Api/OpenQuiz.Api.csproj

COPY . .
RUN dotnet publish src/OpenQuiz.Api/OpenQuiz.Api.csproj -c Release -o /app /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# The container healthcheck needs an HTTP client; the runtime image ships none.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app .

# Serilog rolls its files here. The directory has to exist and belong to the
# non-root user before the app starts, and it is a mount point in compose so
# the logs outlive the container.
RUN mkdir -p /app/logs /app/data/media && chown -R $APP_UID:$APP_UID /app/logs /app/data

USER $APP_UID

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Readiness, not liveness: compose uses this to hold the web tier back until
# the API can actually reach the database.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=10 \
    CMD curl -fsS http://localhost:8080/health/ready || exit 1

ENTRYPOINT ["dotnet", "OpenQuiz.Api.dll"]
