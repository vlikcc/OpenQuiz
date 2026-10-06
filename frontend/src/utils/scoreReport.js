import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const DEFAULT_FILENAME = 'report';
const SHEET_NAME_MAX = 31;

function headerRow(labels) {
  return [labels.user, labels.score, labels.time];
}

function scoreRows(scores) {
  return scores.map((s) => [s.userName, s.points, s.totalTimeMs]);
}

function safeName(title) {
  return title || DEFAULT_FILENAME;
}

function sheetName(name) {
  const trimmed = (name || DEFAULT_FILENAME).replace(/[\\/?*[\]]/g, ' ').trim();
  return trimmed.slice(0, SHEET_NAME_MAX) || DEFAULT_FILENAME;
}

function questionRows(questions, labels) {
  const rows = [[labels.question, labels.option, labels.votes, labels.percentage, labels.correct]];
  for (const q of questions) {
    if (!q.options?.length) {
      rows.push([q.question, '', q.total ?? 0, '', '']);
      continue;
    }
    for (const o of q.options) {
      rows.push([
        q.question,
        o.text,
        o.votes,
        o.percentage,
        o.isCorrect ? labels.yes : '',
      ]);
    }
  }
  return rows;
}

function openAnswerRows(answers, labels) {
  return [
    [labels.question, labels.user, labels.answer, labels.score],
    ...answers.map((a) => [a.question, a.userName, a.answerText, a.score ?? '']),
  ];
}

function wordCloudRows(clouds, labels) {
  const rows = [[labels.question, labels.term, labels.count]];
  for (const cloud of clouds) {
    if (!cloud.terms?.length) {
      rows.push([cloud.question, '', 0]);
      continue;
    }
    for (const term of cloud.terms) {
      rows.push([cloud.question, term.term, term.count]);
    }
  }
  return rows;
}

function voteRows(votes, labels) {
  return [
    [labels.user, labels.question, labels.selections, labels.correct, labels.time],
    ...votes.map((v) => [
      v.userName,
      v.question,
      Array.isArray(v.selections) ? v.selections.join(', ') : (v.selections ?? ''),
      v.isCorrect === true ? labels.yes : v.isCorrect === false ? labels.no : '',
      v.responseTimeMs ?? '',
    ]),
  ];
}

function appendSheet(workbook, name, rows) {
  if (!rows || rows.length <= 1) return;
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName(name));
}

function appendTable(doc, head, body, startY) {
  if (!body.length) return;
  autoTable(doc, { head: [head], body, startY, styles: { fontSize: 9 } });
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

/**
 * The extras are optional so the original "just the standings" call still
 * produces a one-table PDF. The analysis screen passes the rest of the
 * session — per-question counts, written answers, the word wall — because a
 * scores-only file was not a report of what actually happened.
 */
export function buildScoreReportPdf(title, scores, labels, extras = {}) {
  const doc = new jsPDF();
  doc.text(safeName(title), 14, 16);
  autoTable(doc, {
    head: [['#', ...headerRow(labels)]],
    body: scores.map((s, i) => [i + 1, s.userName, s.points, s.totalTimeMs]),
    startY: 24,
  });

  const questions = extras.questions ?? [];
  if (questions.length) {
    appendTable(
      doc,
      [labels.question, labels.option, labels.votes, labels.percentage],
      questions.flatMap((q) => (
        q.options?.length
          ? q.options.map((o) => [q.question, o.text, o.votes, `${o.percentage}%`])
          : [[q.question, labels.notMultipleChoice ?? '', q.total ?? 0, '']]
      )),
      doc.lastAutoTable.finalY + 10,
    );
  }

  const openAnswers = extras.openAnswers ?? [];
  if (openAnswers.length) {
    appendTable(
      doc,
      [labels.question, labels.user, labels.answer, labels.score],
      openAnswers.map((a) => [a.question, a.userName, a.answerText, a.score ?? '']),
      doc.lastAutoTable.finalY + 10,
    );
  }

  const wordClouds = extras.wordClouds ?? [];
  if (wordClouds.length) {
    appendTable(
      doc,
      [labels.question, labels.term, labels.count],
      wordClouds.flatMap((cloud) => (
        cloud.terms?.length
          ? cloud.terms.map((term) => [cloud.question, term.term, term.count])
          : [[cloud.question, '', 0]]
      )),
      doc.lastAutoTable.finalY + 10,
    );
  }

  return doc;
}

export function buildScoreReportWorkbook(scores, labels, extras = {}) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headerRow(labels), ...scoreRows(scores)]),
    sheetName(labels.sheet),
  );
  appendSheet(workbook, labels.sheetQuestions, questionRows(extras.questions ?? [], labels));
  appendSheet(workbook, labels.sheetOpen, openAnswerRows(extras.openAnswers ?? [], labels));
  appendSheet(workbook, labels.sheetCloud, wordCloudRows(extras.wordClouds ?? [], labels));
  appendSheet(workbook, labels.sheetVotes, voteRows(extras.votes ?? [], labels));
  return workbook;
}

export function buildScoreReportCsv(scores, labels, extras = {}) {
  const sections = [toCsv([headerRow(labels), ...scoreRows(scores)])];
  const questions = extras.questions ?? [];
  if (questions.length) sections.push(toCsv(questionRows(questions, labels)));
  const openAnswers = extras.openAnswers ?? [];
  if (openAnswers.length) sections.push(toCsv(openAnswerRows(openAnswers, labels)));
  const wordClouds = extras.wordClouds ?? [];
  if (wordClouds.length) sections.push(toCsv(wordCloudRows(wordClouds, labels)));
  const votes = extras.votes ?? [];
  if (votes.length) sections.push(toCsv(voteRows(votes, labels)));
  return sections.join('\n\n');
}

export function saveScoreReportPdf(doc, title) {
  doc.save(`${safeName(title)}.pdf`);
}

export function saveScoreReportWorkbook(workbook, title) {
  XLSX.writeFile(workbook, `${safeName(title)}.xlsx`);
}

export function saveScoreReportCsv(csv, title) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName(title)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
