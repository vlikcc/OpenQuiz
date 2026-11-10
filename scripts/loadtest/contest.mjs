#!/usr/bin/env node
// Plays a self-paced contest with a full room against a running OpenQuiz:
// every participant opens the hub, joins and answers every question the way
// the phone app does, while one presenter connection watches the standings.
//
//   node scripts/loadtest/contest.mjs --base http://localhost:8080 \
//     --email admin@example.com --password '...' --participants 1000
//
// The account must be allowed to create sessions. Everything runs from one
// machine, so the API sees the whole room behind a single address, the same
// way it sees a venue behind one Wi-Fi.

import { parseArgs } from 'node:util';

const { values: opts } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:8080' },
    email: { type: 'string' },
    password: { type: 'string' },
    register: { type: 'boolean', default: false },
    participants: { type: 'string', default: '1000' },
    questions: { type: 'string', default: '10' },
    'join-spread-ms': { type: 'string', default: '20000' },
    'think-min-ms': { type: 'string', default: '800' },
    'think-max-ms': { type: 'string', default: '3000' },
    'max-attempts': { type: 'string', default: '5' },
  },
});

const BASE = opts.base.replace(/\/$/, '');
const N = Number(opts.participants);
const Q = Number(opts.questions);
const JOIN_SPREAD_MS = Number(opts['join-spread-ms']);
const THINK_MIN_MS = Number(opts['think-min-ms']);
const THINK_MAX_MS = Number(opts['think-max-ms']);
const MAX_ATTEMPTS = Number(opts['max-attempts']);
const RS = '\x1e';
const STATUS_ENDED = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (min, max) => min + Math.random() * (max - min);

// ---- metrics ---------------------------------------------------------------

const latencies = new Map(); // endpoint -> ms[]
const statuses = new Map(); // "endpoint status" -> count
const bump = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function call(endpoint, path, { method = 'GET', body, token } = {}) {
  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      bump(statuses, `${endpoint} network-error`);
      if (attempt >= MAX_ATTEMPTS) return { ok: false, status: 0 };
      await sleep(1000 * attempt);
      continue;
    }
    const text = await res.text();
    if (!latencies.has(endpoint)) latencies.set(endpoint, []);
    latencies.get(endpoint).push(performance.now() - started);
    bump(statuses, `${endpoint} ${res.status}`);

    // A phone shows an error and the person taps again; a 409 is an answer
    // the server already settled, which tapping again would not change.
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      await sleep(1000 * attempt);
      continue;
    }
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { ok: res.ok, status: res.status, json };
  }
}

// ---- hub -------------------------------------------------------------------

async function connectHub(pollId, { token, onMessage } = {}) {
  const negotiate = await call('negotiate', '/hubs/poll/negotiate?negotiateVersion=1', { method: 'POST', token });
  if (!negotiate.ok) throw new Error(`negotiate ${negotiate.status}`);

  const wsBase = BASE.replace(/^http/, 'ws');
  const qs = new URLSearchParams({ id: negotiate.json.connectionToken });
  if (token) qs.set('access_token', token);
  const ws = new WebSocket(`${wsBase}/hubs/poll?${qs}`);
  const hub = { ws, messages: 0, bytes: 0, closed: false };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('websocket error'));
  });
  ws.onclose = () => { hub.closed = true; };
  ws.onmessage = (e) => {
    const data = String(e.data);
    hub.bytes += data.length;
    for (const frame of data.split(RS)) {
      if (!frame) continue;
      const msg = JSON.parse(frame);
      if (msg.type === 6 || msg.type === 3 || msg.type === undefined) continue;
      hub.messages++;
      onMessage?.(msg);
    }
  };
  ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS);
  ws.send(JSON.stringify({ type: 1, target: 'JoinPoll', arguments: [pollId] }) + RS);
  if (token) {
    // Standings and tallies only go to the host group, so a presenter
    // connection has to join it explicitly.
    ws.send(JSON.stringify({ type: 1, target: 'JoinHost', arguments: [pollId] }) + RS);
  }
  // The server drops a client it has not heard from in 30 seconds.
  hub.ping = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 6 }) + RS); }, 15000);
  return hub;
}

function closeHub(hub) {
  clearInterval(hub.ping);
  try { hub.ws.close(); } catch { /* already closed */ }
}

// ---- scenario --------------------------------------------------------------

async function signIn() {
  if (opts.register) {
    await call('register', '/api/auth/register', {
      method: 'POST', body: { email: opts.email, password: opts.password, displayName: 'Load test' },
    });
  }
  const login = await call('login', '/api/auth/login', { method: 'POST', body: { email: opts.email, password: opts.password } });
  if (!login.ok) throw new Error(`login failed: ${login.status}`);
  return login.json.accessToken;
}

async function createContest(token) {
  const questions = Array.from({ length: Q }, (_, i) => ({
    orderIndex: i,
    text: `Soru ${i + 1}`,
    imageUrl: null,
    timeLimit: 30,
    questionType: 1,
    allowMultiple: false,
    correctOptionIndex: 0,
    correctAnswer: null,
    points: 10,
    maxWords: null,
    wordCloudConfig: null,
    options: [0, 1, 2, 3].map((o) => ({ orderIndex: o, text: `Seçenek ${o + 1}` })),
  }));
  const res = await call('create', '/api/polls', {
    method: 'POST', token,
    body: { title: `Yük testi ${new Date().toISOString()}`, type: 1, selfPaced: true, questions },
  });
  if (!res.ok) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json;
}

