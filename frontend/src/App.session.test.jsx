import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { pollService } from './services/pollService';
import { useAuth } from './hooks/useAuth';
import { POLL_STATUS_VALUE, POLL_TYPE_VALUE, QUESTION_TYPE_VALUE } from './config/constants';

vi.mock('./hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('./services/pollService', () => ({
  pollService: {
    list: vi.fn(),
    get: vi.fn(),
    getByCode: vi.fn(),
    getShared: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    join: vi.fn(),
  },
}));
vi.mock('./services/authService', () => ({ authService: {} }));
vi.mock('./services/tokenStore', () => ({ tokenStore: { getAccessToken: () => null, subscribe: () => () => {} } }));
vi.mock('./services/realtimeService', () => ({
  realtimeService: { subscribe: vi.fn(() => Promise.resolve(() => {})) },
}));
vi.mock('./services/questionBankService', () => ({
  questionBankService: { list: vi.fn(() => Promise.resolve([])), create: vi.fn(), remove: vi.fn() },
  bankItemToDraft: (item) => item,
  draftToBankRequest: (q) => q,
}));
vi.mock('./services/brandingService', () => ({
  brandingService: { getForPoll: vi.fn(() => Promise.resolve(null)) },
}));

const POLL = {
  id: 'poll-1',
  title: 'Kodla katıl',
  type: POLL_TYPE_VALUE.contest,
  status: POLL_STATUS_VALUE.waiting,
  questions: [{
    id: 'q0',
    orderIndex: 0,
    text: 'Soru',
    questionType: QUESTION_TYPE_VALUE.multiple,
    options: [{ id: 'o0', orderIndex: 0, text: 'A' }],
  }],
};

describe('join by room code', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?mode=voter&code=ABC123');
    useAuth.mockReturnValue({ user: null, loading: false, logout: vi.fn() });
    pollService.getByCode.mockResolvedValue(POLL);
    pollService.get.mockResolvedValue(POLL);
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('resolves ?mode=voter&code= and opens the join screen', async () => {
    render(<App />);

    await waitFor(() => expect(pollService.getByCode).toHaveBeenCalledWith('ABC123'));
    expect(await screen.findByText('Kodla katıl')).toBeInTheDocument();
    expect(screen.getByLabelText('Adınız')).toBeInTheDocument();
  });
});
