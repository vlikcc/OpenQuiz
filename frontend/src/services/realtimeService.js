import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../config/constants';
import { tokenStore } from './tokenStore';

let connection = null;
let connectPromise = null;
const subscriptions = new Map(); // pollId -> Set<handlers>
const hostPolls = new Set(); // pollIds whose presenter screen is open

function ensureConnection() {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/poll`, {
      accessTokenFactory: () => tokenStore.getAccessToken() || '',
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  const dispatch = (event, ...args) => {
    subscriptions.forEach((handlers) => {
      handlers.forEach((h) => {
        const fn = h[event];
        if (fn) {
          try { fn(...args); } catch (e) { console.error('realtime handler error', e); }
        }
      });
    });
  };

  connection.on('PollUpdated', (poll) => dispatch('onPollUpdated', poll));
  connection.on('VoteCountsUpdated', (agg) => dispatch('onVoteCountsUpdated', agg));
  connection.on('WordCloudUpdated', (payload) => dispatch('onWordCloudUpdated', payload));
  connection.on('ReactionBurst', (r) => dispatch('onReaction', r));
  connection.on('OpenAnswerSubmitted', (e) => dispatch('onOpenAnswerSubmitted', e));
  connection.on('LeaderboardUpdated', (payload) => dispatch('onLeaderboardUpdated', payload));

  connection.onreconnected(async () => {
    // Re-join all rooms we still care about.
    for (const pollId of subscriptions.keys()) {
      try { await connection.invoke('JoinPoll', pollId); } catch { /* ignored */ }
    }
    for (const pollId of hostPolls) {
      try { await connection.invoke('JoinHost', pollId); } catch { /* ignored */ }
    }
    // Whatever was broadcast while the connection was down is gone for good.
    dispatch('onReconnected');
  });

  return connection;
}

async function start() {
  ensureConnection();
  if (connection.state === signalR.HubConnectionState.Connected) return;
  if (!connectPromise) connectPromise = connection.start().catch((e) => { connectPromise = null; throw e; });
  await connectPromise;
  connectPromise = null;
}

export const realtimeService = {
  /**
   * @param {string} pollId
   * @param {object} handlers
   * @param {{ asHost?: boolean }} [options] Presenter screens pass asHost so
   *   standings and tallies land here instead of on every phone in the room.
   */
  async subscribe(pollId, handlers, { asHost = false } = {}) {
    if (!pollId) return () => {};
    let set = subscriptions.get(pollId);
    if (!set) { set = new Set(); subscriptions.set(pollId, set); }
    set.add(handlers);
    if (asHost) hostPolls.add(pollId);

    try {
      await start();
      await connection.invoke('JoinPoll', pollId);
      if (asHost) await connection.invoke('JoinHost', pollId);
    } catch (e) {
      console.warn('signalr subscribe failed', e);
    }

    return () => {
      set.delete(handlers);
      if (set.size === 0) {
        const wasHost = hostPolls.delete(pollId);
        subscriptions.delete(pollId);
        if (connection && connection.state === signalR.HubConnectionState.Connected) {
          connection.invoke('LeavePoll', pollId).catch(() => {});
          if (wasHost) connection.invoke('LeaveHost', pollId).catch(() => {});
        }
      }
    };
  },

  async stop() {
    if (connection) {
      try { await connection.stop(); } catch { /* noop */ }
      connection = null;
    }
    hostPolls.clear();
  },
};
