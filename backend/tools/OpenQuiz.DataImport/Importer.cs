using Google.Cloud.Firestore;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Domain.Enums;
using OpenQuiz.Infrastructure.Persistence;
using System.Text.Json;

namespace OpenQuiz.DataImport;

public record ImportResult(int Imported, int Skipped, int Errors)
{
    public int Total => Imported + Skipped + Errors;
}

public class Importer
{
    private readonly FirestoreDb _firestore;
    private readonly OpenQuizDbContext _db;
    private readonly string _root;
    private const int BatchSize = 100;

    /// <summary>
    /// Standings rebuilt from the votes while they are imported, per SQL poll
    /// id and participant. Only used for polls whose Firestore copy predates the
    /// per-poll <c>scores</c> subcollection (June 2026); before that the web app
    /// kept a single global table keyed by name, which mixed every contest.
    /// </summary>
    private readonly Dictionary<Guid, Dictionary<string, (int Points, long TimeMs)>> _derivedScores = [];

    public Importer(FirestoreDb firestore, OpenQuizDbContext db, string rootPath)
    {
        _firestore = firestore; _db = db; _root = rootPath;
    }

    public async Task<(Dictionary<string, Guid> map, ImportResult result)> ImportUsersAsync(bool dryRun, Action<string>? onProgress = null)
    {
        var emailToId = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        int imported = 0, skipped = 0, errors = 0;
        int pending = 0;

        // authorizedUsers: doc id = email, fields { canCreate, addedAt, addedBy }
        onProgress?.Invoke("Reading authorizedUsers...");
        var authSnap = await _firestore.Collection($"{_root}/authorizedUsers").GetSnapshotAsync();
        foreach (var doc in authSnap.Documents)
        {
            try
            {
                var email = doc.Id.Trim().ToLowerInvariant();
                if (!email.Contains('@')) { skipped++; continue; }
                var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
                if (existing is null)
                {
                    existing = new User
                    {
                        Email = email,
                        CanCreate = TryGetBool(doc, "canCreate") ?? true,
                        CreatedAt = TryGetTimestamp(doc, "addedAt") ?? DateTime.UtcNow,
                    };
                    if (!dryRun) { _db.Users.Add(existing); pending++; }
                    imported++;
                }
                else
                {
                    if (!existing.CanCreate) existing.CanCreate = true;
                    skipped++;
                }
                emailToId[email] = existing.Id;

                if (!dryRun && pending >= BatchSize) { await _db.SaveChangesAsync(); pending = 0; }
            }
            catch (Exception ex)
            {
                errors++;
                onProgress?.Invoke($"  ⚠ authorizedUser '{doc.Id}' skipped: {ex.Message}");
            }
        }

        // registeredUsers: doc id = uid, fields { email, displayName, createdAt, authProvider, uid }
        onProgress?.Invoke("Reading registeredUsers...");
        var regSnap = await _firestore.Collection($"{_root}/registeredUsers").GetSnapshotAsync();
        foreach (var doc in regSnap.Documents)
        {
            try
            {
                var email = (TryGetString(doc, "email") ?? string.Empty).Trim().ToLowerInvariant();
                if (string.IsNullOrEmpty(email) || !email.Contains('@')) { skipped++; continue; }

                var displayName = TryGetString(doc, "displayName");
                var createdAt = TryGetTimestamp(doc, "createdAt") ?? DateTime.UtcNow;
                var provider = TryGetString(doc, "authProvider");

                var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
                if (existing is null)
                {
                    existing = new User
                    {
                        Email = email,
                        DisplayName = displayName,
                        CreatedAt = createdAt,
                    };
                    if (provider == "google") existing.GoogleSub = doc.Id;
                    if (!dryRun) { _db.Users.Add(existing); pending++; }
                    imported++;
                }
                else
                {
                    existing.DisplayName ??= displayName;
                    if (provider == "google") existing.GoogleSub ??= doc.Id;
                    skipped++;
                }
                emailToId[email] = existing.Id;

                if (!dryRun && pending >= BatchSize) { await _db.SaveChangesAsync(); pending = 0; }
            }
            catch (Exception ex)
            {
                errors++;
                onProgress?.Invoke($"  ⚠ registeredUser '{doc.Id}' skipped: {ex.Message}");
            }
        }

        if (!dryRun && pending > 0) await _db.SaveChangesAsync();
        return (emailToId, new ImportResult(imported, skipped, errors));
    }

