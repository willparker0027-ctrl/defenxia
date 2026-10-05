/**
 * Defenxia VirusTotal URL scan proxy — server-side only.
 *
 * Why this exists: the old client-side flow called the VirusTotal API from
 * the browser and treated "no data yet" (URL not indexed / analysis still
 * queued) as "Verified Clean". That produced false-green verdicts for
 * URLs VirusTotal had never finished analyzing — a dangerous lie for a
 * security product. This endpoint:
 *
 *   1. Looks up the exact URL in VirusTotal (GET /api/v3/urls/{id}).
 *   2. If not indexed, submits it (POST /api/v3/urls) and polls the
 *      analysis until it completes (bounded, well under the serverless
 *      time budget).
 *   3. Returns a real verdict: "clean" | "malicious" | "unknown".
 *      "unknown" means VirusTotal has no finished verdict — the client
 *      must show "could not verify", NEVER a green "Verified Clean" badge.
 *
 * The VirusTotal API key lives ONLY in the server environment
 * (VIRUSTOTAL_API_KEY). It is never sent to the browser.
 */

const ALLOWED_ORIGINS = [
  'https://defenxia-aurora-three.vercel.app',
  'https://defenxia-iot-hardware.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost',
  'http://localhost',
];

// NOTE: this key previously shipped inside the client JS bundle, so it is
// already public. It is kept here only as a fallback so URL scanning keeps
// working until a fresh key is issued. Set VIRUSTOTAL_API_KEY in the Vercel
// project environment and then ROTATE this key in the VirusTotal dashboard.
const FALLBACK_VT_KEY = '354ec18fa45e7871f8c8ea783eea9fbe571f7e670521d814689d0a5909c8c685';

const VT_BASE = 'https://www.virustotal.com/api/v3';
// Keep total server work safely inside the serverless time budget.
const POLL_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 2000;

