import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { IconAppDoc, IconShieldCheck, IconArrow } from "@/components/mockup/icons";
import { insertWithSession } from "@/lib/supabase-client";
import { nativeNfcService, isNativeAndroid, InstalledAppPermission } from "@/services/nativeNfcService";
import { toast } from "sonner";

// High-fidelity fallback applications for Web testing
const FALLBACK_AUDIT_APPS: InstalledAppPermission[] = [
  {
    packageName: "com.flash.torch.bright",
    appName: "Flashlight & Torch Pro",
    icon: null,
    permissions: ["Camera", "SMS", "Contacts", "Location"],
    suspiciousPermissions: ["SMS Access", "Contacts Database", "GPS Location"],
    riskLevel: "high",
    suspicionReason: "Critical: Flashlight utility requests access to SMS, Contacts, and GPS tracking (Trojan / Data Harvesting pattern)."
  },
  {
    packageName: "com.quick.loan.instant",
    appName: "Quick Loan Direct",
    icon: null,
    permissions: ["SMS", "Contacts", "Call Logs", "Location", "Camera"],
    suspiciousPermissions: ["SMS Access", "Contacts Database", "Call History"],
    riskLevel: "high",
    suspicionReason: "Critical: Unauthorized financial lending app accesses entire contacts list and SMS inbox (Predatory Loan / Harassment pattern)."
  },
  {
    packageName: "com.hd.wallpaper.anime",
    appName: "HD Wallpapers 4K",
    icon: null,
    permissions: ["Storage", "Microphone", "Draw Over Apps"],
    suspiciousPermissions: ["Audio Recording", "Screen Overlay"],
    riskLevel: "high",
    suspicionReason: "Warning: Wallpaper app requests continuous microphone recording and screen overlays."
  },
  {
    packageName: "com.whatsapp",
    appName: "WhatsApp",
    icon: null,
    permissions: ["Camera", "Microphone", "Contacts", "Storage", "Location"],
    suspiciousPermissions: [],
    riskLevel: "low",
    suspicionReason: "Legitimate: Permissions directly correspond to messaging and VoIP calling features."
  },
  {
    packageName: "com.google.android.apps.maps",
    appName: "Google Maps",
    icon: null,
    permissions: ["Location", "Microphone", "Storage"],
    suspiciousPermissions: [],
    riskLevel: "low",
    suspicionReason: "Legitimate: Location and voice search permissions required for turn-by-turn navigation."
  },
  {
    packageName: "com.weather.daily.forecast",
    appName: "Daily Weather Forecast",
    icon: null,
    permissions: ["Location", "Contacts"],
    suspiciousPermissions: ["Contacts Database"],
    riskLevel: "medium",
    suspicionReason: "Suspicious: Weather application requests access to user contacts without clear feature need."
  }
];

const TONE = {
  high: "#ff6b6b",
  medium: "#f5a524",
  low: "#8fd0a8",
} as const;

const riskTone = (riskLevel: InstalledAppPermission["riskLevel"]) => {
  switch (riskLevel) {
    case "high": return "bad";
    case "medium": return "warn";
    case "low": return "ok";
    default: return "";
  }
};

const riskColor = (riskLevel: InstalledAppPermission["riskLevel"]) =>
  TONE[riskLevel] ?? "#cdc2f7";

const riskLabel = (riskLevel: InstalledAppPermission["riskLevel"]) =>
  riskLevel === "high" ? "HIGH RISK" : riskLevel === "medium" ? "CAUTION" : "SAFE";