    public async Task<(Dictionary<string, Guid> map, ImportResult result)> ImportPollsAsync(
        Dictionary<string, Guid> userByEmail, bool dryRun, Action<string>? onProgress = null)
    {
        var pollMap = new Dictionary<string, Guid>();
        int imported = 0, skipped = 0, errors = 0;
        int pending = 0;

        onProgress?.Invoke("Reading polls...");
        var snap = await _firestore.Collection($"{_root}/polls").GetSnapshotAsync();
        onProgress?.Invoke($"  Found {snap.Count} polls.");

        foreach (var doc in snap.Documents)
        {
            try
            {
                var creatorEmail = (TryGetString(doc, "creatorEmail") ?? string.Empty).Trim().ToLowerInvariant();
                Guid creatorId;
                if (!string.IsNullOrEmpty(creatorEmail) && userByEmail.TryGetValue(creatorEmail, out var cid))
                {
                    creatorId = cid;
                }
                else if (!string.IsNullOrEmpty(creatorEmail))
                {
                    // Create a stub user for orphan creator e-mails.
                    var stub = new User { Email = creatorEmail, CreatedAt = DateTime.UtcNow };
                    if (!dryRun) _db.Users.Add(stub);
                    creatorId = stub.Id;
                    userByEmail[creatorEmail] = creatorId;
                }
                else
                {
                    skipped++;
                    onProgress?.Invoke($"  ⚠ Poll '{doc.Id}' skipped: no creatorEmail");
                    continue;
                }

                // Idempotency: skip if already imported (check by title + creator)
                var title = TryGetString(doc, "title") ?? "(başlıksız)";
                var alreadyExists = await _db.Polls.AnyAsync(p => p.Title == title && p.CreatorId == creatorId);
                if (alreadyExists)
                {
                    // Still record the mapping for votes import
                    var existingPoll = await _db.Polls.FirstAsync(p => p.Title == title && p.CreatorId == creatorId);
                    pollMap[doc.Id] = existingPoll.Id;
                    skipped++;
                    continue;
                }

                var poll = new Poll
                {
                    Title = title,
                    Type = MapPollType(TryGetString(doc, "type")),
                    Status = MapPollStatus(TryGetString(doc, "status")),
                    CurrentQuestionIndex = (int?)TryGetLong(doc, "currentQuestionIndex") ?? 0,
                    ParticipantCount = (int?)TryGetLong(doc, "participantCount") ?? 0,
                    IsActive = TryGetBool(doc, "isActive") ?? false,
                    CreatorId = creatorId,
                    CreatedAt = TryGetTimestamp(doc, "createdAt") ?? DateTime.UtcNow,
                    UpdatedAt = TryGetTimestamp(doc, "updatedAt"),
                };

                // Questions array
                if (doc.ContainsField("questions"))
                {
                    var rawQuestions = doc.GetValue<List<object>>("questions");
                    for (var i = 0; i < rawQuestions.Count; i++)
                    {
                        if (rawQuestions[i] is not Dictionary<string, object> q) continue;
                        var question = new Question
                        {
                            OrderIndex = i,
                            Text = (q.GetValueOrDefault("text") as string) ?? string.Empty,
                            ImageUrl = q.GetValueOrDefault("image") as string,
                            TimeLimit = Convert.ToInt32(q.GetValueOrDefault("timeLimit") ?? 30L),
                            QuestionType = MapQuestionType(q.GetValueOrDefault("questionType") as string),
                            AllowMultiple = (bool?)q.GetValueOrDefault("allowMultiple") ?? false,
                            CorrectOptionIndex = q.ContainsKey("correctOptionIndex") ? Convert.ToInt32(q["correctOptionIndex"]) : null,
                            CorrectAnswer = q.GetValueOrDefault("correctAnswer") as string,
                            Points = Convert.ToInt32(q.GetValueOrDefault("points") ?? 10L),
                        };

                        if (q.GetValueOrDefault("options") is List<object> rawOpts)
                        {
                            for (var oi = 0; oi < rawOpts.Count; oi++)
                            {
                                string text;
                                if (rawOpts[oi] is Dictionary<string, object> optDict)
                                    text = (optDict.GetValueOrDefault("text") as string) ?? string.Empty;
                                else
                                    text = rawOpts[oi]?.ToString() ?? string.Empty;
                                question.Options.Add(new Option { OrderIndex = oi, Text = text });
                            }
                        }
                        poll.Questions.Add(question);
                    }
                }

                if (!dryRun) { _db.Polls.Add(poll); pending++; }
                pollMap[doc.Id] = poll.Id;
                imported++;

                if (!dryRun && pending >= BatchSize) { await _db.SaveChangesAsync(); pending = 0; }
            }
            catch (Exception ex)
            {
                errors++;
                onProgress?.Invoke($"  ⚠ Poll '{doc.Id}' skipped: {ex.Message}");
            }
        }

        if (!dryRun && pending > 0) await _db.SaveChangesAsync();
        return (pollMap, new ImportResult(imported, skipped, errors));
    }