function applyCors(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function vtUrlId(url: string): string {
  return Buffer.from(url, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function normalizeTarget(raw: string): string {
  let u = (raw || '').trim();
  if (!u) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

function buildVerdict(url: string, stats: any, permalink: string, scanDate: string, pending = false) {
  const malicious = Number(stats?.malicious || 0);
  const suspicious = Number(stats?.suspicious || 0);
  const harmless = Number(stats?.harmless || 0);
  const undetected = Number(stats?.undetected || 0);
  const total = malicious + suspicious + harmless + undetected;

  // No finished engine data at all -> we simply do not know. NEVER "clean".
  if (pending || total === 0) {
    return {
      success: true,
      url,
      verdict: 'unknown' as const,
      pending: true,
      stats: { malicious, suspicious, harmless, undetected },
      totalEngines: total,
      positives: 0,
      threats: [] as string[],
      scanDate,
      permalink,
      message: 'VirusTotal is still analyzing this URL (or has no finished verdict). Treat the link with caution — it is NOT verified clean.',
    };
  }

  const isMalicious = malicious > 0 || suspicious > 1;
  return {
    success: true,
    url,
    verdict: isMalicious ? 'malicious' : 'clean',
    pending: false,
    stats: { malicious, suspicious, harmless, undetected },
    totalEngines: total,
    positives: malicious + suspicious,
    threats: [] as string[],
    scanDate,
    permalink,
    message: isMalicious
      ? `Malicious: flagged by ${malicious} engine(s), ${suspicious} suspicious.`
      : `Verified clean by VirusTotal: 0 detections across ${total} engines.`,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const send = (payload: any) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  };

  try {
    const urlObj = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
    const rawUrl = urlObj.searchParams.get('url') || req.query?.url || '';
    const target = normalizeTarget(rawUrl);

    if (!target) {
      send({ success: false, error: 'Query parameter "url" is required.' });
      return;
    }
    if (target.length > 2048) {
      send({ success: false, error: 'URL is too long.' });
      return;
    }

    const apiKey = process.env.VIRUSTOTAL_API_KEY || FALLBACK_VT_KEY;
    const headers = { 'x-apikey': apiKey } as Record<string, string>;
    const scanDate = new Date().toLocaleString();
    const permalink = `https://www.virustotal.com/gui/url/${vtUrlId(target)}`;

    // 1) Direct lookup — the fast path for URLs VirusTotal already knows.
    try {
      const lookupRes = await fetch(`${VT_BASE}/urls/${vtUrlId(target)}`, { headers });
      if (lookupRes.ok) {
        const data = await lookupRes.json();
        const attr = data?.data?.attributes;
        if (attr?.last_analysis_stats) {
          const verdict = buildVerdict(target, attr.last_analysis_stats, permalink, scanDate);
          // Attach vendor-level threat names for the malicious case.
          if (verdict.verdict === 'malicious' && attr.last_analysis_results) {
            for (const [vendor, v] of Object.entries<any>(attr.last_analysis_results)) {
              if (v?.category === 'malicious' || v?.category === 'suspicious') {
                (verdict.threats as string[]).push(`${vendor}: ${v.result || v.category}`);
              }
            }
          }
          send(verdict);
          return;
        }
      } else if (lookupRes.status !== 404) {
        const t = await lookupRes.text().catch(() => '');
        console.warn('VT lookup non-404 error:', lookupRes.status, t.slice(0, 120));
      }
    } catch (e: any) {
      console.warn('VT lookup failed:', e?.message || e);
    }

    // 2) Not indexed (or lookup failed): submit, then poll the analysis.
    let analysisId = '';
    try {
      const submitRes = await fetch(`${VT_BASE}/urls`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(target)}`,
      });
      if (!submitRes.ok) {
        const t = await submitRes.text().catch(() => '');
        console.warn('VT submit error:', submitRes.status, t.slice(0, 160));
        send({
          success: true,
          url: target,
          verdict: 'unknown',
          pending: true,
          stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 },
          totalEngines: 0,
          positives: 0,
          threats: [],
          scanDate,
          permalink,
          message: 'Could not submit this URL to VirusTotal right now. Treat the link with caution — it is NOT verified clean.',
        });
        return;
      }
      const submitData = await submitRes.json();
      analysisId = submitData?.data?.id || '';
    } catch (e: any) {
      console.warn('VT submit failed:', e?.message || e);
    }

    if (!analysisId) {
      send({
        success: true,
        url: target,
        verdict: 'unknown',
        pending: true,
        stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 },
        totalEngines: 0,
        positives: 0,
        threats: [],
        scanDate,
        permalink,
        message: 'VirusTotal did not accept this URL for analysis. Treat the link with caution — it is NOT verified clean.',
      });
      return;
    }

    // 3) Bounded poll for a finished analysis.
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const aRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, { headers });
        if (!aRes.ok) continue;
        const aData = await aRes.json();
        const aAttr = aData?.data?.attributes;
        if (aAttr?.status === 'completed' && aAttr?.stats) {
          const verdict = buildVerdict(target, aAttr.stats, permalink, scanDate);
          if (verdict.verdict === 'malicious' && aAttr.results) {
            for (const [vendor, v] of Object.entries<any>(aAttr.results)) {
              if (v?.category === 'malicious' || v?.category === 'suspicious') {
                (verdict.threats as string[]).push(`${vendor}: ${v.result || v.category}`);
              }
            }
          }
          send(verdict);
          return;
        }
      } catch (e: any) {
        console.warn('VT analysis poll failed:', e?.message || e);
      }
    }

    // 4) Still not finished within our budget: honest "unknown".
    send({
      success: true,
      url: target,
      verdict: 'unknown',
      pending: true,
      analysisId,
      stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 },
      totalEngines: 0,
      positives: 0,
      threats: [],
      scanDate,
      permalink,
      message: 'VirusTotal is still analyzing this URL. It is NOT verified clean — check the VirusTotal report or scan again in a minute.',
    });
  } catch (error: any) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: error?.message || 'Internal server error' }));
  }
}
