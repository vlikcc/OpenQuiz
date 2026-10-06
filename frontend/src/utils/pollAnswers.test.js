import { describe, expect, it } from 'vitest';
import { mergeAnswerKey } from './pollAnswers';

const known = {
  id: 'poll-1',
  currentQuestionIndex: 0,
  questions: [
    { id: 'q0', text: 'Soru 1', correctOptionIndex: 2, correctAnswer: null },
    { id: 'q1', text: 'Soru 2', correctOptionIndex: null, correctAnswer: 'Merkür' },
  ],
};

const redactedBroadcast = {
  id: 'poll-1',
  currentQuestionIndex: 1,
  questions: [
    { id: 'q0', text: 'Soru 1', correctOptionIndex: null, correctAnswer: null },
    { id: 'q1', text: 'Soru 2', correctOptionIndex: null, correctAnswer: null },
  ],
};

describe('mergeAnswerKey', () => {
  it('keeps the answers the presenter already fetched', () => {
    const merged = mergeAnswerKey(redactedBroadcast, known);

    expect(merged.questions[0].correctOptionIndex).toBe(2);
    expect(merged.questions[1].correctAnswer).toBe('Merkür');
  });

  it('takes everything else from the broadcast', () => {
    const merged = mergeAnswerKey(redactedBroadcast, known);

    expect(merged.currentQuestionIndex).toBe(1);
  });

  it('prefers the incoming answers once the poll ends and they are released', () => {
    const revealed = {
      ...redactedBroadcast,
      questions: [{ id: 'q0', text: 'Soru 1', correctOptionIndex: 0, correctAnswer: null }],
    };

    expect(mergeAnswerKey(revealed, known).questions[0].correctOptionIndex).toBe(0);
  });

  it('leaves questions the presenter has never seen alone', () => {
    const withNewQuestion = {
      ...redactedBroadcast,
      questions: [{ id: 'q9', text: 'Yeni soru', correctOptionIndex: null, correctAnswer: null }],
    };

    expect(mergeAnswerKey(withNewQuestion, known).questions[0].correctOptionIndex).toBeNull();
  });

  it('passes the broadcast straight through before the first fetch lands', () => {
    expect(mergeAnswerKey(redactedBroadcast, null)).toBe(redactedBroadcast);
  });
});
