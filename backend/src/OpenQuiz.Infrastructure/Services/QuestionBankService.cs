using FluentValidation;
using Microsoft.EntityFrameworkCore;
using OpenQuiz.Application.Abstractions;
using OpenQuiz.Application.Common;
using OpenQuiz.Application.Polls;
using OpenQuiz.Application.QuestionBank;
using OpenQuiz.Domain.Entities;
using OpenQuiz.Infrastructure.Persistence;

namespace OpenQuiz.Infrastructure.Services;

public class QuestionBankService : IQuestionBankService
{
    private readonly OpenQuizDbContext _db;
    private readonly ICurrentUser _user;
    private readonly IValidator<SaveQuestionBankItemRequest> _validator;

    public QuestionBankService(
        OpenQuizDbContext db,
        ICurrentUser user,
        IValidator<SaveQuestionBankItemRequest> validator)
    {
        _db = db; _user = user; _validator = validator;
    }

    public async Task<IReadOnlyList<QuestionBankItemDto>> ListMineAsync(CancellationToken ct)
    {
        var uid = RequireUser();
        var rows = await _db.QuestionBankItems.AsNoTracking()
            .Include(i => i.Options)
            .Where(i => i.OwnerUserId == uid)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<QuestionBankItemDto> CreateAsync(SaveQuestionBankItemRequest req, CancellationToken ct)
    {
        var uid = RequireUser();
        await _validator.ValidateAndThrowAsync(req, ct);

        var item = new QuestionBankItem { OwnerUserId = uid, CreatedAt = DateTime.UtcNow };
        Apply(item, req);
        _db.QuestionBankItems.Add(item);
        await _db.SaveChangesAsync(ct);
        return Map(item);
    }

    public async Task<QuestionBankItemDto> UpdateAsync(Guid id, SaveQuestionBankItemRequest req, CancellationToken ct)
    {
        var uid = RequireUser();
        await _validator.ValidateAndThrowAsync(req, ct);

        var item = await _db.QuestionBankItems.Include(i => i.Options)
            .FirstOrDefaultAsync(i => i.Id == id, ct) ?? throw Errors.NotFound("Question");
        if (item.OwnerUserId != uid && !_user.IsAdmin) throw Errors.Forbidden();

        _db.QuestionBankOptions.RemoveRange(item.Options);
        Apply(item, req);
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Map(item);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var uid = RequireUser();
        var item = await _db.QuestionBankItems.FirstOrDefaultAsync(i => i.Id == id, ct)
                   ?? throw Errors.NotFound("Question");
        if (item.OwnerUserId != uid && !_user.IsAdmin) throw Errors.Forbidden();
        _db.QuestionBankItems.Remove(item);
        await _db.SaveChangesAsync(ct);
    }

    private Guid RequireUser()
    {
        if (!_user.IsAuthenticated || _user.UserId is not Guid uid) throw Errors.Unauthorized();
        if (!_user.IsAdmin && !_user.CanCreate) throw Errors.Forbidden("You are not authorized to create polls.");
        return uid;
    }

    private static void Apply(QuestionBankItem item, SaveQuestionBankItemRequest req)
    {
        item.Text = req.Text;
        item.ImageUrl = req.ImageUrl;
        item.TimeLimit = req.TimeLimit > 0 ? req.TimeLimit : 30;
        item.QuestionType = req.QuestionType;
        item.AllowMultiple = req.AllowMultiple;
        item.CorrectOptionIndex = req.CorrectOptionIndex;
        item.CorrectAnswer = req.CorrectAnswer;
        item.Points = req.Points > 0 ? req.Points : 10;
        item.MaxWords = req.MaxWords;
        item.WordCloudConfig = req.WordCloudConfig;
        item.Options = req.Options.OrderBy(o => o.OrderIndex)
            .Select((o, idx) => new QuestionBankOption { OrderIndex = idx, Text = o.Text })
            .ToList();
    }

    private static QuestionBankItemDto Map(QuestionBankItem i) => new(
        i.Id, i.Text, i.ImageUrl, i.TimeLimit, i.QuestionType, i.AllowMultiple,
        i.CorrectOptionIndex, i.CorrectAnswer, i.Points, i.MaxWords, i.WordCloudConfig,
        i.CreatedAt,
        i.Options.OrderBy(o => o.OrderIndex).Select(o => new OptionDto(o.Id, o.OrderIndex, o.Text)).ToList());
}
