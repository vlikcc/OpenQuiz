import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResultsAnalysis from './ResultsAnalysis';
import { voteService } from '../services/voteService';
import { scoreService } from '../services/scoreService';
import { wordcloudService } from '../services/wordcloudService';
import { pollService } from '../services/pollService';
import { useEntitlements } from '../hooks/useEntitlements';
import { POLL_TYPE_VALUE, QUESTION_TYPE_VALUE } from '../config/constants';

vi.mock('../services/voteService', () => ({
  voteService: { aggregates: vi.fn(), allOpen: vi.fn(), allVotes: vi.fn() },
}));
vi.mock('../services/scoreService', () => ({
  scoreService: { leaderboard: vi.fn() },
}));
vi.mock('../services/wordcloudService', () => ({
  wordcloudService: { get: vi.fn() },
}));
vi.mock('../services/pollService', () => ({
  pollService: { report: vi.fn() },
}));
vi.mock('../hooks/useEntitlements', () => ({
  useEntitlements: vi.fn(() => ({ can: () => true, plan: 'pro', loading: false })),
}));
vi.mock('../utils/scoreReport', () => ({
  buildScoreReportPdf: vi.fn(() => ({})),
  saveScoreReportPdf: vi.fn(),
  buildScoreReportWorkbook: vi.fn(() => ({})),
  saveScoreReportWorkbook: vi.fn(),
  buildScoreReportCsv: vi.fn(() => 'csv'),
  saveScoreReportCsv: vi.fn(),
}));

const POLL = {
  id: 'poll-1',
  title: 'Pazartesi sınavı',
  type: POLL_TYPE_VALUE.exam,
  participantCount: 2,
  questions: [
    {
      id: 'q-mc',
      text: 'Başkent?',
      questionType: QUESTION_TYPE_VALUE.multiple,
      correctOptionIndex: 0,
      options: [{ text: 'Ankara' }, { text: 'İzmir' }],
    },
    {
      id: 'q-open',
      text: 'Neden?',
      questionType: QUESTION_TYPE_VALUE.open,
      points: 10,
      options: [],
    },
    {
      id: 'q-cloud',
      text: 'Bir araç adı',
      questionType: QUESTION_TYPE_VALUE.wordcloud,
      options: [],
    },
  ],
};

function renderAnalysis() {
  return render(<ResultsAnalysis poll={POLL} pollId="poll-1" onClose={vi.fn()} />);
}

describe('ResultsAnalysis', () => {
  beforeEach(() => {
    voteService.aggregates.mockResolvedValue([
      { questionIndex: 0, questionId: 'q-mc', totalRespondents: 2, optionCounts: { 0: 2, 1: 0 } },
    ]);
    voteService.allOpen.mockResolvedValue([
      { id: 'a1', questionId: 'q-open', userName: 'Ada', answerText: 'Çünkü', score: 8 },
    ]);
    voteService.allVotes.mockResolvedValue([]);
    scoreService.leaderboard.mockResolvedValue([
      { userName: 'Ada', points: 18, totalTimeMs: 900 },
    ]);
    wordcloudService.get.mockResolvedValue({ questionIndex: 2, terms: [{ term: 'çekiç', count: 3 }] });
    pollService.report.mockResolvedValue({
      scores: [{ userName: 'Ada', points: 18, totalTimeMs: 900 }],
      aggregates: [],
      votes: [],
      openAnswers: [],
      wordClouds: [],
    });
    useEntitlements.mockReturnValue({ can: () => true, plan: 'pro', loading: false });
  });

  it('opens with the question breakdown and a participant count', async () => {
    renderAnalysis();

    expect(await screen.findByRole('heading', { name: /Pazartesi sınavı/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Soru 1: Başkent/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CSV/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF/ })).toBeInTheDocument();
  });

  it('shows written answers on their own tab', async () => {
    const user = userEvent.setup();
    renderAnalysis();
    await screen.findByRole('heading', { name: /Pazartesi sınavı/ });

    await user.click(screen.getByRole('button', { name: /Açık uçlu/ }));

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Çünkü')).toBeInTheDocument();
  });

  it('loads the word wall for every cloud question', async () => {
    const user = userEvent.setup();
    renderAnalysis();
    await screen.findByRole('heading', { name: /Pazartesi sınavı/ });

    expect(wordcloudService.get).toHaveBeenCalledWith('poll-1', 2);

    await user.click(screen.getByRole('button', { name: /Kelime bulutu/ }));
    expect(await screen.findByText('Bir araç adı')).toBeInTheDocument();
  });

  it('shows the standings on the leaderboard tab', async () => {
    const user = userEvent.setup();
    renderAnalysis();
    await screen.findByRole('heading', { name: /Pazartesi sınavı/ });

    await user.click(screen.getByRole('button', { name: /Liderlik/ }));
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('18 puan')).toBeInTheDocument();
  });

  it('hides export when the plan does not include reports.export', async () => {
    useEntitlements.mockReturnValue({ can: () => false, plan: 'free', loading: false });
    renderAnalysis();
    await screen.findByRole('heading', { name: /Pazartesi sınavı/ });

    expect(screen.queryByRole('button', { name: /CSV/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PDF/ })).not.toBeInTheDocument();
  });

  it('fetches the gated report before building a PDF', async () => {
    const user = userEvent.setup();
    renderAnalysis();
    await screen.findByRole('heading', { name: /Pazartesi sınavı/ });

    await user.click(screen.getByRole('button', { name: /PDF/ }));

    await waitFor(() => expect(pollService.report).toHaveBeenCalledWith('poll-1'));
  });
});
