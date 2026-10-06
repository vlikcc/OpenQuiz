import { describe, expect, it } from 'vitest';
import { isBillingContactSearch, planFromSearch } from './billingRoute';

describe('isBillingContactSearch', () => {
  it('matches the query ManualPaymentProvider emits', () => {
    expect(isBillingContactSearch('?billing=contact&plan=pro')).toBe(true);
    expect(isBillingContactSearch('billing=contact')).toBe(true);
  });

  it('rejects neighbouring queries', () => {
    expect(isBillingContactSearch('')).toBe(false);
    expect(isBillingContactSearch('?mode=voter&id=1')).toBe(false);
    expect(isBillingContactSearch('?billing=checkout&plan=pro')).toBe(false);
  });
});

describe('planFromSearch', () => {
  it('reads the plan the checkout URL puts on the query', () => {
    expect(planFromSearch('?billing=contact&plan=pro')).toBe('pro');
    expect(planFromSearch('plan=team%2Bplus')).toBe('team+plus');
    expect(planFromSearch('')).toBe('');
  });
});
