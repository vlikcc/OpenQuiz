#!/usr/bin/env node
// Fails the build when something heavy creeps back onto the initial download.
// Route-level code splitting is easy to undo by accident: one plain `import`
// at the top of App.jsx silently drags a whole vendor chunk along with it.
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const ASSETS = join(DIST, 'assets');

// Chunks that must stay behind a dynamic import.
const DEFERRED_CHUNKS = [
  'vendor-charts',
  'vendor-katex',
  'vendor-office',
  'vendor-pdf',
  'vendor-wordcloud',
];

const MAX_INITIAL_GZIP_KB = 160;

function entryChunk() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const match = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
  if (!match) throw new Error('Could not find the entry script in dist/index.html.');
  return match[1];
}

/** The chunks the browser must fetch before it can render anything. */
function initialGraph(entry) {
  const seen = new Set();
  const queue = [entry];

  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);

    const source = readFileSync(join(ASSETS, name), 'utf8');
    for (const [, imported] of source.matchAll(/from"\.\/([^"]+\.js)"/g)) {
      queue.push(imported);
    }
  }

  return seen;
}

function gzipKb(files) {
  const total = files.reduce((sum, name) => sum + gzipSync(readFileSync(join(ASSETS, name))).length, 0);
  return total / 1024;
}

const entry = entryChunk();
const initial = [...initialGraph(entry)];

const leaked = initial.filter((name) => DEFERRED_CHUNKS.some((chunk) => name.startsWith(`${chunk}-`)));
const css = readdirSync(ASSETS).filter((n) => n.startsWith('index-') && n.endsWith('.css'));
const totalKb = gzipKb([...initial, ...css]);

console.log(`Initial chunks (${initial.length}):`);
for (const name of initial.sort()) console.log(`  ${name}  ${gzipKb([name]).toFixed(1)} kB gzip`);
console.log(`Initial payload: ${totalKb.toFixed(1)} kB gzip (budget ${MAX_INITIAL_GZIP_KB} kB)`);

const failures = [];
if (leaked.length > 0) {
  failures.push(`These chunks must stay lazily loaded but are on the initial path: ${leaked.join(', ')}`);
}
if (totalKb > MAX_INITIAL_GZIP_KB) {
  failures.push(`Initial payload is ${totalKb.toFixed(1)} kB gzip, over the ${MAX_INITIAL_GZIP_KB} kB budget.`);
}

if (failures.length > 0) {
  console.error(`\nBundle budget failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}

console.log('Bundle budget OK.');
