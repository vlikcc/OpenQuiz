import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordScreen from './ResetPasswordScreen';
import { authService } from '../services/authService';
import { tokenStore } from '../services/tokenStore';

vi.mock('../services/authService', () => ({
  authService: { passwordResetConfirm: vi.fn() },
}));

vi.mock('../services/tokenStore', () => ({
  tokenStore: { clear: vi.fn() },
}));

describe('ResetPasswordScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses to submit when the link has no token', () => {
    render(<ResetPasswordScreen token="" onFinished={vi.fn()} />);

    expect(screen.getByText('Bu sıfırlama bağlantısı eksik veya geçersiz.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Yeni şifre')).not.toBeInTheDocument();
  });

  it('blocks a mismatched confirmation', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordScreen token="tok-1" onFinished={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Yeni şifre'), 'Sup3rSecret!');
    await user.type(screen.getByPlaceholderText('Şifreyi doğrula'), 'different1');
    await user.click(screen.getByRole('button', { name: 'Şifreyi kaydet' }));

    expect(screen.getByText('Şifreler eşleşmiyor')).toBeInTheDocument();
    expect(authService.passwordResetConfirm).not.toHaveBeenCalled();
  });

  it('sends the token, clears any leftover session and offers sign-in', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    authService.passwordResetConfirm.mockResolvedValue(undefined);

    render(<ResetPasswordScreen token="tok-1" onFinished={onFinished} />);

    await user.type(screen.getByPlaceholderText('Yeni şifre'), 'Sup3rSecret!');
    await user.type(screen.getByPlaceholderText('Şifreyi doğrula'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Şifreyi kaydet' }));

    expect(authService.passwordResetConfirm).toHaveBeenCalledWith('tok-1', 'Sup3rSecret!');
    expect(tokenStore.clear).toHaveBeenCalled();
    expect(await screen.findByText(/Şifreniz güncellendi/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Giriş ekranına git' }));
    expect(onFinished).toHaveBeenCalled();
  });

  it('keeps the form and shows the API error when the token is spent', async () => {
    const user = userEvent.setup();
    authService.passwordResetConfirm.mockRejectedValue(new Error('Invalid or expired reset token.'));

    render(<ResetPasswordScreen token="spent" onFinished={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Yeni şifre'), 'Sup3rSecret!');
    await user.type(screen.getByPlaceholderText('Şifreyi doğrula'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Şifreyi kaydet' }));

    expect(await screen.findByText('Invalid or expired reset token.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Şifreyi kaydet' })).toBeInTheDocument();
  });
});
