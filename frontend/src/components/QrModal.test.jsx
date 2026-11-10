import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QrModal from './QrModal';
import { pollService } from '../services/pollService';
import { infoService } from '../services/infoService';

vi.mock('../services/pollService', () => ({
  pollService: { get: vi.fn() },
}));
vi.mock('../services/infoService', () => ({
  infoService: { get: vi.fn() },
}));
vi.mock('../services/realtimeService', () => ({
  realtimeService: { subscribe: vi.fn(() => Promise.resolve(() => {})) },
}));
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,qq')) },
}));

describe('QrModal', () => {
  beforeEach(() => {
    pollService.get.mockResolvedValue({
      id: 'poll-1',
      title: 'Oda',
      joinCode: 'ABC123',
      participantCount: 2,
    });
    infoService.get.mockResolvedValue({ publicUrl: 'https://quiz.example.com' });
  });

  it('renders a local data-URL QR and never talks to qrserver', async () => {
    const { container } = render(
      <QrModal pollId="poll-1" title="Oda" joinCode="ABC123" onClose={() => {}} />,
    );

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    await waitFor(() => {
      const img = container.querySelector('img[src^="data:image/png"]');
      expect(img).toBeTruthy();
    });
    expect(container.innerHTML).not.toContain('qrserver');
    expect(screen.getByRole('button', { name: 'Katılım linkini kopyala' })).toBeInTheDocument();
  });

  it('points phones at the public address when the presenter is on localhost', async () => {
    render(<QrModal pollId="poll-1" title="Oda" joinCode="ABC123" onClose={() => {}} />);

    expect(await screen.findByDisplayValue('https://quiz.example.com/?mode=voter&code=ABC123')).toBeInTheDocument();
    expect(screen.queryByText('Telefonlar bu adresi açamaz')).not.toBeInTheDocument();
  });

  it('warns when no address a phone could reach is known', async () => {
    infoService.get.mockResolvedValue({ publicUrl: 'http://localhost:8080' });
    render(<QrModal pollId="poll-1" title="Oda" joinCode="ABC123" onClose={() => {}} />);

    expect(await screen.findByText('Telefonlar bu adresi açamaz')).toBeInTheDocument();
  });
});
