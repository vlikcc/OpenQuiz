import { useEntitlements } from '../hooks/useEntitlements';

/**
 * Renders children only when the signed-in user's plan includes
 * `feature`, otherwise renders `fallback` (or nothing). This is UX, not
 * enforcement — the server rejects the same feature with a 402 regardless of
 * what this component decides to show. See PollService's entitlement checks.
 */
export default function Gate({ feature, fallback = null, children }) {
  const { can } = useEntitlements();
  return can(feature) ? children : fallback;
}
