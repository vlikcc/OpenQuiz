import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PresenterMode from './PresenterMode';
import { pollService } from '../services/pollService';
import { realtimeService } from '../services/realtimeService';
import { scoreService } from '../services/scoreService';
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
vi.mock('../services/scoreService', () => ({
  scoreService: {
    leaderboard: vi.fn(() => Promise.resolve([])),
    progress: vi.fn(() => Promise.resolve({ participants: 0, finished: 0 })),
  },
}));
vi.mock('../services/reactionService', () => ({ reactionService: { tally: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../services/realtimeService', () => ({
  realtimeService: { subscribe: vi.fn(() => Promise.resolve(() => {})) },
}));
vi.mock('../services/infoService', () => ({
  infoService: { get: vi.fn(() => Promise.resolve({ publicUrl: 'https://quiz.example.com' })) },
}));
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,qq')) },
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

describe('PresenterMode self-paced contest', () => {
  const SELF_PACED = { ...POLL, selfPaced: true };
  const STANDINGS = [
    { userName: 'Grace', points: 20, totalTimeMs: 12_300 },
    { userName: 'Ada', points: 20, totalTimeMs: 41_000 },
  ];

  it('shows how far the room has got instead of a question to advance', async () => {
    pollService.get.mockResolvedValue(SELF_PACED);
    scoreService.progress.mockResolvedValue({ participants: 3, finished: 1 });
    scoreService.leaderboard.mockResolvedValue(STANDINGS);
    render(<PresenterMode pollId="poll-1" onExit={vi.fn()} showToast={vi.fn()} />);

    expect(await screen.findByText('Katılımcılar soruları kendi hızında cevaplıyor')).toBeInTheDocument();
    expect(await screen.findByText('Tamamlayan: 1 / 3')).toBeInTheDocument();
    expect(await screen.findByText('Grace')).toBeInTheDocument();
    expect(screen.getByText('12.3 sn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sonraki Soru' })).not.toBeInTheDocument();

    await userEvent.keyboard('{ArrowRight}');
    expect(pollService.nextQuestion).not.toHaveBeenCalled();
  });

  it('puts the final standings up once the contest ends', async () => {
    pollService.get.mockResolvedValue({ ...SELF_PACED, status: POLL_STATUS_VALUE.ended });
    scoreService.leaderboard.mockResolvedValue(STANDINGS);
    render(<PresenterMode pollId="poll-1" onExit={vi.fn()} showToast={vi.fn()} />);

    expect(await screen.findByText('Final Sıralaması')).toBeInTheDocument();
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(scoreService.leaderboard).toHaveBeenLastCalledWith('poll-1', 1000, { auth: true });
  });

  it('redraws the standings on its own when a push from the hub is lost', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      pollService.get.mockResolvedValue(SELF_PACED);
      scoreService.progress.mockResolvedValue({ participants: 3, finished: 1 });
      scoreService.leaderboard.mockResolvedValue([]);
      render(<PresenterMode pollId="poll-1" onExit={vi.fn()} showToast={vi.fn()} />);
      expect(await screen.findByText('Tamamlayan: 1 / 3')).toBeInTheDocument();

      scoreService.progress.mockResolvedValue({ participants: 3, finished: 3 });
      scoreService.leaderboard.mockResolvedValue(STANDINGS);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await screen.findByText('Tamamlayan: 3 / 3')).toBeInTheDocument();
      expect(await screen.findByText('Grace')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refetches the standings after the hub connection comes back', async () => {
    let handlers;
    realtimeService.subscribe.mockImplementation((_pollId, registered) => {
      handlers = registered;
      return Promise.resolve(() => {});
    });
    pollService.get.mockResolvedValue(SELF_PACED);
    scoreService.progress.mockResolvedValue({ participants: 3, finished: 1 });
    scoreService.leaderboard.mockResolvedValue([]);
    render(<PresenterMode pollId="poll-1" onExit={vi.fn()} showToast={vi.fn()} />);
    expect(await screen.findByText('Tamamlayan: 1 / 3')).toBeInTheDocument();

    scoreService.progress.mockResolvedValue({ participants: 3, finished: 2 });
    scoreService.leaderboard.mockResolvedValue(STANDINGS);
    await act(async () => {
      handlers.onReconnected();
    });

    expect(await screen.findByText('Tamamlayan: 2 / 3')).toBeInTheDocument();
    expect(await screen.findByText('Ada')).toBeInTheDocument();
  });
});

describe('PresenterMode waiting room', () => {
  it('puts a scannable join QR on the projector', async () => {
    pollService.get.mockResolvedValue({ ...POLL, status: POLL_STATUS_VALUE.waiting });
    render(<PresenterMode pollId="poll-1" onExit={vi.fn()} showToast={vi.fn()} />);

    expect(await screen.findByAltText('Katılım QR kodu')).toHaveAttribute('src', 'data:image/png;base64,qq');
    expect(screen.getByText('Katılmak için telefonunuzla QR kodu okutun')).toBeInTheDocument();
    expect(await screen.findByText('ya da quiz.example.com adresine girip bu kodu yazın:')).toBeInTheDocument();
  });
});
