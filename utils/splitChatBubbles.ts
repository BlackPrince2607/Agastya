/**
 * Split a guide reply into SMS-style bubbles.
 * Only breaks on blank lines or complete sentences — never mid-sentence / hard-wrap.
 */

const MAX_BUBBLES = 4;
/** Prefer packing another full sentence while under this length. */
const PACK_SOFT = 160;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(chunk: string): string[] {
  const parts = chunk.match(/[^.!?…]+(?:[.!?…]+["')\]]*)?/g);
  if (!parts) return [chunk.trim()].filter(Boolean);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Pack complete sentences into similar-length bubbles without truncating. */
function packSentences(sentences: string[]): string[] {
  if (!sentences.length) return [];
  const packed: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    const joined = `${current} ${sentence}`;
    // Keep 1–2 sentences together when they still feel like one text.
    if (joined.length <= PACK_SOFT && current.split(/(?<=[.!?…])\s+/).length < 2) {
      current = joined;
    } else {
      packed.push(current);
      current = sentence;
    }
  }
  if (current) packed.push(current);
  return packed;
}

function mergeOverflow(bubbles: string[]): string[] {
  if (bubbles.length <= MAX_BUBBLES) return bubbles;
  const head = bubbles.slice(0, MAX_BUBBLES - 1);
  const tail = bubbles.slice(MAX_BUBBLES - 1).join(' ');
  return [...head, tail];
}

/**
 * Prefer author blank-line paragraphs (complete thoughts).
 * Fall back to sentence packing — never cut a sentence in half.
 */
export function splitIntoTextBubbles(text: string): string[] {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  // Model followed the blank-line format → one bubble per paragraph (keeps thoughts intact).
  if (paragraphs.length >= 2) {
    return mergeOverflow(paragraphs);
  }

  const sole = paragraphs[0] ?? cleaned;
  const sentences = splitSentences(sole);
  if (sentences.length <= 1) return [sole];

  return mergeOverflow(packSentences(sentences));
}

/** Delay before showing a bubble — longer for longer text, still snappy. */
export function typingDelayForBubble(text: string, index: number): number {
  const base = index === 0 ? 420 : 320;
  const perChar = Math.min(700, Math.round(text.length * 8));
  return Math.min(1400, base + perChar);
}

export function pauseBetweenBubblesMs(): number {
  return 260;
}
