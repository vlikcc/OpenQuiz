import { describe, expect, it } from 'vitest';
import {
  isLoopbackOrigin,
  isResultsSearch,
  isVoterSearch,
  joinOrigin,
  resultsShareUrl,
  resultsTokenFromSearch,
  voterCodeFromSearch,
  voterIdFromSearch,
  voterJoinUrl,
} from './sessionRoute';

describe('sessionRoute', () => {
  it('treats a join code as voter mode', () => {
    expect(isVoterSearch('?mode=voter&code=ABC123')).toBe(true);
    expect(voterCodeFromSearch('?mode=voter&code=ABC123')).toBe('ABC123');
    expect(voterIdFromSearch('?mode=voter&code=ABC123')).toBeNull();
  });

  it('still accepts the older id join link', () => {
    expect(isVoterSearch('?mode=voter&id=poll-1')).toBe(true);
    expect(voterIdFromSearch('?mode=voter&id=poll-1')).toBe('poll-1');
  });

  it('builds a code-first join URL', () => {
    expect(voterJoinUrl('http://localhost:8080', { code: 'ABC123', pollId: 'p1' }))
      .toBe('http://localhost:8080/?mode=voter&code=ABC123');
  });

  it('recognises addresses a phone cannot reach', () => {
    expect(isLoopbackOrigin('http://localhost:8080')).toBe(true);
    expect(isLoopbackOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isLoopbackOrigin('http://[::1]:8080')).toBe(true);
    expect(isLoopbackOrigin('http://192.168.1.20:8080')).toBe(false);
    expect(isLoopbackOrigin('https://quiz.example.com')).toBe(false);
  });

  it('points join links at the public address only when the presenter is on loopback', () => {
    expect(joinOrigin('http://localhost:8080', 'https://quiz.example.com/')).toBe('https://quiz.example.com');
    expect(joinOrigin('http://192.168.1.20:8080', 'https://quiz.example.com')).toBe('http://192.168.1.20:8080');
    expect(joinOrigin('http://localhost:8080', 'http://localhost:8080')).toBe('http://localhost:8080');
    expect(joinOrigin('http://localhost:8080', '')).toBe('http://localhost:8080');
  });

  it('parses a results share token', () => {
    expect(isResultsSearch('?mode=results&token=deadbeef')).toBe(true);
    expect(resultsTokenFromSearch('?mode=results&token=deadbeef')).toBe('deadbeef');
    expect(resultsShareUrl('http://localhost:8080', 'deadbeef'))
      .toBe('http://localhost:8080/?mode=results&token=deadbeef');
  });
});
