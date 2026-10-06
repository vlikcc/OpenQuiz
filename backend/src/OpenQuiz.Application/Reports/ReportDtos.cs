using OpenQuiz.Application.Scores;
using OpenQuiz.Application.Votes;
using OpenQuiz.Application.WordCloud;

namespace OpenQuiz.Application.Reports;

/// <summary>
/// The owner-only dump the export buttons consume. Client-side jspdf/xlsx
/// stay where they are — this is the gated data source those writers were
/// previously assembling from anonymous aggregates plus paged owner lists.
/// </summary>
public record PollReportDto(
    Guid PollId,
    string Title,
    int ParticipantCount,
    List<ScoreEntry> Scores,
    List<QuestionAggregate> Aggregates,
    List<VoteDto> Votes,
    List<OpenAnswerDto> OpenAnswers,
    List<WordCloudReportItem> WordClouds);

public record WordCloudReportItem(
    int QuestionIndex,
    Guid QuestionId,
    string QuestionText,
    List<WordCloudTerm> Terms);
