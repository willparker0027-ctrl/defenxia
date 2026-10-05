import { useState } from "react";
import { insertWithSession } from "@/lib/supabase-client";
import type { Json } from "@/integrations/supabase/types";
import { scanUrlWithVirusTotal, VTUrlScanResult } from "@/services/virusTotalService";
import { toast } from "sonner";
import {
  IconGlobe,
  IconShieldCheck,
  IconLock,
  IconClock,
  IconFileSearch,
  IconArrow,
  IconBug,
} from "@/components/mockup/icons";

/**
 * Website Scanner — live VirusTotal v3 scan (70+ antivirus engines).
 * Functionality preserved exactly from the IoT version (VT v3 API scan,
 * URL normalization, Supabase audit insert, toasts, quick test chips,
 * engine breakdown, threat list, proceed/scan-again actions);
 * only the presentation is re-skinned in the Aurora mockup language.
 */

const QUICK_TESTS: { label: string; url: string }[] = [
  { label: "TEST GOOGLE · VERIFIED SAFE", url: "https://www.google.com" },
  { label: "TEST MALWARE URL · HIGH RISK", url: "http://testsafebrowsing.appspot.com/s/malware.html" },
  { label: "TEST OFFICIAL SBI BANK", url: "https://onlinesbi.sbi" },
];

const SCAN_STEPS = [
  { label: "Multi-Engine Heuristics", icon: IconFileSearch },
  { label: "SSL & Domain Reputation", icon: IconLock },
  { label: "Malware Database Match", icon: IconBug },
  { label: "Phishing Signatures", icon: IconShieldCheck },
];

