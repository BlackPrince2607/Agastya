/**
 * Mechanical design-system normalization across app/ + components/.
 * Safe class/token swaps only — does not rewrite layout structure.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = ['app', 'components'];

const SKIP_NAMES = new Set([
  'theme.ts',
  'stitchWelcome.ts',
  'GoogleLogo.tsx',
  'design-system-normalize.mjs',
]);

/** Ordered longest-first to avoid partial collisions. */
const REPLACEMENTS = [
  // Typography roles
  [/font-space-grotesk/g, 'font-label'],
  [/font-noto-serif-md/g, 'font-headline-md'],
  [/font-noto-serif\b/g, 'font-headline'],
  [/font-inter-medium/g, 'font-body-medium'],
  [/font-inter\b/g, 'font-body'],

  // Legacy color class tokens → Cosmic Essence
  [/text-md-on-surface-variant/g, 'text-on-surface-variant'],
  [/text-md-on-primary-container/g, 'text-on-primary-container'],
  [/text-md-on-background/g, 'text-on-surface'],
  [/text-md-primary\b/g, 'text-primary'],
  [/bg-md-primary\b/g, 'bg-primary'],
  [/text-stitch-signal/g, 'text-cyan'],
  [/bg-stitch-signal/g, 'bg-cyan'],
  [/border-stitch-signal/g, 'border-cyan'],
  [/text-stitch-violet/g, 'text-primary'],
  [/bg-stitch-violet/g, 'bg-primary'],
  [/border-stitch-violet/g, 'border-primary'],
  [/text-stitch-magenta/g, 'text-magenta'],
  [/bg-stitch-magenta/g, 'bg-magenta'],
  [/border-stitch-magenta/g, 'border-magenta'],
  [/text-mist(\/\d+)?/g, (_m, opacity) => (opacity ? `text-on-surface${opacity}` : 'text-on-surface')],
  [/bg-mist(\/\d+)?/g, (_m, opacity) => (opacity ? `bg-on-surface${opacity}` : 'bg-on-surface')],

  // Radii aligned to DS
  [/rounded-\[28px\]/g, 'rounded-glass'],
  [/rounded-\[18px\]/g, 'rounded-md'],

  // Component import paths kept; class name for glow cards when used as strings is rare
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !SKIP_NAMES.has(entry.name)) out.push(full);
  }
  return out;
}

let filesChanged = 0;
let replacements = 0;

for (const root of TARGETS) {
  const dir = path.join(ROOT, root);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const original = fs.readFileSync(file, 'utf8');
    let next = original;
    for (const [pattern, value] of REPLACEMENTS) {
      next = next.replace(pattern, value);
    }
    if (next !== original) {
      fs.writeFileSync(file, next, 'utf8');
      filesChanged += 1;
      const beforeLen = original.length;
      const afterLen = next.length;
      // rough count
      replacements += Math.abs(beforeLen - afterLen) > 0 ? 1 : 0;
      console.log('updated', path.relative(ROOT, file));
    }
  }
}

console.log(`\nDone. Files changed: ${filesChanged}`);
