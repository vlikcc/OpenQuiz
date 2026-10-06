import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildScoreReportCsv, buildScoreReportPdf, buildScoreReportWorkbook } from './scoreReport';

const LABELS = { user: 'User', score: 'Score', time: 'Time', sheet: 'Scores' };

const REPORT_LABELS = {
  ...LABELS,
  question: 'Question',
  option: 'Option',
  votes: 'Votes',
  percentage: 'Percent',
  correct: 'Correct',
  yes: 'Yes',
  no: 'No',
  answer: 'Answer',
  term: 'Term',
  count: 'Count',
  selections: 'Selections',
  sheetQuestions: 'Questions',
  sheetOpen: 'Open answers',
  sheetCloud: 'Word cloud',
  sheetVotes: 'Votes',
  notMultipleChoice: 'not MC',
};

const SCORES = [
  { userName: 'Ada', points: 30, totalTimeMs: 1200 },
  { userName: 'Grace', points: 20, totalTimeMs: 1500 },
];

describe('buildScoreReportPdf', () => {
  it('renders the leaderboard table into a non-empty PDF', () => {
    const doc = buildScoreReportPdf('CI Demo Contest', SCORES, LABELS);
    const bytes = doc.output('arraybuffer');

    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder('latin1').decode(bytes).slice(0, 5)).toBe('%PDF-');
  });

  it('runs the autoTable plugin instead of silently skipping it', () => {
    const doc = buildScoreReportPdf('CI Demo Contest', SCORES, LABELS);

    expect(doc.lastAutoTable).toBeDefined();
    expect(doc.lastAutoTable.body).toHaveLength(SCORES.length);
    expect(doc.lastAutoTable.finalY).toBeGreaterThan(24);
  });

  it('falls back to a generic title when the poll has none', () => {
    expect(() => buildScoreReportPdf('', SCORES, LABELS)).not.toThrow();
  });
});

describe('buildScoreReportWorkbook', () => {
  it('writes a header row followed by one row per score', () => {
    const workbook = buildScoreReportWorkbook(SCORES, LABELS);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[LABELS.sheet], { header: 1 });

    expect(workbook.SheetNames).toEqual([LABELS.sheet]);
    expect(rows).toEqual([
      ['User', 'Score', 'Time'],
      ['Ada', 30, 1200],
      ['Grace', 20, 1500],
    ]);
  });

  it('adds a sheet per extras block that actually has rows', () => {
    const extras = {
      questions: [{
        question: 'Capital?',
        total: 2,
        options: [
          { text: 'Paris', votes: 2, percentage: 100, isCorrect: true },
          { text: 'Lyon', votes: 0, percentage: 0, isCorrect: false },
        ],
      }],
      openAnswers: [{ question: 'Why?', userName: 'Ada', answerText: 'Because', score: 8 }],
      wordClouds: [{ question: 'A tool', terms: [{ term: 'hammer', count: 3 }] }],
      votes: [{ userName: 'Ada', question: 'Capital?', selections: ['Paris'], isCorrect: true, responseTimeMs: 900 }],
    };

    const workbook = buildScoreReportWorkbook(SCORES, REPORT_LABELS, extras);

    expect(workbook.SheetNames).toEqual([
      REPORT_LABELS.sheet,
      REPORT_LABELS.sheetQuestions,
      REPORT_LABELS.sheetOpen,
      REPORT_LABELS.sheetCloud,
      REPORT_LABELS.sheetVotes,
    ]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[REPORT_LABELS.sheetQuestions], { header: 1 })[1])
      .toEqual(['Capital?', 'Paris', 2, 100, 'Yes']);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[REPORT_LABELS.sheetOpen], { header: 1 })[1])
      .toEqual(['Why?', 'Ada', 'Because', 8]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[REPORT_LABELS.sheetCloud], { header: 1 })[1])
      .toEqual(['A tool', 'hammer', 3]);
  });

  it('skips empty extras rather than writing header-only sheets', () => {
    const workbook = buildScoreReportWorkbook(SCORES, REPORT_LABELS, {
      questions: [],
      openAnswers: [],
      wordClouds: [],
      votes: [],
    });

    expect(workbook.SheetNames).toEqual([REPORT_LABELS.sheet]);
  });
});

describe('buildScoreReportCsv', () => {
  it('joins each extras block with a blank line', () => {
    const csv = buildScoreReportCsv(SCORES, REPORT_LABELS, {
      openAnswers: [{ question: 'Why?', userName: 'Ada', answerText: 'Because, obviously', score: 8 }],
    });

    expect(csv).toContain('User,Score,Time');
    expect(csv).toContain('Ada,30,1200');
    expect(csv).toContain('Question,User,Answer,Score');
    expect(csv).toContain('"Because, obviously"');
  });
});

describe('buildScoreReportPdf extras', () => {
  it('keeps adding tables after the standings', () => {
    const doc = buildScoreReportPdf('CI Demo Contest', SCORES, REPORT_LABELS, {
      questions: [{
        question: 'Capital?',
        total: 1,
        options: [{ text: 'Paris', votes: 1, percentage: 100, isCorrect: true }],
      }],
    });

    expect(doc.lastAutoTable.body).toHaveLength(1);
    expect(doc.lastAutoTable.finalY).toBeGreaterThan(24);
  });
});