    public async Task<ImportResult> ImportVotesAsync(
        Dictionary<string, Guid> pollMap, bool dryRun, Action<string>? onProgress = null)
    {
        int imported = 0, skipped = 0, errors = 0;

        foreach (var (firestorePollId, sqlPollId) in pollMap)
        {
            try
            {
                var votesSnap = await _firestore.Collection($"{_root}/polls/{firestorePollId}/votes").GetSnapshotAsync();
                if (votesSnap.Count == 0) continue;
                onProgress?.Invoke($"  Poll {firestorePollId}: {votesSnap.Count} votes");

                // Load poll's questions in order to map question index → SQL QuestionId.
                var questionIds = await _db.Questions
                    .Where(q => q.PollId == sqlPollId)
                    .OrderBy(q => q.OrderIndex)
                    .Select(q => new { q.Id, q.OrderIndex, q.QuestionType, q.Points })
                    .ToListAsync();

                // Rows already in SQL (a re-run) and rows queued in this run but
                // not saved yet: a database lookup alone misses the latter, and
                // a repeat inside one batch would sink the whole SaveChanges on
                // the (QuestionId, VoterKey) unique index.
                var seenVotes = (await _db.Votes.Where(v => v.PollId == sqlPollId)
                        .Select(v => new { v.QuestionId, v.VoterKey }).ToListAsync())
                    .Select(v => (v.QuestionId, v.VoterKey))
                    .ToHashSet();
                var seenAnswers = (await _db.OpenAnswers.Where(a => a.PollId == sqlPollId)
                        .Select(a => new { a.QuestionId, a.UserName }).ToListAsync())
                    .Select(a => (a.QuestionId, VoterKeyFor(a.UserName)))
                    .ToHashSet();
                var derived = _derivedScores[sqlPollId] = new(StringComparer.OrdinalIgnoreCase);

                int pending = 0;

                foreach (var doc in votesSnap.Documents)
                {
                    try
                    {
                        int qi = (int?)TryGetLong(doc, "qi") ?? (int?)TryGetLong(doc, "questionIndex") ?? -1;
                        if (qi < 0 || qi >= questionIds.Count) { skipped++; continue; }
                        var q = questionIds[qi];

                        var userName = TryGetString(doc, "un") ?? TryGetString(doc, "userName") ?? "anonymous";
                        var createdAt = TryGetTimestamp(doc, "ts") ?? TryGetTimestamp(doc, "timestamp") ?? DateTime.UtcNow;

                        if (q.QuestionType == QuestionType.Open)
                        {
                            var ansText = TryGetString(doc, "ans") ?? TryGetString(doc, "answer") ?? string.Empty;
                            if (!seenAnswers.Add((q.Id, VoterKeyFor(userName)))) { skipped++; continue; }

                            var entity = new OpenAnswer
                            {
                                PollId = sqlPollId,
                                QuestionId = q.Id,
                                UserName = userName,
                                AnswerText = ansText,
                                CreatedAt = createdAt,
                            };
                            if (!dryRun) { _db.OpenAnswers.Add(entity); pending++; }
                        }
                        else
                        {
                            var indices = new List<int>();
                            if (doc.ContainsField("ois") && doc.GetValue<object>("ois") is List<object> ois)
                                indices.AddRange(ois.Select(Convert.ToInt32));
                            else if (doc.ContainsField("oi") && doc.GetValue<object>("oi") is not null)
                                indices.Add(Convert.ToInt32(doc.GetValue<object>("oi")));

                            if (indices.Count == 0) { skipped++; continue; }

                            // Anonymous voters are keyed on their name, exactly as the
                            // API does for a live vote, so the unique index holds.
                            var voterKey = VoterKeyFor(userName);
                            if (!seenVotes.Add((q.Id, voterKey))) { skipped++; continue; }

                            var isCorrect = TryGetBool(doc, "c");
                            var responseMs = TryGetLong(doc, "rt");
                            var vote = new Vote
                            {
                                PollId = sqlPollId,
                                QuestionId = q.Id,
                                UserName = Truncate(userName.Trim(), 128),
                                VoterKey = voterKey,
                                SelectedOptionIndices = JsonSerializer.Serialize(indices),
                                IsCorrect = isCorrect,
                                ResponseTimeMs = responseMs is long ms ? (int)Math.Clamp(ms, 0, int.MaxValue) : null,
                                CreatedAt = createdAt,
                            };
                            if (!dryRun) { _db.Votes.Add(vote); pending++; }

                            // "pts" exists on votes written since June 2026;
                            // older ones only say whether the answer was right.
                            var points = (int?)TryGetLong(doc, "pts") ?? (isCorrect == true ? q.Points : 0);
                            if (points > 0)
                            {
                                var current = derived.GetValueOrDefault(vote.UserName);
                                derived[vote.UserName] = (current.Points + points, current.TimeMs + (responseMs ?? 0));
                            }
                        }

                        imported++;

                        if (!dryRun && pending >= BatchSize) { await _db.SaveChangesAsync(); pending = 0; }
                    }
                    catch (Exception ex)
                    {
                        errors++;
                        onProgress?.Invoke($"    ⚠ Vote '{doc.Id}' skipped: {ex.Message}");
                    }
                }

                if (!dryRun && pending > 0) await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                errors++;
                // Otherwise the rejected rows stay tracked and fail every later poll's save too.
                _db.ChangeTracker.Clear();
                onProgress?.Invoke($"  ⚠ Poll '{firestorePollId}' votes failed: {ex.Message}");
            }
        }
        return new ImportResult(imported, skipped, errors);
    }

