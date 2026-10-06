namespace OpenQuiz.Application.WordCloud;

public record WordCloudSubmitRequest(
    int QuestionIndex,
    List<string> Terms,
    string UserName);

public record WordCloudTerm(string Term, int Count);

public record WordCloudResponse(int QuestionIndex, List<WordCloudTerm> Terms);
