export type SupabaseAuthSettings = {
  email: boolean;
  google: boolean;
  apple: boolean;
};

/** Read enabled auth providers from the public Supabase settings endpoint. */
export async function fetchSupabaseAuthSettings(): Promise<SupabaseAuthSettings | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      if (__DEV__) console.warn('[Agastya auth] settings', res.status);
      return null;
    }
    const data = (await res.json()) as { external?: Record<string, boolean> };
    const external = data.external ?? {};
    return {
      email: Boolean(external.email),
      google: Boolean(external.google),
      apple: Boolean(external.apple),
    };
  } catch (err) {
    if (__DEV__) console.warn('[Agastya auth] settings fetch failed', err);
    return null;
  }
}
