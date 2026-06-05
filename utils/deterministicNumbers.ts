/** Small deterministic spread from a string seed (deterministic UX, not cryptography). */
export function seedDigits(seed: string, count: number) {
  const out: number[] = [];
  let hash = 0;
  const s = `${seed}agastya`;
  for (let i = 0; i < s.length; i++) hash = Math.imul(31, hash) + s.charCodeAt(i)!;
  for (let n = 0; n < count; n++) {
    hash = Math.imul(1103515245, hash + n) + 12345;
    out.push(Math.abs(hash % 997) / 996);
  }
  return out;
}

export function inRange(t: number, min: number, max: number) {
  return Math.round(min + t * (max - min));
}
