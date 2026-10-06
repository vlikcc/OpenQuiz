/**
 * Word cloud moderation travels to the API as a JSON string on the question, so
 * the editor keeps it in a form that is comfortable to type into — a blacklist
 * as one comma-separated line — and converts on the way in and out.
 */

export const DEFAULT_MODERATION = {
  blacklist: '',
  topN: 50,
  profanityFilter: true,
  allowDuplicatesFromSameUser: false,
};

export function parseModeration(json) {
  if (!json) return { ...DEFAULT_MODERATION };

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ...DEFAULT_MODERATION };
  }

  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_MODERATION };

  return {
    blacklist: Array.isArray(parsed.blacklist) ? parsed.blacklist.join(', ') : '',
    topN: Number.isFinite(parsed.topN) ? clampTopN(parsed.topN) : DEFAULT_MODERATION.topN,
    profanityFilter: parsed.profanityFilter !== false,
    allowDuplicatesFromSameUser: parsed.allowDuplicatesFromSameUser === true,
  };
}

/**
 * Returns null when the author left everything at its default, so a question
 * that was never moderated does not carry an empty config around.
 */
export function toWordCloudConfig(moderation) {
  if (!moderation) return null;

  const blacklist = splitBlacklist(moderation.blacklist);
  const topN = clampTopN(moderation.topN);
  const profanityFilter = moderation.profanityFilter !== false;
  const allowDuplicatesFromSameUser = moderation.allowDuplicatesFromSameUser === true;

  const isDefault = blacklist.length === 0
    && topN === DEFAULT_MODERATION.topN
    && profanityFilter
    && !allowDuplicatesFromSameUser;

  return isDefault
    ? null
    : JSON.stringify({ blacklist, topN, profanityFilter, allowDuplicatesFromSameUser });
}

export function splitBlacklist(raw) {
  return String(raw ?? '')
    .split(/[,\n]/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)
    .filter((word, index, all) => all.indexOf(word) === index);
}

function clampTopN(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MODERATION.topN;
  return Math.min(500, Math.max(1, n));
}
