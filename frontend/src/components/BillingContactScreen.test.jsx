import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BillingContactScreen from './BillingContactScreen';

vi.mock('../config/constants', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, BILLING_CONTACT_EMAIL: 'billing@openquiz.test' };
});

describe('BillingContactScreen', () => {
  it('shows the requested plan and signed-in account', () => {
    render(
      <BillingContactScreen
        planCode="pro"
        user={{ id: 'u-1', email: 'creator@openquiz.test' }}
        onBack={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ödemeyi biz tamamlarız' })).toBeInTheDocument();
    expect(screen.getByText('İstenen plan')).toBeInTheDocument();
    expect(screen.getByText('creator@openquiz.test')).toBeInTheDocument();
    expect(screen.getByText(/Pro planını hesabınıza/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /E-posta gönder/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:billing@openquiz\.test\?/),
    );
  });

  it('copies the request and asks a signed-out visitor to sign in', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(
      <BillingContactScreen
        planCode="team"
        user={null}
        onBack={vi.fn()}
        onLogin={onLogin}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'İsteği kopyala' }));
    expect(await screen.findByRole('button', { name: 'Kopyalandı' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hesabınızı eşleştirmek için giriş yapın' }));
    expect(onLogin).toHaveBeenCalled();
  });
});
