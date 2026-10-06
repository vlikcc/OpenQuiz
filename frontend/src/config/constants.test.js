import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_TYPES } from './constants';

const SOURCE_ROOT = resolve(process.cwd(), 'src');

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.jsx?$/.test(entry) && !entry.endsWith('.test.js') && !entry.endsWith('.test.jsx')) yield path;
  }
}

describe('content type styling', () => {
  it.each(Object.entries(CONTENT_TYPES))('%s ships literal Tailwind classes', (_key, config) => {
    expect(config.classes).toBeDefined();

    for (const variant of ['solid', 'soft', 'badge']) {
      const value = config.classes[variant];
      expect(value).toEqual(expect.stringContaining(config.color));
      expect(value).not.toContain('${');
    }
  });

  // Tailwind's JIT only emits classes it finds as complete literals, so a class
  // name built at runtime silently renders unstyled in a production build.
  it('no component builds a Tailwind class from an interpolated value', () => {
    const offenders = [];

    for (const file of sourceFiles(SOURCE_ROOT)) {
      const contents = readFileSync(file, 'utf8');
      for (const [index, line] of contents.split('\n').entries()) {
        if (/(?:bg|text|border|ring|from|to|via)-\$\{/.test(line)) {
          offenders.push(`${file.replace(`${SOURCE_ROOT}/`, '')}:${index + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
