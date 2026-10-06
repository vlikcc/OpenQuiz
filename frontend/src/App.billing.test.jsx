import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { pollService } from './services/pollService';
import { useAuth } from './hooks/useAuth';

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

const signedIn = {
  user: { id: 'u1', email: 'creator@openquiz.test', canCreate: true, isAdmin: false },
  loading: false,
  logout: vi.fn(),
};

describe('manual checkout contact screen', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'http://localhost:3000/?billing=contact&plan=pro');
    pollService.list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 24,
      totalCount: 0,
      hasMore: false,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', 'http://localhost:3000/');
  });

  it('shows the contact screen after the checkout redirect', async () => {
    useAuth.mockReturnValue(signedIn);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Ödemeyi biz tamamlarız' })).toBeInTheDocument();
    expect(screen.getByText('creator@openquiz.test')).toBeInTheDocument();
  });

  it('strips the query and returns to the app', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue(signedIn);
    render(<App />);

    await screen.findByRole('heading', { name: 'Ödemeyi biz tamamlarız' });
    await user.click(screen.getByRole('button', { name: 'Uygulamaya dön' }));

    expect(window.location.search).toBe('');
    expect(screen.queryByRole('heading', { name: 'Ödemeyi biz tamamlarız' })).not.toBeInTheDocument();
  });
});
