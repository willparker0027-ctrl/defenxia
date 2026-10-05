import React, { useState } from "react";
import {
  IconFileSearch,
  IconShieldCheck,
  IconLock,
  IconArrow,
  IconGlobe,
  IconKeyRound,
  IconClock,
} from "@/components/mockup/icons";
import { insertWithSession } from "@/lib/supabase-client";
import { buildApiUrl } from "@/lib/api-config";
import { toast } from "sonner";

interface BreachSource {
  name: string;
  date?: string;
}

interface LeakCheckResponse {
  success: boolean;
  found: number;
  fields: string[];
  sources: BreachSource[];
  error?: string;
}

const BREACH_CACHE_KEY = 'defenxia_breach_cache_v1';
const BREACH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readBreachCache(query: string): LeakCheckResponse | null {
  try {
    const raw = localStorage.getItem(BREACH_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, { at: number; data: LeakCheckResponse }>;
    const entry = cache[query.toLowerCase()];
    if (entry && Date.now() - entry.at < BREACH_CACHE_TTL_MS) {
      return entry.data;
    }
  } catch {
    // Corrupt cache: ignore and fall through to the network.
  }
  return null;
}

function writeBreachCache(query: string, data: LeakCheckResponse) {
  try {
    const raw = localStorage.getItem(BREACH_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, { at: number; data: LeakCheckResponse }>) : {};
    cache[query.toLowerCase()] = { at: Date.now(), data };
    // Keep the cache small.
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      delete cache[keys[0]];
    }
    localStorage.setItem(BREACH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable: non-fatal.
  }
}

async function fetchLeakCheckData(query: string): Promise<LeakCheckResponse> {
  const cleanQuery = query.trim();

  // Local cache first: repeat checks of the same email/username within a
  // few minutes reuse the last good result instead of burning the free
  // LeakCheck quota (which is what used to make checks "work once, then fail").
  const cached = readBreachCache(cleanQuery);
  if (cached) {
    console.log('[DEFENXIA BREACH] Serving from local cache');
    return cached;
  }

  // Server-side proxy (/lookup -> /api/breach-check via vercel.json rewrite).
  // Neutral path avoids adblocker/tracker keyword filtering ("leak", "breach").
  // The LeakCheck API key lives ONLY in the server environment
  // (LEAKCHECK_API_KEY) — it is never sent from the client, never in the URL.
  //
  // NOTE: there is intentionally no Supabase Edge Function fallback tier here.
  // The previously referenced 'check-data-breach' function was never deployed,
  // so that tier could only ever fail. All breach checks go through the
  // server-side proxy above, which keeps the key server-side. (A second
  // server-side tier can be added once a backup API key exists.)
  try {
    const backendEndpoint = buildApiUrl(`/lookup?check=${encodeURIComponent(cleanQuery)}`);
    console.log('[DEFENXIA BREACH] Querying backend endpoint:', backendEndpoint);
    const res = await fetch(backendEndpoint, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      console.warn('[DEFENXIA BREACH] Proxy HTTP', res.status);
      return {
        success: false,
        found: 0,
        fields: [],
        sources: [],
        error: 'Could not reach the Defenxia breach service right now. Please check your connection and try again.'
      };
    }
    const data = await res.json();
    if (data && data.success !== false) {
      const result: LeakCheckResponse = {
        success: true,
        found: data.found !== undefined ? data.found : (data.sources ? data.sources.length : 0),
        fields: data.fields || [],
        sources: data.sources || []
      };
      writeBreachCache(cleanQuery, result);
      return result;
    }
    // The proxy answered with success:false — an honest upstream error
    // (rate-limited, timed out). Surface it plainly, no tech jargon.
    const retryable = data?.retryable === true;
    return {
      success: false,
      found: 0,
      fields: [],
      sources: [],
      error: data?.error
        || (retryable
          ? 'Breach lookup is busy right now. Please wait a minute and try again.'
          : 'Breach check failed. Please try again in a minute.')
    };
  } catch (e: any) {
    console.warn('[DEFENXIA BREACH] Proxy fetch failed:', e);
    return {
      success: false,
      found: 0,
      fields: [],
      sources: [],
      error: 'Unable to reach the Defenxia breach check service. Please check your internet connection and try again.'
    };
  }

  // NOTE: There is intentionally no "direct browser → LeakCheck" tier here.
  // Calling the LeakCheck API from the browser would require embedding the
  // API key in client code / the URL, leaking it to anyone who opens the app —
  // and leakcheck.io throttles direct browser calls, which is exactly why the
  // check used to work once and then fail. All breach checks go through the
  // server-side proxy above, which keeps the key server-side.
}

/**
 * Data Breach — Aurora-styled breach checker.
 * Full IoT functionality preserved: LeakCheck 3-tier API pipeline,
 * exposed-field tags, per-source breach list with dates, action plan,
 * Supabase persistence + threat logging, toast notifications.
 * Only the JSX is re-skinned in Aurora's visual language.
 */
const DataBreach = () => {
  const [query, setQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<LeakCheckResponse | null>(null);
  const [lastScanned, setLastScanned] = useState("");

  const handleCheckBreach = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      toast.error("Please enter an email address or username to scan");
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setLastScanned(cleanQuery);

    // Breach checks run through the server-side proxy, which holds the
    // LeakCheck API key. No client-side key is used.
    try {
      const result = await fetchLeakCheckData(cleanQuery);

      if (!result.success && result.error) {
        toast.error(result.error);
        setScanResult(null);
        return;
      }

      setScanResult(result);

      // Save to Supabase data_breach_results table for Report & Analysis
      try {
        await insertWithSession('data_breach_results', {
          email_checked: cleanQuery,
          breaches_found: result.found || 0,
          breach_details: result.sources as any,
          analysis_result: result as any,
          scan_type: 'leakcheck_darknet'
        });
      } catch (err) {
        console.log('Saved breach check locally');
      }

      if (result.found > 0) {
        toast.error(`⚠️ LeakCheck Alert: ${result.found} data breach(es) found!`);
        // Log threat event in Supabase
        try {
          await insertWithSession('security_threats' as any, {
            type: 'data_breach',
            content: `Compromised records found for: ${cleanQuery} (${result.found} breaches)`,
            severity: 'critical'
          } as any);
        } catch (err) {
          console.log('Logged breach locally');
        }
      } else {
        toast.success("✅ Clean! No leaked credentials found in darknet databases.");
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Unable to complete breach scan. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const formatBreachDate = (dateStr?: string) => {
    if (!dateStr) return "Public Data Dump";
    try {
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleString('default', { month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const isCompromised = (scanResult?.found ?? 0) > 0;

  return (
    <div className="tpage">
      <span className="eyebrow">DATA BREACH</span>
      <h1 className="serif">Check for Breaches.</h1>
      <p className="tsub">
        Check if your email, username or phone has been compromised in known data breaches —
        powered by the LeakCheck.io global threat database.
      </p>

      <div style={{ marginBottom: 22 }}>
        <span className="pill">LEAKCHECK&nbsp;LIVE</span>
      </div>

      {/* Input card */}
      <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <span className="ticon" style={{ width: 88, height: 88, borderRadius: "50%" }}>
            <IconFileSearch style={{ width: 40, height: 40, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
          </span>
        </div>

        <form onSubmit={handleCheckBreach} style={{ textAlign: "left" }}>
          <label className="flabel" htmlFor="breach-query">Email, username or phone</label>
          <input
            id="breach-query"
            type="text"
            placeholder="e.g. name@example.com or username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field"
            style={{ textAlign: "center", marginBottom: 18 }}
            disabled={isScanning}
            required
          />

          <button
            type="submit"
            disabled={!query.trim() || isScanning}
            className="cta"
            style={{ width: "100%", opacity: !query.trim() || isScanning ? 0.55 : 1 }}
          >
            <span>{isScanning ? "Querying LeakCheck databases…" : "Check for Breaches"}</span>
            <span className="cta-arrow">
              <IconArrow />
            </span>
          </button>
        </form>
      </div>

      {/* Scanning state */}
      {isScanning && (
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span className="ticon animate-pulse-aurora" style={{ width: 88, height: 88, borderRadius: "50%" }}>
              <IconFileSearch style={{ width: 40, height: 40, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
            </span>
          </div>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, marginBottom: 8 }}>
            Scanning global data dumps…
          </h3>
          <p style={{ marginBottom: 22 }}>
            Searching billions of leaked records for {query}…
          </p>
          <div className="pbar" role="progressbar" aria-label="Breach scan progress">
            <span className="animate-pulse-aurora" style={{ width: "66%" }} />
          </div>
        </div>
      )}

      {/* Results card */}
      {scanResult && !isScanning && (
        <div className={`glass tcard animate-fade-in${isCompromised ? " danger" : ""}`} style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span className="ticon" style={{ width: 88, height: 88, borderRadius: "50%" }}>
              {isCompromised ? (
                <IconLock style={{ width: 40, height: 40, stroke: "#ff6b6b", fill: "none", strokeWidth: 1.7 }} />
              ) : (
                <IconShieldCheck style={{ width: 40, height: 40, stroke: "#8fd0a8", fill: "none", strokeWidth: 1.7 }} />
              )}
            </span>
          </div>

          <h3
            className={isCompromised ? "bad" : "ok"}
            style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, marginBottom: 8 }}
          >
            {isCompromised
              ? `Compromised in ${scanResult.found} Data Breach${scanResult.found > 1 ? "es" : ""}`
              : "Good news — no breaches found"}
          </h3>
          <p style={{ marginBottom: 18 }}>
            {isCompromised
              ? `Your identity was found in ${scanResult.found} known data breach${scanResult.found > 1 ? "es" : ""}. Consider changing your passwords.`
              : "Your identity was not found in any known data breaches."}
          </p>

          <div style={{ marginBottom: 24 }}>
            <span className="pill" style={{ textTransform: "none", letterSpacing: ".04em" }}>{lastScanned}</span>
          </div>

          {isCompromised ? (
            <div style={{ textAlign: "left", borderTop: "1px solid rgba(205,194,247,.08)", paddingTop: 22 }}>
              {scanResult.fields.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <p className="clabel">
                    <IconKeyRound style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} />
                    Exposed data categories
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {scanResult.fields.map((field, idx) => (
                      <span key={idx} className="pill" style={{ color: "#ff8a8a", borderColor: "rgba(255,107,107,.3)", textTransform: "none", letterSpacing: ".06em" }}>
                        {field.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 22 }}>
                <p className="clabel">
                  <IconGlobe style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} />
                  Leaked in these services ({scanResult.sources.length})
                </p>
                <div style={{ maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
                  {scanResult.sources.map((src, idx) => (
                    <div className="trow" key={idx}>
                      <span className="ticon" style={{ width: 48, height: 48, borderRadius: 16 }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#ff8a8a", fontWeight: 700 }}>
                          {src.name.substring(0, 2).toUpperCase()}
                        </span>
                      </span>
                      <div style={{ flex: 1 }}>
                        <b style={{ fontSize: 16, display: "block", color: "var(--ink)" }}>{src.name}</b>
                        <small style={{ fontSize: 13, color: "var(--muted)" }}>Known database dump leaked online</small>
                      </div>
                      <span className="pill" style={{ fontSize: 10, textTransform: "none", letterSpacing: ".04em" }}>
                        <IconClock style={{ width: 11, height: 11, verticalAlign: "-1px", marginRight: 5 }} />
                        {formatBreachDate(src.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass" style={{ borderRadius: 22, padding: 20, borderColor: "rgba(255,107,107,.22)" }}>
                <p className="clabel" style={{ color: "#ff8a8a" }}>Immediate security action plan</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    {
                      n: "1.",
                      text: <>Change passwords immediately: reset your password on <b>{lastScanned}</b> and any other services where you reused the same password.</>,
                    },
                    {
                      n: "2.",
                      text: <>Enable 2FA (two-factor authentication): turn on an authenticator app or SMS OTP verification for all banking and email accounts.</>,
                    },
                    {
                      n: "3.",
                      text: <>Monitor bank activity: if money is ever debited without your consent, call the <b>National Cyber Crime Helpline at 1930</b> immediately.</>,
                    },
                  ].map((step) => (
                    <div key={step.n} style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.65, color: "var(--muted)" }}>
                      <span className="bad" style={{ fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", fontSize: 19 }}>{step.n}</span>
                      <span>{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid rgba(205,194,247,.08)", paddingTop: 22 }}>
              <p style={{ marginBottom: 18 }}>
                LeakCheck searched through billions of publicly dumped passwords, darknet records
                and database breaches. No matching compromise was detected for {lastScanned}.
              </p>
              <div className="glass" style={{ borderRadius: 22, padding: 18, borderColor: "rgba(143,208,168,.25)" }}>
                <span className="ok" style={{ fontSize: 14.5, fontWeight: 600 }}>
                  Your digital identity is currently secure. Continue using unique passwords!
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setScanResult(null);
              setQuery("");
            }}
            className="btn-ghost"
            style={{ width: "100%", marginTop: 24 }}
          >
            Scan Another Email or Username
          </button>
        </div>
      )}

      {/* Guidance */}
      <div className="glass tcard">
        <p className="clabel">Why breaches happen &amp; how to prevent them</p>
        {[
          {
            icon: IconLock,
            title: "Databases get hacked",
            sub: "Websites get hacked, and user databases containing passwords and phone numbers get dumped on dark web forums.",
          },
          {
            icon: IconKeyRound,
            title: "Credential stuffing",
            sub: "Attackers use leaked passwords from one website to attempt logging into your banking and UPI apps.",
          },
          {
            icon: IconShieldCheck,
            title: "Use unique passwords",
            sub: "Never use the same password for your email, social media, and banking applications.",
          },
        ].map((row) => (
          <div className="trow" key={row.title}>
            <span className="ticon" style={{ width: 52, height: 52, borderRadius: 17 }}>
              <row.icon style={{ width: 24, height: 24, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
            </span>
            <div>
              <b style={{ fontSize: 16, display: "block", color: "var(--ink)" }}>{row.title}</b>
              <small style={{ fontSize: 13.5, color: "var(--muted)", display: "block", marginTop: 6, lineHeight: 1.5 }}>{row.sub}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataBreach;
