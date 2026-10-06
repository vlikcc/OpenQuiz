import { describe, expect, it } from 'vitest';
import {
  isResultsSearch,
  isVoterSearch,
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

  it('parses a results share token', () => {
    expect(isResultsSearch('?mode=results&token=deadbeef')).toBe(true);
    expect(resultsTokenFromSearch('?mode=results&token=deadbeef')).toBe('deadbeef');
    expect(resultsShareUrl('http://localhost:8080', 'deadbeef'))
      .toBe('http://localhost:8080/?mode=results&token=deadbeef');
  });
});
