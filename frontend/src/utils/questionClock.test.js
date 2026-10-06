import { describe, expect, it } from 'vitest';
import { clockOffsetMs, deadlineFor, secondsLeft } from './questionClock';

const iso = (ms) => new Date(ms).toISOString();

describe('questionClock', () => {
  it('reads the gap between the local clock and the server clock', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 30);
    const poll = { serverTime: iso(Date.UTC(2026, 0, 1, 12, 0, 0)) };

    expect(clockOffsetMs(poll, now)).toBe(30_000);
  });

  it('falls back to no correction when the snapshot has no clock', () => {
    expect(clockOffsetMs({}, Date.now())).toBe(0);
  });

  it('places the deadline a time limit after the question started', () => {
    const startedAt = Date.UTC(2026, 0, 1, 12, 0, 0);
    const poll = { questionStartedAt: iso(startedAt), serverTime: iso(startedAt) };

    expect(deadlineFor(poll, { timeLimit: 20 }, 0)).toBe(startedAt + 20_000);
  });

  /**
   * A phone half a minute ahead of the server would otherwise close the question
   * thirty seconds early, which is the whole reason the offset is carried around.
   */
  it('shifts the deadline by the clock offset', () => {
    const startedAt = Date.UTC(2026, 0, 1, 12, 0, 0);
    const poll = { questionStartedAt: iso(startedAt), serverTime: iso(startedAt) };

    expect(deadlineFor(poll, { timeLimit: 20 }, 30_000)).toBe(startedAt + 50_000);
  });

  it('has no deadline before the presenter puts a question on screen', () => {
    expect(deadlineFor({ questionStartedAt: null }, { timeLimit: 20 }, 0)).toBeNull();
  });

  it('has no deadline for a question with no time limit', () => {
    const poll = { questionStartedAt: iso(Date.now()) };

    expect(deadlineFor(poll, { timeLimit: 0 }, 0)).toBeNull();
  });

  it('reads a timestamp without a zone marker as UTC', () => {
    const poll = { questionStartedAt: '2026-01-01T12:00:00', serverTime: '2026-01-01T12:00:00Z' };

    expect(deadlineFor(poll, { timeLimit: 10 }, 0)).toBe(Date.UTC(2026, 0, 1, 12, 0, 10));
  });

  it('rounds the remaining time up and stops at zero', () => {
    expect(secondsLeft(1_000, 0)).toBe(1);
    expect(secondsLeft(1_001, 0)).toBe(2);
    expect(secondsLeft(0, 5_000)).toBe(0);
    expect(secondsLeft(null, 0)).toBeNull();
  });
});
