import { describe, expect, it } from 'vitest';
import { isPasswordResetPath, resetTokenFromSearch } from './resetRoute';

describe('isPasswordResetPath', () => {
  it('accepts the path the reset e-mail uses', () => {
    expect(isPasswordResetPath('/reset-password')).toBe(true);
    expect(isPasswordResetPath('/reset-password/')).toBe(true);
    expect(isPasswordResetPath('reset-password')).toBe(true);
  });

  it('rejects neighbouring routes', () => {
    expect(isPasswordResetPath('/')).toBe(false);
    expect(isPasswordResetPath('/dashboard')).toBe(false);
    expect(isPasswordResetPath('/reset-password/extra')).toBe(false);
  });
});

describe('resetTokenFromSearch', () => {
  it('reads the token query the mail puts on the URL', () => {
    expect(resetTokenFromSearch('?token=abc%2B1')).toBe('abc+1');
    expect(resetTokenFromSearch('mode=voter&token=raw')).toBe('raw');
    expect(resetTokenFromSearch('')).toBe('');
  });
});
