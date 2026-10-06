namespace OpenQuiz.Application.Common;

/// <summary>
/// Query-string paging. The bounds are applied on binding so no caller, honest
/// or otherwise, can ask an endpoint for its entire table.
/// </summary>
public class PageRequest
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 200;

    private int _page = 1;
    private int _pageSize = DefaultPageSize;

    public int Page
    {
        get => _page;
        set => _page = Math.Max(value, 1);
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = Math.Clamp(value, 1, MaxPageSize);
    }

    public int Skip => (Page - 1) * PageSize;
}

/// <summary>One page of results, plus what the caller needs to ask for the next.</summary>
public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public bool HasMore => (long)Page * PageSize < TotalCount;
}
