const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

function cellText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * Splits a spreadsheet row into options and a correct-answer index.
 *
 * The documented layout puts a 1-based answer number in the trailing column
 * (`Question | Option1..OptionN | Answer`), but a sheet may legitimately end on
 * its last option instead. A trailing number is only read as the answer when it
 * actually addresses one of the cells before it, which keeps numeric options
 * such as `5 | 6 | 7 | 8` from swallowing their own last entry.
 */
function splitOptionsAndAnswer(cells) {
  const trailing = Number(cells[cells.length - 1]);
  const precedingCount = cells.length - 1;
  const pointsAtAnOption =
    Number.isInteger(trailing) && trailing >= 1 && trailing <= precedingCount;

  if (!pointsAtAnOption) {
    return { options: cells.slice(0, MAX_OPTIONS), correctIndex: 0 };
  }

  return {
    options: cells.slice(0, precedingCount).slice(0, MAX_OPTIONS),
    correctIndex: trailing - 1,
  };
}

/**
 * Maps `sheet_to_json(..., { header: 1 })` rows onto question drafts,
 * skipping the header row.
 */
export function parseQuestionRows(rows) {
  const questions = [];

  for (const row of rows.slice(1)) {
    if (!row) continue;

    const text = cellText(row[0]);
    if (!text) continue;

    const cells = row.slice(1).map(cellText).filter(Boolean);
    if (cells.length < MIN_OPTIONS) continue;

    const { options, correctIndex } = splitOptionsAndAnswer(cells);
    if (options.length < MIN_OPTIONS) continue;

    questions.push({
      text,
      options,
      correctIndex: Math.max(0, Math.min(correctIndex, options.length - 1)),
    });
  }

  return questions;
}