    /// <summary>
    /// Per-poll standings: the Firestore <c>polls/{id}/scores</c> subcollection
    /// when the poll has one, otherwise the totals rebuilt from its votes.
    /// Must run after <see cref="ImportVotesAsync"/>.
    /// </summary>
    public async Task<ImportResult> ImportPollScoresAsync(
        Dictionary<string, Guid> pollMap, bool dryRun, Action<string>? onProgress = null)
    {
        int imported = 0, skipped = 0, errors = 0;

        foreach (var (firestorePollId, sqlPollId) in pollMap)
        {
            try
            {
                var existing = (await _db.Scores.Where(s => s.PollId == sqlPollId)
                        .Select(s => s.UserName).ToListAsync())
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var rows = new List<(string Name, int Points, long TimeMs)>();
                var snap = await _firestore.Collection($"{_root}/polls/{firestorePollId}/scores").GetSnapshotAsync();
                if (snap.Count > 0)
                {
                    foreach (var doc in snap.Documents)
                    {
                        var name = TryGetString(doc, "name") ?? doc.Id;
                        rows.Add((name, (int?)TryGetLong(doc, "score") ?? 0, TryGetLong(doc, "totalTime") ?? 0));
                    }
                }
                else if (_derivedScores.TryGetValue(sqlPollId, out var derived))
                {
                    rows.AddRange(derived.Select(d => (d.Key, d.Value.Points, d.Value.TimeMs)));
                }

                if (rows.Count == 0) continue;
                onProgress?.Invoke($"  Poll {firestorePollId}: {rows.Count} standings ({(snap.Count > 0 ? "Firestore" : "rebuilt from votes")})");

                foreach (var (name, points, timeMs) in rows)
                {
                    var userName = Truncate(name.Trim(), 128);
                    if (userName.Length == 0 || !existing.Add(userName)) { skipped++; continue; }
                    if (!dryRun)
                    {
                        _db.Scores.Add(new Score
                        {
                            PollId = sqlPollId,
                            UserName = userName,
                            Points = points,
                            TotalTimeMs = timeMs,
                            UpdatedAt = DateTime.UtcNow,
                        });
                    }
                    imported++;
                }

                if (!dryRun) await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                errors++;
                _db.ChangeTracker.Clear();
                onProgress?.Invoke($"  ⚠ Poll '{firestorePollId}' scores failed: {ex.Message}");
            }
        }

        return new ImportResult(imported, skipped, errors);
    }

