/** Last-known API health from bootstrap (in-memory, not persisted). */

export type ApiHealthSnapshot = {
  ok: boolean;
  supabase: boolean;
  llm: boolean;
  palmVision: boolean;
  chatModel?: string | null;
  visionModel?: string | null;
  checkedAt: number;
};

let snapshot: ApiHealthSnapshot | null = null;

export function setApiHealth(data: {
  supabase?: boolean;
  llm?: boolean;
  palm_vision?: boolean;
  chat_model?: string | null;
  vision_model?: string | null;
}) {
  snapshot = {
    ok: true,
    supabase: Boolean(data.supabase),
    llm: Boolean(data.llm),
    palmVision: Boolean(data.palm_vision),
    chatModel: data.chat_model ?? null,
    visionModel: data.vision_model ?? null,
    checkedAt: Date.now(),
  };
}

export function setApiHealthFailed() {
  snapshot = {
    ok: false,
    supabase: false,
    llm: false,
    palmVision: false,
    checkedAt: Date.now(),
  };
}

export function getApiHealth(): ApiHealthSnapshot | null {
  return snapshot;
}
