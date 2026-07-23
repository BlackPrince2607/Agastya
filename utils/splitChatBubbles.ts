/**
 * Split a guide reply into SMS-style bubbles.
 * Prefer a single bubble; only split when the model used blank lines.
 */

const MAX_BUBBLES = 2;
/** Prefer packing another full sentence while under this length. */
const PACK_SOFT = 280;

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
    if (joined.length <= PACK_SOFT && current.split(/(?<=[.!?…])\s+/).length < 3) {
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
 * Prefer a single bubble. Only split on author blank-line paragraphs (max 2).
 * Never cut a sentence in half.
 */
export function splitIntoTextBubbles(text: string): string[] {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  if (paragraphs.length >= 2) {
    return mergeOverflow(paragraphs);
  }

  // Default: keep one coherent reply as a single bubble.
  const sole = paragraphs[0] ?? cleaned;
  if (sole.length <= PACK_SOFT) return [sole];

  const sentences = splitSentences(sole);
  if (sentences.length <= 1) return [sole];

  return mergeOverflow(packSentences(sentences));
}

/** Brief pause before showing a bubble after the API reply arrives. Keep snappy. */
export function typingDelayForBubble(text: string, index: number): number {
  if (index === 0) return Math.min(280, 120 + Math.round(text.length * 2));
  return Math.min(220, 80 + Math.round(text.length * 2));
}

export function pauseBetweenBubblesMs(): number {
  return 120;
}
