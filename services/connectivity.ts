/** Last-known API health from bootstrap (in-memory, not persisted). */

export type ApiHealthSnapshot = {
  ok: boolean;
  supabase: boolean;
  /** @deprecated use llm */
  groq: boolean;
  /** @deprecated use palmVision */
  palmGroq: boolean;
  llm: boolean;
  palmVision: boolean;
  checkedAt: number;
};

let snapshot: ApiHealthSnapshot | null = null;

export function setApiHealth(data: {
  supabase?: boolean;
  groq?: boolean;
  palm_groq?: boolean;
  llm?: boolean;
  palm_vision?: boolean;
}) {
  const llm = Boolean(data.llm ?? data.groq);
  const palmVision = Boolean(data.palm_vision ?? data.palm_groq);
  snapshot = {
    ok: true,
    supabase: Boolean(data.supabase),
    groq: llm,
    palmGroq: palmVision,
    llm,
    palmVision,
    checkedAt: Date.now(),
  };
}

export function setApiHealthFailed() {
  snapshot = {
    ok: false,
    supabase: false,
    groq: false,
    palmGroq: false,
    llm: false,
    palmVision: false,
    checkedAt: Date.now(),
  };
}

export function getApiHealth(): ApiHealthSnapshot | null {
  return snapshot;
}
