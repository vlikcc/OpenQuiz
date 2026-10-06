import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PresenterMode from './PresenterMode';
import { pollService } from '../services/pollService';
import { POLL_STATUS_VALUE, POLL_TYPE_VALUE, QUESTION_TYPE_VALUE } from '../config/constants';

vi.mock('../services/pollService', () => ({
  pollService: {
    get: vi.fn(),
    nextQuestion: vi.fn(),
    prevQuestion: vi.fn(),
    activate: vi.fn(),
    end: vi.fn(),
  },
}));
vi.mock('../services/voteService', () => ({
  voteService: { aggregates: vi.fn(() => Promise.resolve([])), allOpen: vi.fn(() => Promise.resolve([])), scoreOpen: vi.fn() },
}));
vi.mock('../services/wordcloudService', () => ({ wordcloudService: { get: vi.fn() } }));
vi.mock('../services/scoreService', () => ({ scoreService: { leaderboard: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../services/reactionService', () => ({ reactionService: { tally: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../services/realtimeService', () => ({
  realtimeService: { subscribe: vi.fn(() => Promise.resolve(() => {})) },
}));

const POLL = {
  id: 'poll-1',
  title: 'Canlı oda',
  joinCode: 'XYZ789',
  type: POLL_TYPE_VALUE.contest,
  status: POLL_STATUS_VALUE.live,
  currentQuestionIndex: 0,
  participantCount: 3,
  questions: [
    { id: 'q0', text: 'Soru bir', questionType: QUESTION_TYPE_VALUE.multiple, options: [{ text: 'A' }, { text: 'B' }] },
    { id: 'q1', text: 'Soru iki', questionType: QUESTION_TYPE_VALUE.multiple, options: [{ text: 'C' }, { text: 'D' }] },
  ],
};

describe('PresenterMode keyboard', () => {
  beforeEach(() => {
    pollService.get.mockResolvedValue(POLL);
    pollService.nextQuestion.mockResolvedValue({ ...POLL, currentQuestionIndex: 1 });
  });

  it('advances with the right arrow key', async () => {
    render(<PresenterMode pollId="poll-1" onExit={vi.fn()} showToast={vi.fn()} />);
    expect(await screen.findByText('Canlı oda')).toBeInTheDocument();
    expect(screen.getByText('XYZ789')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(pollService.nextQuestion).toHaveBeenCalledWith('poll-1'));
  });
});
