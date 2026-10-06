import { describe, expect, it } from 'vitest';
import { mapPollReport } from './pollReport';
import { POLL_TYPE_VALUE, QUESTION_TYPE_VALUE } from '../config/constants';

const POLL = {
  id: 'poll-1',
  title: 'Demo',
  type: POLL_TYPE_VALUE.exam,
  questions: [
    {
      id: 'q-mc',
      text: 'Capital?',
      questionType: QUESTION_TYPE_VALUE.multiple,
      correctOptionIndex: 0,
      options: [{ text: 'Ankara' }, { text: 'Izmir' }],
    },
    {
      id: 'q-open',
      text: 'Why?',
      questionType: QUESTION_TYPE_VALUE.open,
      options: [],
    },
  ],
};

describe('mapPollReport', () => {
  it('turns the report payload into the extras scoreReport already consumes', () => {
    const mapped = mapPollReport({
      scores: [{ userName: 'Ada', points: 18, totalTimeMs: 900 }],
      aggregates: [{ questionIndex: 0, questionId: 'q-mc', totalRespondents: 2, optionCounts: { 0: 2, 1: 0 } }],
      openAnswers: [{ questionId: 'q-open', userName: 'Ada', answerText: 'Because', score: 8 }],
      wordClouds: [{ questionIndex: 2, questionText: 'A tool', terms: [{ term: 'hammer', count: 3 }] }],
      votes: [{ userName: 'Ada', questionId: 'q-mc', selectedIndices: [0], isCorrect: true, responseTimeMs: 400 }],
    }, POLL);

    expect(mapped.scores).toEqual([{ userName: 'Ada', points: 18, totalTimeMs: 900 }]);
    expect(mapped.extras.questions[0]).toMatchObject({
      question: 'Capital?',
      total: 2,
      options: [
        { text: 'Ankara', votes: 2, percentage: 100, isCorrect: true },
        { text: 'Izmir', votes: 0, percentage: 0, isCorrect: false },
      ],
    });
    expect(mapped.extras.openAnswers[0]).toMatchObject({ question: 'Why?', userName: 'Ada', score: 8 });
    expect(mapped.extras.wordClouds[0].question).toBe('A tool');
    expect(mapped.extras.votes[0].selections).toEqual(['Ankara']);
  });
});
