import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import JoinByCodeForm from './JoinByCodeForm';

describe('JoinByCodeForm', () => {
  it('sends a typed room code to the voter screen', async () => {
    const onJoin = vi.fn();
    render(<JoinByCodeForm onJoin={onJoin} />);

    const join = screen.getByRole('button', { name: 'Katıl' });
    await userEvent.type(screen.getByLabelText(/Oda kodunu girin/), 'ab-c1');
    expect(join).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Oda kodunu girin/), '23{Enter}');
    expect(onJoin).toHaveBeenCalledWith(`${window.location.origin}/?mode=voter&code=ABC123`);
  });
});
