import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { pollService } from '../services/pollService';
import { POLL_TYPE_VALUE } from '../config/constants';
import { EntitlementKeys } from '../config/entitlementKeys';

vi.mock('../services/pollService', () => ({
  pollService: { list: vi.fn(), get: vi.fn(), remove: vi.fn(), duplicate: vi.fn(), resetResults: vi.fn(), enableResultsShare: vi.fn() },
}));
vi.mock('../services/questionBankService', () => ({
  questionBankService: { list: vi.fn(() => Promise.resolve([])), create: vi.fn(), remove: vi.fn() },
  bankItemToDraft: (item) => item,
  draftToBankRequest: (q) => q,
}));

vi.mock('./ResultsAnalysis', () => ({
  default: ({ poll, onClose }) => (
    <div>
      <h2>Analiz: {poll.title}</h2>
      <button type="button" onClick={onClose}>Kapat</button>
    </div>
  ),
}));

const summary = (n) => ({
  id: `poll-${n}`,
  title: `Yarışma ${n}`,
  type: POLL_TYPE_VALUE.contest,
  creatorEmail: 'creator@openquiz.test',
  questionCount: 3,
});

const page = (items, hasMore) => ({ items, page: 1, pageSize: 24, totalCount: 30, hasMore });

function renderDashboard(props = {}) {
  return render(
    <Dashboard
      onNavigate={vi.fn()}
      user={{ email: 'creator@openquiz.test' }}
      showToast={vi.fn()}
      isAdmin={false}
      isAuthorized
      composer={null}
      setComposer={vi.fn()}
      {...props}
    />,
  );
}

describe('poll list paging', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appends the next page instead of replacing the visible one', async () => {
    const user = userEvent.setup();
    // Keyed on the requested page so the test also proves which page was asked for.
    pollService.list.mockImplementation(({ page: requested }) =>
      Promise.resolve(
        requested === 1 ? page([summary(1), summary(2)], true) : page([summary(3)], false),
      ),
    );

    renderDashboard();

    expect(await screen.findByText('Yarışma 1')).toBeInTheDocument();
    expect(screen.queryByText('Yarışma 3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Daha fazla/ }));

    expect(await screen.findByText('Yarışma 3')).toBeInTheDocument();
    expect(screen.getByText('Yarışma 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Daha fazla/ })).not.toBeInTheDocument();
  });

  it('does not offer more pages when the first one is the whole list', async () => {
    pollService.list.mockResolvedValue(page([summary(1)], false));

    renderDashboard();

    expect(await screen.findByText('Yarışma 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Daha fazla/ })).not.toBeInTheDocument();
  });

  it('shows the question count the summary reports', async () => {
    pollService.list.mockResolvedValue(page([summary(1)], false));

    renderDashboard();

    expect(await screen.findByText('3 Soru')).toBeInTheDocument();
  });

  it('hides edit and delete for a poll shared with the viewer', async () => {
    pollService.list.mockResolvedValue(page([{
      ...summary(1),
      isCollaborator: true,
      creatorEmail: 'owner@openquiz.test',
    }], false));

    renderDashboard();
    await screen.findByText('Yarışma 1');

    expect(screen.getByText('Paylaşıldı')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sil' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yönet ve Sun/ })).toBeInTheDocument();
  });
});

describe('copying a poll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('names the copy, reports it and reloads the first page', async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    pollService.list.mockResolvedValue(page([summary(1)], false));
    pollService.duplicate.mockResolvedValue({ id: 'poll-copy', title: 'Yarışma 1 (kopya)' });

    renderDashboard({ showToast });
    await screen.findByText('Yarışma 1');

    await user.click(screen.getByRole('button', { name: 'Kopyasını oluştur' }));

    expect(pollService.duplicate).toHaveBeenCalledWith('poll-1', 'Yarışma 1 (kopya)');
    expect(showToast).toHaveBeenCalledWith('"Yarışma 1 (kopya)" oluşturuldu');
    // Once on mount and once after the copy: the new poll has to show up.
    expect(pollService.list).toHaveBeenCalledTimes(2);
  });

  it('keeps the list intact and says so when the copy fails', async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    pollService.list.mockResolvedValue(page([summary(1)], false));
    pollService.duplicate.mockRejectedValue(new Error('Not the owner of this poll.'));

    renderDashboard({ showToast });
    await screen.findByText('Yarışma 1');

    await user.click(screen.getByRole('button', { name: 'Kopyasını oluştur' }));

    expect(showToast).toHaveBeenCalledWith('Not the owner of this poll.', 'error');
    expect(screen.getByText('Yarışma 1')).toBeInTheDocument();
  });

  it('does not offer the copy button to accounts that cannot author', async () => {
    pollService.list.mockResolvedValue(page([summary(1)], false));

    renderDashboard({ isAuthorized: false });
    await screen.findByText('Yarışma 1');

    expect(screen.queryByRole('button', { name: 'Kopyasını oluştur' })).not.toBeInTheDocument();
  });
});

describe('clearing results', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks first, clears the poll and reloads the list', async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    pollService.list.mockResolvedValue(page([summary(1)], false));
    pollService.resetResults.mockResolvedValue({ ...summary(1), status: 0 });

    renderDashboard({ showToast });
    await screen.findByText('Yarışma 1');

    await user.click(screen.getByRole('button', { name: 'Sonuçları temizle' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Yarışma 1'));
    expect(pollService.resetResults).toHaveBeenCalledWith('poll-1');
    expect(showToast).toHaveBeenCalledWith('Sonuçlar temizlendi. İçerik yeniden uygulanmaya hazır.');
    expect(pollService.list).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it('leaves the results alone when the owner backs out', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    pollService.list.mockResolvedValue(page([summary(1)], false));

    renderDashboard();
    await screen.findByText('Yarışma 1');

    await user.click(screen.getByRole('button', { name: 'Sonuçları temizle' }));

    expect(pollService.resetResults).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('is not offered on a poll shared with the viewer', async () => {
    pollService.list.mockResolvedValue(page([{
      ...summary(1),
      isCollaborator: true,
      creatorEmail: 'owner@openquiz.test',
    }], false));

    renderDashboard();
    await screen.findByText('Yarışma 1');

    expect(screen.queryByRole('button', { name: 'Sonuçları temizle' })).not.toBeInTheDocument();
  });
});

describe('content-type gates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks exam create when the plan does not include it', async () => {
    const user = userEvent.setup();
    const setComposer = vi.fn();
    pollService.list.mockResolvedValue(page([], false));

    renderDashboard({
      can: (key) => key !== EntitlementKeys.ContentExam,
      setComposer,
    });

    await user.click(await screen.findByRole('button', { name: /Sınav/ }));

    expect(setComposer).not.toHaveBeenCalled();
    expect(screen.getByText(/Sınav modu mevcut planınızda yok/)).toBeInTheDocument();
  });
});

describe('opening the analysis screen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the poll and overlays the report', async () => {
    const user = userEvent.setup();
    pollService.list.mockResolvedValue(page([summary(1)], false));
    pollService.get.mockResolvedValue({ ...summary(1), questions: [] });

    renderDashboard();
    await screen.findByText('Yarışma 1');

    await user.click(screen.getByRole('button', { name: 'Sonuçlar' }));

    expect(pollService.get).toHaveBeenCalledWith('poll-1');
    expect(await screen.findByRole('heading', { name: 'Analiz: Yarışma 1' })).toBeInTheDocument();
  });
});