const WebsiteScanner = () => {
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<VTUrlScanResult | null>(null);

  const handleScan = async () => {
    if (!url.trim()) return;

    setIsScanning(true);
    setScanResult(null);

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    try {
      // Execute live VirusTotal v3 API scan across 70+ antivirus vendors
      const vtResult = await scanUrlWithVirusTotal(normalizedUrl);
      setScanResult(vtResult);

      // Save genuine audit result to Supabase website_scan_results table
      try {
        await insertWithSession("website_scan_results", {
          website_url: normalizedUrl,
          malware_detected: vtResult.positives > 0,
          phishing_detected: vtResult.threats.length > 0,
          threat_level: vtResult.isSafe ? "safe" : "high",
          analysis_result: vtResult as unknown as Json,
          scan_type: "virustotal_v3_api",
        });
      } catch (err) {
        console.log("Saved website scan locally", err);
      }

      if (vtResult.verdict === 'malicious') {
        toast.error(`🚨 Security Alert: Malicious activity flagged by ${vtResult.positives} engine(s)!`);
      } else if (vtResult.verdict === 'clean') {
        toast.success(`✅ Verified Clean by VirusTotal! (0/${vtResult.totalEngines} Detections)`);
      } else {
        toast.warning('⚠️ Could not verify this URL — VirusTotal has no finished verdict. Treat it with caution.');
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Scan failed to reach VirusTotal server");
    } finally {
      setIsScanning(false);
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setUrl("");
  };

  const verdict = scanResult?.verdict ?? 'unknown';
  const isSafe = verdict === 'clean';
  const isUnknown = verdict === 'unknown';
  const StatusIcon = isSafe ? IconShieldCheck : isUnknown ? IconClock : IconBug;
  const statusStroke = isSafe ? "#8fd0a8" : isUnknown ? "#f5a524" : "#ff6b6b";
  const statusTone = isSafe ? "ok" : isUnknown ? "warn" : "bad";
  const statusTitle = isSafe ? "Website Verified Clean" : isUnknown ? "Could Not Verify" : "Malicious URL Blocked";
  const cleanEngines = scanResult ? scanResult.stats.harmless + scanResult.stats.undetected : 0;
  const trustTone =
    scanResult && scanResult.reputationScore >= 80
      ? "ok"
      : scanResult && scanResult.reputationScore >= 50
        ? "warn"
        : "bad";

  return (
    <div className="tpage">
      <span className="eyebrow">WEBSITE SCANNER</span>
      <h1 className="serif">Website Scanner.</h1>
      <p className="tsub">
        Scan any link or domain across 70+ antivirus engines — VirusTotal real-time threat intelligence.
      </p>

      <div className="glass tcard animate-fade-in">
        <label className="flabel" htmlFor="website-url">Website URL or domain</label>
        <input
          id="website-url"
          type="url"
          placeholder="e.g. https://bank-login-secure.xyz or google.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          className="field"
          disabled={isScanning}
          style={{ marginBottom: 18 }}
        />
        <button
          type="button"
          onClick={handleScan}
          disabled={!url.trim() || isScanning}
          className="cta"
          style={{ width: "100%", marginTop: 0, opacity: !url.trim() || isScanning ? 0.55 : 1 }}
        >
          {isScanning ? (
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <IconFileSearch
                className="animate-spin-slow"
                style={{ width: 22, height: 22, stroke: "var(--ink)", fill: "none", strokeWidth: 2 }}
              />
              Inspecting across 70+ Engines...
            </span>
          ) : (
            <span>Scan Website Security</span>
          )}
          <span className="cta-arrow" aria-hidden="true">
            <IconArrow />
          </span>
        </button>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
          {QUICK_TESTS.map((test) => (
            <button
              key={test.url}
              type="button"
              onClick={() => setUrl(test.url)}
              className="pill"
              style={{ fontSize: 10, padding: "8px 14px" }}
            >
              {test.label}
            </button>
          ))}
        </div>
      </div>

      {isScanning && (
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <span className="ticon animate-pulse-aurora" style={{ width: 72, height: 72, borderRadius: 24 }}>
              <IconGlobe style={{ width: 34, height: 34, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
            </span>
          </div>
          <h3 className="serif" style={{ fontSize: 28, marginBottom: 14 }}>
            Inspecting Threat Intelligence Feeds
          </h3>
          {SCAN_STEPS.map((step) => (
            <div className="trow" key={step.label}>
              <span className="dot" aria-hidden="true" />
              <div className="eyebrow" style={{ fontSize: 11 }}>
                {step.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {scanResult && !isScanning && (
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <span className="ticon" style={{ width: 88, height: 88, borderRadius: 28 }}>
              <StatusIcon
                style={{ width: 42, height: 42, stroke: statusStroke, fill: "none", strokeWidth: 1.7 }}
              />
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <span className="pill">
              {scanResult.positives} / {scanResult.totalEngines} DETECTIONS
            </span>
            <span className="pill" style={{ color: trustTone === "ok" ? "#8fd0a8" : trustTone === "warn" ? "#f5a524" : "#ff6b6b" }}>
              TRUST SCORE · {scanResult.reputationScore}/100
            </span>
          </div>

          <h3 className={`${statusTone} serif`} style={{ fontSize: 34, marginBottom: 8 }}>
            {statusTitle}
          </h3>
          <p style={{ fontSize: 15, color: "var(--muted)", marginBottom: 16 }}>
            {scanResult.analysisMessage}
          </p>
          <p style={{ wordBreak: "break-all", fontSize: 13.5, color: "var(--faint)", marginBottom: 8 }}>
            {scanResult.url}
          </p>

          <div style={{ textAlign: "left", marginTop: 18 }}>
            <p className="clabel">Engine breakdown</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <div className="glass" style={{ borderRadius: 18, padding: "14px 12px", textAlign: "center" }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>CLEAN ENGINES</div>
                <div className="ok" style={{ fontSize: 22, fontWeight: 700 }}>{cleanEngines}</div>
              </div>
              <div className="glass" style={{ borderRadius: 18, padding: "14px 12px", textAlign: "center" }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>MALICIOUS</div>
                <div className={scanResult.stats.malicious > 0 ? "bad" : "ok"} style={{ fontSize: 22, fontWeight: 700 }}>
                  {scanResult.stats.malicious}
                </div>
              </div>
              <div className="glass" style={{ borderRadius: 18, padding: "14px 12px", textAlign: "center" }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>SUSPICIOUS</div>
                <div
                  className={scanResult.stats.suspicious > 0 ? "warn" : ""}
                  style={{ fontSize: 22, fontWeight: 700, color: scanResult.stats.suspicious > 0 ? undefined : "var(--muted)" }}
                >
                  {scanResult.stats.suspicious}
                </div>
              </div>
              <div className="glass" style={{ borderRadius: 18, padding: "14px 12px", textAlign: "center" }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>ENGINES CHECKED</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#cdc2f7" }}>{scanResult.totalEngines}</div>
              </div>
            </div>

            <div className="kv">
              <span className="k">Scan completed at</span>
              <span className="v" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconClock style={{ width: 14, height: 14, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
                {scanResult.scanDate}
              </span>
            </div>

            {scanResult.threats.length > 0 && (
              <div style={{ padding: "14px 0" }}>
                <p className="clabel bad">Security engine detections</p>
                {scanResult.threats.map((threat, index) => (
                  <div key={index} className="trow" style={{ padding: "10px 0" }}>
                    <span
                      className="dot"
                      aria-hidden="true"
                      style={{ background: "#ff6b6b", boxShadow: "0 0 14px rgba(232,138,153,.6)" }}
                    />
                    <div style={{ fontSize: 14, color: "var(--muted)" }}>{threat}</div>
                  </div>
                ))}
              </div>
            )}

            {isUnknown && (
              <div className="glass" style={{ borderRadius: 18, padding: 16, marginTop: 14, textAlign: "center", borderColor: "rgba(245,165,36,.35)" }}>
                <p style={{ fontSize: 14, color: "#f5a524", fontWeight: 600, marginBottom: 6 }}>
                  ⚠️ No finished VirusTotal verdict for this URL.
                </p>
                <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
                  VirusTotal is still analyzing it or has never seen it. This link is{" "}
                  <b>NOT verified clean</b> — do not enter passwords, OTPs or payment
                  details on it. You can open the VirusTotal report or scan again in a minute.
                </p>
                {scanResult.permalink && (
                  <button
                    type="button"
                    onClick={() => window.open(scanResult.permalink, "_blank", "noopener,noreferrer")}
                    className="btn-ghost"
                    style={{ width: "100%", marginTop: 12 }}
                  >
                    Open VirusTotal Report
                  </button>
                )}
              </div>
            )}

            {isSafe && (
              <div className="glass" style={{ borderRadius: 18, padding: 16, marginTop: 14, textAlign: "center" }}>
                <p className="ok" style={{ fontSize: 14 }}>
                  This website appears to be safe and legitimate. No security threats detected.
                </p>
              </div>
            )}

            {isSafe && (
              <button
                type="button"
                onClick={() => window.open(scanResult.url, "_blank", "noopener,noreferrer")}
                className="cta"
                style={{ width: "100%", marginTop: 16 }}
              >
                <span>Proceed to Safe Website</span>
                <span className="cta-arrow" aria-hidden="true">
                  <IconArrow />
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={resetScan}
              className="btn-ghost"
              style={{ width: "100%", marginTop: isSafe ? 12 : 16 }}
            >
              Scan Another Link
            </button>
          </div>
        </div>
      )}

      <div className="glass tcard">
        <p className="clabel">Safety tips</p>
        {[
          "Always verify URLs before entering sensitive information",
          "Look for HTTPS and valid SSL certificates",
          "Be cautious of shortened URLs and suspicious domains",
          "Never download files from untrusted websites",
        ].map((tip) => (
          <div className="trow" key={tip}>
            <span className="dot" aria-hidden="true" />
            <div style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.55 }}>{tip}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", opacity: 0.5, padding: "8px 0 4px" }}>
        <IconGlobe style={{ width: 28, height: 28, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.5 }} />
      </div>
    </div>
  );
};

export default WebsiteScanner;
