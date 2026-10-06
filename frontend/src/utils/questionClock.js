/**
 * The countdown a participant sees has to agree with the deadline the server
 * enforces, otherwise a phone with a wrong clock either loses seconds it should
 * have had or keeps answering after the API has started refusing.
 *
 * The poll snapshot carries the server's clock alongside the question's start,
 * so the difference between that and the local clock is the offset to correct
 * by. A late joiner gets the same remaining time as everyone else because the
 * start is absolute rather than "when my page loaded".
 */

export function clockOffsetMs(poll, now = Date.now()) {
  const serverTime = parseUtc(poll?.serverTime);
  return serverTime === null ? 0 : now - serverTime;
}

export function deadlineFor(poll, question, offsetMs = clockOffsetMs(poll)) {
  const startedAt = parseUtc(poll?.questionStartedAt);
  const limit = question?.timeLimit ?? 0;
  if (startedAt === null || limit <= 0) return null;

  return startedAt + limit * 1000 + offsetMs;
}

export function secondsLeft(deadline, now = Date.now()) {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * .NET writes UTC timestamps with a trailing Z. Values that reach the client
 * without one would be read as local time, so they are treated as UTC here too.
 */
function parseUtc(value) {
  if (!value) return null;

  const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
