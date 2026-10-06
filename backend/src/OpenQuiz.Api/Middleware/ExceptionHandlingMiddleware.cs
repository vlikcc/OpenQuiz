using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using OpenQuiz.Application.Common;

namespace OpenQuiz.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ValidationException vex)
        {
            await WriteAsync(ctx, 400, "validation", "Validation failed.", vex.Errors.Select(e => new { e.PropertyName, e.ErrorMessage }));
        }
        catch (AppException aex)
        {
            await WriteAsync(ctx, aex.StatusCode, aex.ErrorCode, aex.Message, extensions: aex.Extensions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await WriteAsync(ctx, 500, "internal_error", "An unexpected error occurred.");
        }
    }

    private static async Task WriteAsync(
        HttpContext ctx,
        int status,
        string code,
        string message,
        object? details = null,
        IReadOnlyDictionary<string, object?>? extensions = null)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = status,
            Type = $"https://openquiz.local/errors/{code}",
            Title = code,
            Detail = message
        };
        if (details is not null) problem.Extensions["errors"] = details;
        if (extensions is not null)
        {
            foreach (var (key, value) in extensions)
                problem.Extensions[key] = value;
        }

        await ctx.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
