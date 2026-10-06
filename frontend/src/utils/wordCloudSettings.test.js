import { describe, expect, it } from 'vitest';
import { DEFAULT_MODERATION, parseModeration, splitBlacklist, toWordCloudConfig } from './wordCloudSettings';

describe('word cloud moderation settings', () => {
  it('starts a fresh question on the defaults', () => {
    expect(parseModeration(null)).toEqual(DEFAULT_MODERATION);
  });

  it('reads back what was saved', () => {
    const saved = JSON.stringify({
      blacklist: ['spam', 'reklam'],
      topN: 20,
      profanityFilter: false,
      allowDuplicatesFromSameUser: true,
    });

    expect(parseModeration(saved)).toEqual({
      blacklist: 'spam, reklam',
      topN: 20,
      profanityFilter: false,
      allowDuplicatesFromSameUser: true,
    });
  });

  /** A question saved before moderation existed carries an unreadable config. */
  it('falls back to the defaults on a config it cannot read', () => {
    expect(parseModeration('{not json')).toEqual(DEFAULT_MODERATION);
    expect(parseModeration('"a string"')).toEqual(DEFAULT_MODERATION);
  });

  it('sends nothing when the author changed nothing', () => {
    expect(toWordCloudConfig({ ...DEFAULT_MODERATION })).toBeNull();
    expect(toWordCloudConfig({ ...DEFAULT_MODERATION, blacklist: '  ,  ' })).toBeNull();
  });

  it('packs the blocked list into the shape the API expects', () => {
    const json = toWordCloudConfig({ ...DEFAULT_MODERATION, blacklist: 'Spam, reklam , spam' });

    expect(JSON.parse(json)).toEqual({
      blacklist: ['spam', 'reklam'],
      topN: 50,
      profanityFilter: true,
      allowDuplicatesFromSameUser: false,
    });
  });

  it('keeps the shown-word count inside what the API accepts', () => {
    expect(JSON.parse(toWordCloudConfig({ ...DEFAULT_MODERATION, topN: 9000 })).topN).toBe(500);
    expect(JSON.parse(toWordCloudConfig({ ...DEFAULT_MODERATION, topN: 0 })).topN).toBe(1);
  });

  it('splits a blocked list on commas and newlines', () => {
    expect(splitBlacklist('Spam,\n reklam\nSPAM')).toEqual(['spam', 'reklam']);
    expect(splitBlacklist(undefined)).toEqual([]);
  });
});
