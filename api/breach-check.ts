import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Defenxia LeakCheck proxy — server-side only.
 *
 * The LeakCheck API key lives ONLY in the server environment
 * (LEAKCHECK_API_KEY). It is never accepted from the client via query
 * params or headers, and never hardcoded here. See .env.example.
 */

// Allowed origins for browser callers. Tightened from '*' — the key behind
// this proxy is billable, so we don't let arbitrary sites spend our quota.
const ALLOWED_ORIGINS = [
  'https://defenxia-aurora-three.vercel.app',
  'https://defenxia-iot-hardware.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost',
  'http://localhost',
];

// How long we wait for LeakCheck before giving up. The free tier
// throttles aggressively and sometimes tarpits connections; without a
// timeout the serverless function hangs until Vercel kills it, and the
// browser sees a dropped connection ("Failed to fetch") with no usable
// error. With a timeout we always return clean JSON instead.
const UPSTREAM_TIMEOUT_MS = 8000;

// In-memory breach-result cache (per serverless instance).
// LeakCheck's free tier throttles aggressively, so repeat checks of the same
// query within BREACH_CACHE_TTL_MS reuse the last good response.
const BREACH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const breachCache = new Map<string, { at: number; data: any }>();

function applyCors(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    // Parse query params
    const urlObj = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
    const check = urlObj.searchParams.get('check') || req.query?.check || '';

    // NOTE: a client-supplied `key` query/header param is deliberately IGNORED.
    // Accepting it would let callers launder arbitrary keys through this proxy
    // and would previously have leaked keys into server logs via the URL.
    const apiKey = process.env.LEAKCHECK_API_KEY || '';

    if (!check) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Query parameter "check" is required' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Breach check is not configured on the server (LEAKCHECK_API_KEY). See .env.example.' }));
      return;
    }

    const cleanQuery = check.trim();

    // Short-lived in-memory cache: repeat checks of the same email/username
    // within a few minutes reuse the previous result instead of burning
    // LeakCheck quota. This is what used to make the check "work once and
    // then fail" — the free API key gets throttled after a couple of calls.
    const cacheKey = cleanQuery.toLowerCase();
    const cached = breachCache.get(cacheKey);
    if (cached && Date.now() - cached.at < BREACH_CACHE_TTL_MS) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Defenxia-Cache', 'hit');
      res.end(JSON.stringify(cached.data));
      return;
    }

    const endpoint = `https://leakcheck.io/api/public?check=${encodeURIComponent(cleanQuery)}&key=${encodeURIComponent(apiKey)}`;

    // Bounded wait: never let a throttled upstream hang the function.
    // On timeout we return clean JSON (success:false) instead of letting
    // Vercel kill the invocation, which the browser reports as
    // "Failed to fetch" with no usable error.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Defenxia-Frontline-Guard/1.0'
        },
        signal: controller.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const timedOut = fetchErr?.name === 'AbortError';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        retryable: true,
        error: timedOut
          ? 'Breach lookup timed out — the LeakCheck service is responding slowly right now. Please try again in a minute.'
          : `Could not reach the LeakCheck service (${fetchErr?.message || 'network error'}). Please try again in a minute.`
      }));
      return;
    }
    clearTimeout(timeout);

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      const throttled = upstreamRes.status === 429 || upstreamRes.status === 503;
      // Always answer 200 with a JSON body: the browser fetch must never
      // see a bare error status without a parseable Defenxia payload.
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        retryable: throttled,
        error: throttled
          ? 'Breach lookup is rate-limited right now (too many checks in a short time). Please wait a few minutes and try again.'
          : `Breach service returned an error (HTTP ${upstreamRes.status}). ${errText ? `Detail: ${errText.slice(0, 160)}` : 'Please try again in a minute.'}`
      }));
      return;
    }

    const data = await upstreamRes.json();

    // LeakCheck signals "this query appears in NO known breach" as
    // { success: false, error: "Not found" }. That is GOOD NEWS, not an
    // error — normalize it into a clean success so the UI shows the green
    // "no breaches found" state instead of a red "Not found" error toast.
    // (Without this, every clean email looks like a broken module.)
    let payload: any = data;
    if (
      data &&
      data.success === false &&
      typeof data.error === 'string' &&
      /not\s*found/i.test(data.error) &&
      !(data.found > 0)
    ) {
      payload = {
        success: true,
        found: 0,
        fields: [],
        sources: [],
        message: 'No breaches found for this query. Good news — stay safe!',
      };
    }

    breachCache.set(cacheKey, { at: Date.now(), data: payload });
    // Keep the cache small: drop the oldest entries past 200 keys.
    if (breachCache.size > 200) {
      const oldest = breachCache.keys().next().value;
      if (oldest) breachCache.delete(oldest);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Defenxia-Cache', 'miss');
    res.end(JSON.stringify(payload));
  } catch (error: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: error?.message || 'Internal server error' }));
  }
}
