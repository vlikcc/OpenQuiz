import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileScreen from './ProfileScreen';

vi.mock('../hooks/useEntitlements', () => ({
  useEntitlements: () => ({ can: () => true, plan: null, entitlements: null, loading: false }),
}));
vi.mock('../services/brandingService', () => ({
  brandingService: { getMine: vi.fn(() => Promise.resolve(null)) },
}));
vi.mock('../services/infoService', () => ({
  infoService: { get: vi.fn(() => Promise.resolve({ name: 'OpenQuiz API', version: '1.0.0', phase: 'session-product' })) },
}));

describe('ProfileScreen', () => {
  it('no longer offers notifications, and still has help and appearance', () => {
    render(
      <ProfileScreen
        user={{ displayName: 'Ada', email: 'ada@openquiz.test' }}
        isAdmin={false}
        onLogout={vi.fn()}
        onNavigateToAdmin={vi.fn()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.queryByText('Bildirimler')).not.toBeInTheDocument();
    expect(screen.getByText('Görünüm')).toBeInTheDocument();
    expect(screen.getByText('Yardım')).toBeInTheDocument();
    expect(screen.getByText('Hakkında')).toBeInTheDocument();
  });
});
