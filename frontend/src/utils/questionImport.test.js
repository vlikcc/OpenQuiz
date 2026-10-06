import { describe, expect, it } from 'vitest';
import { parseQuestionRows } from './questionImport';

const HEADER = ['Question', 'Option1', 'Option2', 'Option3', 'Option4', 'Correct (1-4)'];

describe('parseQuestionRows', () => {
  it('keeps the answer column out of the options', () => {
    const [question] = parseQuestionRows([
      HEADER,
      ['Which planet is closest to the sun?', 'Venus', 'Mercury', 'Mars', 'Earth', 2],
    ]);

    expect(question.options).toEqual(['Venus', 'Mercury', 'Mars', 'Earth']);
    expect(question.options[question.correctIndex]).toBe('Mercury');
  });

  it('resolves the answer when the options are themselves numbers', () => {
    const [question] = parseQuestionRows([
      HEADER,
      ['How many continents are there?', 5, 6, 7, 8, 3],
    ]);

    expect(question.options).toEqual(['5', '6', '7', '8']);
    expect(question.options[question.correctIndex]).toBe('7');
  });

  it('treats a trailing number as an option when it addresses nothing', () => {
    const [question] = parseQuestionRows([HEADER, ['Pick a number', 5, 6, 7, 8]]);

    expect(question.options).toEqual(['5', '6', '7', '8']);
    expect(question.correctIndex).toBe(0);
  });

  it('supports two-option rows', () => {
    const [question] = parseQuestionRows([HEADER, ['Is the sky blue?', 'Yes', 'No', 2]]);

    expect(question.options).toEqual(['Yes', 'No']);
    expect(question.options[question.correctIndex]).toBe('No');
  });

  it('clamps an out-of-range answer onto the last option', () => {
    const [question] = parseQuestionRows([HEADER, ['Q', 'a', 'b', 'c', 99]]);

    expect(question.options).toEqual(['a', 'b', 'c', '99']);
    expect(question.correctIndex).toBe(0);
  });

  it('skips the header, blank rows and rows without enough options', () => {
    const questions = parseQuestionRows([
      HEADER,
      [],
      ['', 'a', 'b', 1],
      ['Only one option', 'a'],
      ['Valid', 'a', 'b', 1],
    ]);

    expect(questions).toHaveLength(1);
    expect(questions[0].text).toBe('Valid');
  });

  it('trims whitespace and drops empty cells', () => {
    const [question] = parseQuestionRows([HEADER, ['  Spaced  ', ' a ', '', ' b ', 2]]);

    expect(question.text).toBe('Spaced');
    expect(question.options).toEqual(['a', 'b']);
    expect(question.options[question.correctIndex]).toBe('b');
  });

  it('caps the option list at six', () => {
    const [question] = parseQuestionRows([
      HEADER,
      ['Too many', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    ]);

    expect(question.options).toHaveLength(6);
  });
});
