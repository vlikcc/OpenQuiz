const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

const QUESTION_NUMBER = /^\d+[.)]\s*/;
// The separator is required: without it a question that merely starts with
// A–D ("Ankara is…") would be read as an option.
const OPTION_LINE = /^([A-Da-d])[).]\s*(.+)/;
const ANSWER_LINE = /^(?:Cevap|Doğru|Answer)[:\s]*([A-Da-d1-4])/i;

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

/**
 * A new question starts at a blank line or at the next numbered line — PDF
 * text extraction rarely keeps the blank lines a Word document has.
 */
function splitIntoBlocks(text) {
  const blocks = [];
  let current = [];

  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    if (!line || QUESTION_NUMBER.test(line)) {
      if (current.length > 0) blocks.push(current);
      current = [];
    }
    if (line) current.push(line);
  }
  if (current.length > 0) blocks.push(current);

  return blocks;
}

function answerIndex(answer) {
  const value = answer.toUpperCase();
  return /[A-D]/.test(value) ? value.charCodeAt(0) - 65 : parseInt(value, 10) - 1;
}

/**
 * Reads the documented plain-text layout shared by Word and PDF imports:
 *
 *   1. Question text
 *   A) Option one
 *   B) Option two
 *   Cevap: B
 *
 * Lines that wrap are joined onto the question or option they continue.
 */
export function parseQuestionText(text) {
  const questions = [];

  for (const lines of splitIntoBlocks(text)) {
    if (lines.length < 3) continue;

    let questionText = '';
    const options = [];
    let correctIndex = 0;
    let answered = false;

    for (const line of lines) {
      const answerMatch = line.match(ANSWER_LINE);
      const optionMatch = line.match(OPTION_LINE);

      if (answerMatch) {
        correctIndex = answerIndex(answerMatch[1]);
        answered = true;
      } else if (answered) {
        continue;
      } else if (optionMatch) {
        options.push(optionMatch[2]);
      } else if (options.length > 0) {
        options[options.length - 1] = `${options[options.length - 1]} ${line}`;
      } else {
        const part = line.replace(QUESTION_NUMBER, '');
        questionText = questionText ? `${questionText} ${part}` : part;
      }
    }

    if (questionText && options.length >= MIN_OPTIONS) {
      questions.push({
        text: questionText,
        options,
        correctIndex: Math.max(0, Math.min(correctIndex, options.length - 1)),
      });
    }
  }

  return questions;
}
