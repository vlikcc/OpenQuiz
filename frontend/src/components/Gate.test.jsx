import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Gate from './Gate';
import { useEntitlements } from '../hooks/useEntitlements';

vi.mock('../hooks/useEntitlements', () => ({
  useEntitlements: vi.fn(),
}));

describe('Gate', () => {
  it('renders children when the plan includes the feature', () => {
    useEntitlements.mockReturnValue({ can: (key) => key === 'reports.export' });

    render(
      <Gate feature="reports.export">
        <button type="button">CSV</button>
      </Gate>,
    );

    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
  });

  it('renders the fallback when the plan does not include the feature', () => {
    useEntitlements.mockReturnValue({ can: () => false });

    render(
      <Gate feature="reports.export" fallback={<p>Locked</p>}>
        <button type="button">CSV</button>
      </Gate>,
    );

    expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});
