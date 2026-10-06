import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VoterMode from './VoterMode';
import { pollService } from '../services/pollService';
import { realtimeService } from '../services/realtimeService';
import { voteService } from '../services/voteService';
import { POLL_STATUS_VALUE, POLL_TYPE_VALUE, QUESTION_TYPE_VALUE } from '../config/constants';

vi.mock('../services/pollService', () => ({
  pollService: { get: vi.fn(), join: vi.fn() },
}));
vi.mock('../services/voteService', () => ({
  voteService: { submit: vi.fn(), submitOpen: vi.fn() },
}));
vi.mock('../services/wordcloudService', () => ({ wordcloudService: { submit: vi.fn() } }));
vi.mock('../services/reactionService', () => ({ reactionService: { send: vi.fn() } }));
vi.mock('../services/realtimeService', () => ({ realtimeService: { subscribe: vi.fn() } }));
vi.mock('../services/brandingService', () => ({
  brandingService: { getForPoll: vi.fn(() => Promise.resolve(null)) },
}));

const POLL_ID = 'poll-1';

const question = (index, allowMultiple) => ({
  id: `q${index}`,
  orderIndex: index,
  text: `Soru metni ${index + 1}`,
  timeLimit: 30,
  questionType: QUESTION_TYPE_VALUE.multiple,
  allowMultiple,
  options: [
    { id: `q${index}o0`, orderIndex: 0, text: `Seçenek A${index}` },
    { id: `q${index}o1`, orderIndex: 1, text: `Seçenek B${index}` },
  ],
});

const poll = (currentQuestionIndex, participantCount = 1) => ({
  id: POLL_ID,
  title: 'Canlı oturum',
  type: POLL_TYPE_VALUE.survey,
  status: POLL_STATUS_VALUE.live,
  currentQuestionIndex,
  participantCount,
  questions: [question(0, false), question(1, true)],
});

/**
 * The countdown runs off the server's clock, so a poll snapshot has to say when
 * the question went on screen and what time it was when it said so.
 */
const timedPoll = (secondsAlreadyElapsed) => {
  const now = Date.now();
  return {
    ...poll(1),
    questionStartedAt: new Date(now - secondsAlreadyElapsed * 1000).toISOString(),
    serverTime: new Date(now).toISOString(),
  };
};

/** Hands back the handler the component registered with the hub. */
function captureRealtimeHandlers() {
  let handlers;
  realtimeService.subscribe.mockImplementation((_pollId, registered) => {
    handlers = registered;
    return Promise.resolve(() => {});
  });
  return () => handlers;
}

async function joinAsVoter() {
  const user = userEvent.setup();
  render(<VoterMode pollId={POLL_ID} showToast={vi.fn()} />);

  await user.type(await screen.findByPlaceholderText('Adınız'), 'Ada');
  await user.click(screen.getByRole('button', { name: 'Katıl' }));
  return user;
}

describe('VoterMode realtime updates', () => {
  beforeEach(() => {
    pollService.get.mockResolvedValue(poll(1));
    pollService.join.mockResolvedValue({});
  });

  it('keeps the current question and selection when another participant joins', async () => {
    const handlers = captureRealtimeHandlers();
    const user = await joinAsVoter();

    expect(await screen.findByText('SORU 2')).toBeInTheDocument();

    const chosen = screen.getByRole('button', { name: 'Seçenek B1' });
    await user.click(chosen);
    expect(chosen).toHaveClass('ring-2');

    // Joining re-broadcasts the poll with the same question index. Before the
    // fix the handler compared against a stale index and reset everyone.
    await act(async () => {
      handlers().onPollUpdated(poll(1, 2));
    });

    expect(screen.getByText('SORU 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seçenek B1' })).toHaveClass('ring-2');
  });

  it('moves on and clears the selection when the presenter changes question', async () => {
    const handlers = captureRealtimeHandlers();
    const user = await joinAsVoter();

    await user.click(await screen.findByRole('button', { name: 'Seçenek B1' }));

    await act(async () => {
      handlers().onPollUpdated(poll(0));
    });

    expect(screen.getByText('SORU 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seçenek A0' })).not.toHaveClass('ring-2');
  });
});

/**
 * The browser used to own the countdown, so an answer chosen but never sent was
 * simply lost when time ran out — and a tab that had been paused could still
 * send one long afterwards.
 */
describe('VoterMode question timer', () => {
  beforeEach(() => {
    pollService.join.mockResolvedValue({});
    voteService.submit.mockResolvedValue({ isCorrect: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from the question start the server reported', async () => {
    pollService.get.mockResolvedValue(timedPoll(12));
    captureRealtimeHandlers();

    await joinAsVoter();

    // 30s limit, 12 already gone.
    expect(await screen.findByText('18 sn')).toBeInTheDocument();
  });

  it('sends the chosen answer by itself when the time runs out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pollService.get.mockResolvedValue(timedPoll(29));
    captureRealtimeHandlers();

    const user = await joinAsVoter();
    await user.click(await screen.findByRole('button', { name: 'Seçenek B1' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    await waitFor(() => expect(voteService.submit).toHaveBeenCalledTimes(1));
    expect(voteService.submit).toHaveBeenCalledWith(
      POLL_ID,
      expect.objectContaining({ questionIndex: 1, selectedIndices: [1] }),
    );
  });

  it('closes the question with a notice when nothing was entered', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pollService.get.mockResolvedValue(timedPoll(29));
    captureRealtimeHandlers();

    await joinAsVoter();
    expect(await screen.findByText('SORU 2')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(await screen.findByText('SÜRE DOLDU')).toBeInTheDocument();
    expect(voteService.submit).not.toHaveBeenCalled();
  });
});
