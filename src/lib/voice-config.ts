import { supabase } from "@/integrations/supabase/client";

/**
 * Voice feature config — the Gemini API key lives in the user's Supabase
 * (table `app_config`, key `gemini_api_key`) so it is never baked into the APK.
 *
 * Two fetch paths: the supabase-js client first, then a direct REST fallback
 * with explicit anon headers. The fallback bypasses any client auth-state or
 * RLS-role quirks (e.g. a logged-in JWT changing the effective role) — it is
 * the exact request shape verified to return the key.
 */

// Same project as @/integrations/supabase/client fallback (public anon key).
const SUPABASE_URL = "https://qooankzjqkgrwctvkysq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvb2Fua3pqcWtncndjdHZreXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTEyOTcsImV4cCI6MjA3MTk2NzI5N30.0010JiD7mG1We0F5IbF3ERywKEjC9mtkSBi_Wqg-s2Y";

let cachedKey: string | null = null;
let inFlight: Promise<string | null> | null = null;
let lastError = "";

export function getGeminiKeyError(): string {
  return lastError;
}

async function viaClient(): Promise<string | null> {
  // app_config is created at runtime — bypass the generated DB types.
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { value: string } | null; error: unknown }>;
        };
      };
    };
  };
  const { data, error } = await client
    .from("app_config")
    .select("value")
    .eq("key", "gemini_api_key")
    .maybeSingle();
  if (error) {
    lastError = "client: " + (error as { message?: string })?.message || String(error);
    return null;
  }
  if (!data?.value) {
    lastError = "client: no row returned";
    return null;
  }
  return data.value;
}

async function viaRest(): Promise<string | null> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/app_config?key=eq.gemini_api_key&select=value`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  if (!r.ok) {
    lastError = `rest: http ${r.status}`;
    return null;
  }
  const rows = (await r.json()) as Array<{ value?: string }>;
  const v = Array.isArray(rows) ? rows[0]?.value : undefined;
  if (!v) {
    lastError = "rest: no row returned";
    return null;
  }
  return v;
}

export function getGeminiApiKey(): Promise<string | null> {
  if (cachedKey) return Promise.resolve(cachedKey);
  if (inFlight) return inFlight;
  inFlight = (async () => {
    lastError = "";
    try {
      const a = await viaClient().catch(() => null);
      if (a) {
        cachedKey = a;
        return cachedKey;
      }
    } catch {
      /* fall through to REST */
    }
    try {
      const b = await viaRest().catch(() => null);
      if (b) {
        cachedKey = b;
        return cachedKey;
      }
    } catch {
      /* fall through */
    }
    return null;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function clearGeminiKeyCache() {
  cachedKey = null;
}
