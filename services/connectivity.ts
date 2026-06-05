/** Last-known API health from bootstrap (in-memory, not persisted). */

export type ApiHealthSnapshot = {
  ok: boolean;
  supabase: boolean;
  groq: boolean;
  /** True when server can attempt vision palm read (Groq key + PALM_ANALYSIS_MODE=groq). */
  palmGroq: boolean;
  checkedAt: number;
};

let snapshot: ApiHealthSnapshot | null = null;

export function setApiHealth(data: { supabase?: boolean; groq?: boolean; palm_groq?: boolean }) {
  snapshot = {
    ok: true,
    supabase: Boolean(data.supabase),
    groq: Boolean(data.groq),
    palmGroq: Boolean(data.palm_groq),
    checkedAt: Date.now(),
  };
}

export function setApiHealthFailed() {
  snapshot = {
    ok: false,
    supabase: false,
    groq: false,
    palmGroq: false,
    checkedAt: Date.now(),
  };
}

export function getApiHealth(): ApiHealthSnapshot | null {
  return snapshot;
}
