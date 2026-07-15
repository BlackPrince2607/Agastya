/** Replace remaining hardcoded palette hex with theme import + colors.* */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const FILES = [
  'components/report/PalmLineOverlay.tsx',
  'components/layout/MainCosmicHeader.tsx',
  'components/onboarding/TrustBadgeRow.tsx',
  'components/onboarding/ReadingChecklist.tsx',
  'components/ui/AuraChip.tsx',
  'app/(main)/tasks.tsx',
  'app/report/index.tsx',
  'app/report/_layout.tsx',
  'app/onboarding/palm-scan.tsx',
  'app/(main)/chat.tsx',
];

const HEX_MAP = [
  ["'#a855f7'", 'colors.purple'],
  ['"#a855f7"', 'colors.purple'],
  ["'#d3beeb'", 'colors.primary'],
  ['"#d3beeb"', 'colors.primary'],
  ["'#c084fc'", 'colors.growth'],
  ['"#c084fc"', 'colors.growth'],
  ["'#22d3ee'", 'colors.cyan'],
  ['"#22d3ee"', 'colors.cyan'],
  ["'#f472b6'", 'colors.love'],
  ['"#f472b6"', 'colors.love'],
  ["'#0f0e10'", 'colors.surfaceLowest'],
  ['"#0f0e10"', 'colors.surfaceLowest'],
  ["'#4ade80'", 'colors.health'],
  ['"#4ade80"', 'colors.health'],
  ["'#ffffff'", 'colors.onPrimary'],
  ['"#ffffff"', 'colors.onPrimary'],
];

function ensureColorsImport(src, filePath) {
  if (src.includes("from '@/constants/theme'") || src.includes('from "@/constants/theme"')) {
    // Ensure colors is imported
    if (!/\bcolors\b/.test(src.split("from '@/constants/theme'")[0].slice(-80) + (src.includes('colors') ? 'colors' : ''))) {
      // broader check
    }
    if (!/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*'@\/constants\/theme'/.test(src)
      && !/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*"@\/constants\/theme"/.test(src)) {
      // add colors to existing theme import
      src = src.replace(
        /import\s*\{([^}]+)\}\s*from\s*'@\/constants\/theme'/,
        (m, inner) => `import { ${inner.includes('colors') ? inner : `colors, ${inner.trim()}`} } from '@/constants/theme'`,
      );
      src = src.replace(
        /import\s*\{([^}]+)\}\s*from\s*"@\/constants\/theme"/,
        (m, inner) => `import { ${inner.includes('colors') ? inner : `colors, ${inner.trim()}`} } from "@/constants/theme"`,
      );
    }
    return src;
  }
  // Insert after first import block
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) lastImport = i;
    else if (lastImport >= 0 && lines[i].trim() === '') break;
  }
  const insertAt = lastImport >= 0 ? lastImport + 1 : 0;
  lines.splice(insertAt, 0, "import { colors } from '@/constants/theme';");
  return lines.join('\n');
}

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log('skip missing', rel);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  for (const [hex, token] of HEX_MAP) {
    src = src.split(hex).join(token);
  }
  if (src !== before) {
    src = ensureColorsImport(src, file);
    // Fix common accidental double colors import commas
    src = src.replace(/import \{\s*colors,\s*colors,/g, 'import { colors,');
    fs.writeFileSync(file, src);
    console.log('updated', rel);
  } else {
    console.log('unchanged', rel);
  }
}
