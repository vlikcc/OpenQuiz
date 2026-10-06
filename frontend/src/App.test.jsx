import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { pollService } from './services/pollService';
import { useAuth } from './hooks/useAuth';
import { POLL_TYPE_VALUE, QUESTION_TYPE_VALUE } from './config/constants';

vi.mock('./hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('./services/pollService', () => ({
  pollService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), join: vi.fn() },
}));
vi.mock('./services/questionBankService', () => ({
  questionBankService: { list: vi.fn(() => Promise.resolve([])), create: vi.fn(), remove: vi.fn() },
  bankItemToDraft: (item) => item,
  draftToBankRequest: (q) => q,
}));
vi.mock('./services/authService', () => ({ authService: {} }));
vi.mock('./services/tokenStore', () => ({ tokenStore: { getAccessToken: () => null, subscribe: () => () => {} } }));
vi.mock('./services/realtimeService', () => ({
  realtimeService: { subscribe: vi.fn(() => Promise.resolve(() => {})) },
}));

const EXISTING_SUMMARY = {
  id: 'poll-1',
  title: 'Kaydedilmiş yarışma',
  type: POLL_TYPE_VALUE.contest,
  creatorEmail: 'creator@openquiz.test',
  questionCount: 1,
};

const EXISTING_POLL = {
  ...EXISTING_SUMMARY,
  questions: [{
    id: 'q0',
    orderIndex: 0,
    text: 'Var olan soru',
    questionType: QUESTION_TYPE_VALUE.multiple,
    correctOptionIndex: 0,
    options: [{ id: 'o0', orderIndex: 0, text: 'A' }, { id: 'o1', orderIndex: 1, text: 'B' }],
  }],
};

const titleField = () => screen.getByPlaceholderText('Örn: Genel Kültür Yarışması');

describe('tab bar create flow', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'creator@openquiz.test', canCreate: true, isAdmin: false },
      loading: false,
      logout: vi.fn(),
    });
    pollService.list.mockResolvedValue({
      items: [EXISTING_SUMMARY],
      page: 1,
      pageSize: 24,
      totalCount: 1,
      hasMore: false,
    });
    // The list only carries summaries, so the editor fetches the questions.
    pollService.get.mockResolvedValue(EXISTING_POLL);
  });

  it('opens a blank create form from the Create tab', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Kaydedilmiş yarışma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Oluştur/ }));

    expect(await screen.findByRole('heading', { name: /Yarışma Oluştur/ })).toBeInTheDocument();
    expect(titleField()).toHaveValue('');
  });

  it('does not reopen a poll that was left mid-edit', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Düzenle' }));
    await waitFor(() => expect(titleField()).toHaveValue('Kaydedilmiş yarışma'));

    await user.click(screen.getByRole('button', { name: /Ana Sayfa/ }));
    await user.click(screen.getByRole('button', { name: /Oluştur/ }));

    expect(titleField()).toHaveValue('');
  });
});