async function participant(i, poll, startSignal, results) {
  const name = `Katılımcı ${i}`;
  const me = { name, finished: false, sawEnd: false, hub: null, error: null };
  results.push(me);
  try {
    await sleep(between(0, JOIN_SPREAD_MS));
    await call('get-by-code', `/api/polls/code/${poll.joinCode}`);
    me.hub = await connectHub(poll.id, {
      onMessage: (msg) => {
        if (msg.target === 'PollUpdated' && msg.arguments?.[0]?.status === STATUS_ENDED) me.sawEnd = true;
      },
    });
    const joined = await call('join', `/api/polls/${poll.id}/join`, { method: 'POST', body: { userName: name } });
    if (!joined.ok) throw new Error(`join ${joined.status}`);

    await startSignal;
    const progress = await call('progress', `/api/polls/${poll.id}/progress`, { method: 'POST', body: { userName: name } });
    let index = progress.json?.questionIndex ?? 0;
    while (index < Q) {
      await sleep(between(THINK_MIN_MS, THINK_MAX_MS));
      const choice = Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3);
      const vote = await call('vote', `/api/polls/${poll.id}/votes`, {
        method: 'POST',
        body: { questionIndex: index, selectedIndices: [choice], responseTimeMs: null, userName: name },
      });
      if (vote.ok || vote.status === 409) { index++; continue; }
      throw new Error(`vote ${vote.status}`);
    }
    me.finished = true;
  } catch (err) {
    me.error = err.message;
  }
}

function report(title, extra) {
  console.log(`\n=== ${title} ===`);
  const rows = [...latencies.entries()].map(([endpoint, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      endpoint,
      count: sorted.length,
      p50: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
      p99: Math.round(percentile(sorted, 99)),
      max: Math.round(sorted.at(-1) ?? 0),
    };
  });
  console.table(rows);
  console.table([...statuses.entries()].sort().map(([key, count]) => ({ key, count })));
  console.log(JSON.stringify(extra, null, 2));
}

async function main() {
  const token = await signIn();
  const poll = await createContest(token);
  console.log(`contest ${poll.joinCode} (${poll.id}): ${N} participants x ${Q} questions`);

  let lastProgress = null;
  let presenterUpdates = 0;
  const presenter = await connectHub(poll.id, {
    token,
    onMessage: (msg) => {
      if (msg.target !== 'LeaderboardUpdated') return;
      presenterUpdates++;
      if (msg.arguments?.[0]?.progress) lastProgress = msg.arguments[0].progress;
    },
  });

  let start;
  const startSignal = new Promise((r) => { start = r; });
  const results = [];
  const tJoin = performance.now();
  const players = Array.from({ length: N }, (_, i) => participant(i + 1, poll, startSignal, results));

  // Start once the room has filled, as a presenter watching the count would.
  for (let waited = 0; waited < JOIN_SPREAD_MS + 60000; waited += 500) {
    const current = await call('poll', `/api/polls/${poll.id}`, { token });
    if ((current.json?.participantCount ?? 0) >= N) break;
    if (results.filter((r) => r.error).length + (current.json?.participantCount ?? 0) >= N) break;
    await sleep(500);
  }
  const joinSeconds = (performance.now() - tJoin) / 1000;
  const activated = await call('activate', `/api/polls/${poll.id}/activate`, { method: 'POST', token });
  if (!activated.ok) throw new Error(`activate ${activated.status}`);
  const tPlay = performance.now();
  start();
  await Promise.all(players);
  const playSeconds = (performance.now() - tPlay) / 1000;

  // Self-paced standings are pulled on a timer rather than pushed per answer,
  // so the presenter's screen is checked the same way: poll until it catches up.
  const finishedCount = results.filter((r) => r.finished).length;
  for (let waited = 0; waited < 15000; waited += 500) {
    const snap = await call('progress-check', `/api/scores/progress?pollId=${poll.id}`, { token });
    if (snap.json) lastProgress = snap.json;
    if ((lastProgress?.finished ?? 0) >= finishedCount) break;
    await sleep(500);
  }

  const standings = await call('standings', `/api/scores?pollId=${poll.id}&top=5000`, { token });
  const rows = standings.json ?? [];
  const ordered = rows.every((row, i) => i === 0
    || rows[i - 1].points > row.points
    || (rows[i - 1].points === row.points && rows[i - 1].totalTimeMs <= row.totalTimeMs));

  await call('end', `/api/polls/${poll.id}/end`, { method: 'POST', token });
  await sleep(3000);

  const hubs = results.map((r) => r.hub).filter(Boolean);
  const errors = new Map();
  for (const r of results) if (r.error) bump(errors, r.error);

  report('result', {
    participants: N,
    joinedAndConnected: hubs.length,
    finishedAllQuestions: finishedCount,
    failed: Object.fromEntries(errors),
    joinSeconds: Number(joinSeconds.toFixed(1)),
    playSeconds: Number(playSeconds.toFixed(1)),
    presenter: { leaderboardUpdates: presenterUpdates, lastProgress, connectionClosed: presenter.closed },
    standings: { rows: rows.length, orderedByPointsThenTime: ordered },
    participantsWhoSawTheEnd: results.filter((r) => r.sawEnd).length,
    perParticipantHubTraffic: {
      avgMessages: Math.round(hubs.reduce((s, h) => s + h.messages, 0) / Math.max(1, hubs.length)),
      avgKilobytes: Math.round(hubs.reduce((s, h) => s + h.bytes, 0) / Math.max(1, hubs.length) / 1024),
      droppedConnections: hubs.filter((h) => h.closed).length,
    },
  });

  closeHub(presenter);
  hubs.forEach(closeHub);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