    /// <summary>The legacy global leaderboard (<c>scores/{userName}</c>), kept as PollId = null.</summary>
    public async Task<ImportResult> ImportScoresAsync(bool dryRun, Action<string>? onProgress = null)
    {
        onProgress?.Invoke("Reading scores...");
        var snap = await _firestore.Collection($"{_root}/scores").GetSnapshotAsync();
        onProgress?.Invoke($"  Found {snap.Count} scores.");

        int imported = 0, skipped = 0, errors = 0;
        int pending = 0;

        foreach (var doc in snap.Documents)
        {
            try
            {
                var userName = doc.Id;
                var existing = await _db.Scores.FirstOrDefaultAsync(s => s.PollId == null && s.UserName == userName);
                if (existing is null)
                {
                    var entity = new Score
                    {
                        UserName = userName,
                        Points = (int?)TryGetLong(doc, "score") ?? 0,
                        TotalTimeMs = TryGetLong(doc, "totalTime") ?? 0,
                        UpdatedAt = DateTime.UtcNow,
                    };
                    if (!dryRun) { _db.Scores.Add(entity); pending++; }
                    imported++;
                }
                else
                {
                    existing.Points = (int?)TryGetLong(doc, "score") ?? existing.Points;
                    existing.TotalTimeMs = TryGetLong(doc, "totalTime") ?? existing.TotalTimeMs;
                    existing.UpdatedAt = DateTime.UtcNow;
                    skipped++;
                }

                if (!dryRun && pending >= BatchSize) { await _db.SaveChangesAsync(); pending = 0; }
            }
            catch (Exception ex)
            {
                errors++;
                onProgress?.Invoke($"  ⚠ Score '{doc.Id}' skipped: {ex.Message}");
            }
        }
        if (!dryRun && pending > 0) await _db.SaveChangesAsync();
        return new ImportResult(imported, skipped, errors);
    }

    // ---- helpers ----

    // Mirrors VoteService.VoterKeyFor for a voter who was not signed in.
    private static string VoterKeyFor(string userName) => $"anon:{userName.Trim().ToLowerInvariant()}";

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];

    private static PollType MapPollType(string? raw) => (raw ?? "contest").ToLowerInvariant() switch
    {
        "survey" => PollType.Survey,
        "quiz" => PollType.Quiz,
        "exam" => PollType.Exam,
        "wordcloud" => PollType.WordCloud,
        _ => PollType.Contest,
    };

    private static PollStatus MapPollStatus(string? raw) => (raw ?? "waiting").ToLowerInvariant() switch
    {
        "live" => PollStatus.Live,
        "ended" => PollStatus.Ended,
        _ => PollStatus.Waiting,
    };

    private static QuestionType MapQuestionType(string? raw) => (raw ?? "multiple").ToLowerInvariant() switch
    {
        "open" => QuestionType.Open,
        "wordcloud" => QuestionType.WordCloud,
        _ => QuestionType.MultipleChoice,
    };

    private static string? TryGetString(DocumentSnapshot doc, string field) =>
        doc.ContainsField(field) ? doc.GetValue<string?>(field) : null;

    private static bool? TryGetBool(DocumentSnapshot doc, string field) =>
        doc.ContainsField(field) ? doc.GetValue<bool?>(field) : null;

    private static long? TryGetLong(DocumentSnapshot doc, string field)
    {
        if (!doc.ContainsField(field)) return null;
        var v = doc.GetValue<object>(field);
        return v switch
        {
            long l => l,
            int i => i,
            double d => (long)d,
            _ => null,
        };
    }

    private static DateTime? TryGetTimestamp(DocumentSnapshot doc, string field)
    {
        if (!doc.ContainsField(field)) return null;
        var v = doc.GetValue<object>(field);
        return v switch
        {
            Timestamp t => t.ToDateTime(),
            DateTime dt => dt.ToUniversalTime(),
            _ => null,
        };
    }
}