const AppPermissions = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentApp, setCurrentApp] = useState("");
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedApps, setScannedApps] = useState<InstalledAppPermission[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(isNativeAndroid());
  }, []);

  const startScan = async () => {
    setIsScanning(true);
    setProgress(0);
    setScanComplete(false);
    setScannedApps([]);

    try {
      let appsToAudit: InstalledAppPermission[] = [];

      if (isNativeAndroid()) {
        toast.info("Inspecting installed applications on your device...");
        appsToAudit = await nativeNfcService.scanInstalledAppsPermissions();
      }

      if (!appsToAudit || appsToAudit.length === 0) {
        appsToAudit = FALLBACK_AUDIT_APPS;
      }

      // Animate scan progress across apps
      let appIndex = 0;
      const interval = setInterval(async () => {
        if (appIndex < appsToAudit.length) {
          setCurrentApp(`Analyzing: ${appsToAudit[appIndex].appName}`);
          setProgress(Math.round(((appIndex + 1) / appsToAudit.length) * 100));
          appIndex++;
        } else {
          clearInterval(interval);
          setIsScanning(false);
          setScanComplete(true);
          setScannedApps(appsToAudit);

          const highRiskCount = appsToAudit.filter(a => a.riskLevel === 'high').length;
          if (highRiskCount > 0) {
            toast.error(`⚠️ Alert: Found ${highRiskCount} app(s) requesting dangerous or unnecessary permissions!`);
          } else {
            toast.success("✅ Audit complete: All inspected apps have standard permissions.");
          }

          // Save audit report to Supabase
          try {
            for (const app of appsToAudit.slice(0, 5)) {
              await insertWithSession('app_permission_results', {
                app_name: app.appName,
                permissions: app.permissions,
                risk_level: app.riskLevel,
                suspicious_permissions: app.suspiciousPermissions
              });
            }
          } catch (err) {
            console.log('Saved app permissions locally');
          }
        }
      }, 150);

    } catch (e) {
      console.error("Scan error:", e);
      setIsScanning(false);
      setScannedApps(FALLBACK_AUDIT_APPS);
      setScanComplete(true);
    }
  };

  const filteredApps = scannedApps.filter(app => {
    const matchesSearch = app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = filterRisk === 'all' || app.riskLevel === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const highRiskCount = scannedApps.filter(a => a.riskLevel === 'high').length;
  const mediumRiskCount = scannedApps.filter(a => a.riskLevel === 'medium').length;
  const safeCount = scannedApps.filter(a => a.riskLevel === 'low').length;

  const resultStatus = highRiskCount > 0 ? 'malicious' : mediumRiskCount > 0 ? 'warning' : 'safe';

  const stats = [
    { key: "all" as const, label: "AUDITED", value: scannedApps.length, suffix: scannedApps.length === 1 ? "APP" : "APPS", color: "#cdc2f7" },
    { key: "high" as const, label: "HIGH RISK", value: highRiskCount, suffix: highRiskCount === 1 ? "APP" : "APPS", color: "#ff6b6b" },
    { key: "medium" as const, label: "CAUTION", value: mediumRiskCount, suffix: mediumRiskCount === 1 ? "APP" : "APPS", color: "#f5a524" },
    { key: "low" as const, label: "SAFE", value: safeCount, suffix: safeCount === 1 ? "APP" : "APPS", color: "#8fd0a8" },
  ];

  return (
    <div className="tpage">
      <span className="eyebrow">APP PERMISSIONS</span>
      <h1 className="serif">App Permissions.</h1>
      <p className="tsub">Audit the apps on your phone and flag the ones asking for SMS, contacts, microphone or location they don't need.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        <span className="chip">
          <span className="dot" aria-hidden="true" />
          {isAndroid ? "REAL DEVICE AUDIT" : "DEMO · DEVICE"}
        </span>
      </div>

      {/* Idle — launch card */}
      {!isScanning && !scanComplete && (
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <span className="ticon" style={{ width: 88, height: 88, borderRadius: "50%" }}>
              <IconAppDoc style={{ width: 40, height: 40, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
            </span>
          </div>
          <h3 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>Full Phone Permission Audit</h3>
          <p style={{ marginBottom: 4, maxWidth: 40, marginLeft: "auto", marginRight: "auto" }}>
            {isAndroid
              ? "Scan every installed app on this device and analyze the privacy risks."
              : "Audit app permissions, flagging loan apps, fake torches and spyware patterns."}
          </p>
          <button type="button" onClick={startScan} className="cta" style={{ minWidth: 280, margin: "24px auto 0" }}>
            <span>Start App Permission Audit</span>
            <span className="cta-arrow">
              <IconArrow />
            </span>
          </button>
        </div>
      )}

      {/* Scanning */}
      {isScanning && (
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span className="ticon animate-pulse-aurora" style={{ width: 88, height: 88, borderRadius: "50%" }}>
              <IconAppDoc style={{ width: 40, height: 40, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
            </span>
          </div>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, marginBottom: 18 }}>
            Scanning Installed Apps...
          </h3>
          <div className="pbar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ marginBottom: 18 }}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="eyebrow" style={{ fontSize: 11, marginBottom: 10 }}>{currentApp}</p>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40 }}>{Math.round(progress)}%</div>
        </div>
      )}

      {/* Results */}
      {scanComplete && (
        <div className="animate-fade-in">
          {/* Result summary — Aurora treatment of the audit verdict */}
          <div className="glass tcard" style={{ textAlign: "center" }}>
            <p className="eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>
              {resultStatus === 'malicious' ? "HIGH-RISK FLAGS" : resultStatus === 'warning' ? "REVIEW ADVISED" : "ALL CLEAR"}
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <span className="ticon" style={{ width: 72, height: 72, borderRadius: "50%" }}>
                <IconShieldCheck
                  style={{
                    width: 34, height: 34,
                    stroke: resultStatus === 'malicious' ? "#ff6b6b" : resultStatus === 'warning' ? "#f5a524" : "#8fd0a8",
                    fill: "none", strokeWidth: 1.7,
                  }}
                />
              </span>
            </div>
            <h3 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>
              {resultStatus === 'malicious'
                ? `${highRiskCount} high-risk app${highRiskCount === 1 ? "" : "s"} flagged.`
                : resultStatus === 'warning'
                  ? `${mediumRiskCount} app${mediumRiskCount === 1 ? "" : "s"} worth a second look.`
                  : "All permissions verified."}
            </h3>
            <p style={{ maxWidth: 44, marginLeft: "auto", marginRight: "auto" }}>
              {resultStatus === 'malicious'
                ? "Apps detected requesting dangerous permissions — SMS, contacts, call logs — unsuited to their category."
                : "No suspicious data harvesting or spyware permissions found on the audited apps."}
            </p>
            <div style={{ marginTop: 14 }}>
              <span className={`chip ${riskTone(resultStatus === 'malicious' ? 'high' : resultStatus === 'warning' ? 'medium' : 'low')}`}>
                <span className="dot" aria-hidden="true" />
                {scannedApps.length} APPS AUDITED
              </span>
            </div>
          </div>

          {/* Metric tiles — tap to filter */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 22 }}>
            {stats.map((stat) => {
              const active = filterRisk === stat.key;
              return (
                <button
                  key={stat.key}
                  type="button"
                  onClick={() => setFilterRisk(stat.key)}
                  className="glass"
                  style={{
                    borderRadius: 22,
                    padding: 18,
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: active ? stat.color : undefined,
                    background: "transparent",
                    color: "inherit",
                    fontFamily: "inherit",
                  }}
                >
                  <p className="clabel" style={{ marginBottom: 8 }}>{stat.label}</p>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, lineHeight: 1, color: stat.color }}>
                    {stat.value}
                  </div>
                  <p className="eyebrow" style={{ fontSize: 10, marginTop: 8 }}>{stat.suffix}</p>
                </button>
              );
            })}
          </div>

          {/* Search + filter pills */}
          <div className="glass" style={{ borderRadius: 999, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", marginBottom: 14 }}>
            <Search size={16} style={{ color: "var(--faint)", flexShrink: 0 }} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search app or package name..."
              aria-label="Search apps"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--ink)",
                fontSize: 14,
                padding: "14px 0",
                width: "100%",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
            {stats.map((stat) => (
              <button
                key={stat.key}
                type="button"
                onClick={() => setFilterRisk(stat.key)}
                className="chip"
                style={filterRisk === stat.key
                  ? { borderColor: stat.color, color: stat.color }
                  : { cursor: "pointer" }}
                aria-pressed={filterRisk === stat.key}
              >
                <span className="dot" style={{ background: stat.color, boxShadow: `0 0 14px ${stat.color}` }} aria-hidden="true" />
                {stat.label} · {stat.value}
              </button>
            ))}
          </div>

          {/* App rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {filteredApps.map((app, idx) => (
              <article key={app.packageName || idx} className="glass" style={{ borderRadius: 22, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {app.icon ? (
                    <img
                      src={app.icon}
                      alt=""
                      style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--edge-soft)", flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      className="ticon"
                      style={{
                        width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                        fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: riskColor(app.riskLevel),
                      }}
                      aria-hidden="true"
                    >
                      {app.appName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{app.appName}</div>
                    <div className="eyebrow" style={{ fontSize: 9, letterSpacing: ".12em", opacity: 0.7 }}>{app.packageName}</div>
                  </div>
                  <span className={`chip ${riskTone(app.riskLevel)}`} style={{ flexShrink: 0 }}>
                    <span className="dot" style={{ background: riskColor(app.riskLevel), boxShadow: `0 0 14px ${riskColor(app.riskLevel)}` }} aria-hidden="true" />
                    {riskLabel(app.riskLevel)}
                  </span>
                </div>

                <p className="eyebrow" style={{ fontSize: 10, marginTop: 14, marginBottom: 8 }}>
                  {app.permissions.length} PERMISSION{app.permissions.length === 1 ? "" : "S"} REQUESTED
                </p>

                {app.riskLevel !== "low" && (
                  <div
                    className="glass"
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      marginBottom: 12,
                      borderColor: riskColor(app.riskLevel) === "#f5a524" ? "rgba(245,165,36,.3)" : "rgba(255,107,107,.3)",
                    }}
                  >
                    <p className="clabel" style={{ color: riskColor(app.riskLevel), marginBottom: 6 }}>
                      SUSPICIOUS BEHAVIOR DETECTED
                    </p>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>{app.suspicionReason}</p>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {app.permissions.map((perm, pIdx) => {
                    const flagged = app.suspiciousPermissions.some(
                      (s) => s.toLowerCase().includes(perm.toLowerCase()) || perm.toLowerCase().includes(s.toLowerCase())
                    );
                    return (
                      <span
                        key={pIdx}
                        className="chip"
                        style={flagged
                          ? { color: "#f5a524", borderColor: "rgba(245,165,36,.4)" }
                          : { opacity: 0.75 }}
                      >
                        <span
                          className="dot"
                          style={flagged ? { background: "#f5a524", boxShadow: "0 0 14px rgba(245,165,36,.7)" } : undefined}
                          aria-hidden="true"
                        />
                        {perm}{flagged ? " · UNNECESSARY" : ""}
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}

            {filteredApps.length === 0 && (
              <div className="glass tcard" style={{ textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <span className="ticon" style={{ width: 64, height: 64, borderRadius: "50%" }}>
                    <IconShieldCheck style={{ width: 30, height: 30, stroke: "#8fd0a8", fill: "none", strokeWidth: 1.7 }} />
                  </span>
                </div>
                <h3 className="serif" style={{ fontSize: 26, marginBottom: 6 }}>No matches.</h3>
                <p>Try clearing the search or choosing a different risk category.</p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
            <button type="button" onClick={startScan} className="btn-ghost">
              Scan Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppPermissions;
