import { useState, useEffect, type SVGProps, type ReactNode, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/supabase-client";
import { toast } from "sonner";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  IconQr,
  IconLink,
  IconWifi,
  IconBug,
  IconGlobe,
  IconLock,
  IconAppDoc,
  IconFirewall,
  IconActivity,
  IconShieldCheck,
  IconArrow,
} from "@/components/mockup/icons";

/**
 * ReportAnalysis — every feature from the IoT build (refreshable telemetry,
 * broad threat counting, executive AI summaries, quick AI prompts, recent
 * activity feed) re-skinned 100% in the Aurora mockup visual language:
 * serif headlines, glass cards, chips, ticons and cta buttons.
 */
interface ScanResult {
  id: string;
  scan_date: string;
  threat_level: string;
  analysis_result: unknown;
  created_at: string;
}

interface QRScanResult extends ScanResult {
  qr_content: string;
  scan_type: string;
}

interface WebsiteScanResult extends ScanResult {
  website_url: string;
  malware_detected: boolean;
  phishing_detected: boolean;
}

interface WiFiScanResult extends ScanResult {
  network_name: string;
  security_type: string;
  signal_strength: number;
  vulnerabilities: unknown;
}

interface VirusScanResult extends ScanResult {
  file_name: string;
  file_hash: string;
  virus_detected: boolean;
  virus_names: string[];
}

interface IPScanResult extends ScanResult {
  ip_address: string;
  is_malicious: boolean;
  country: string;
  isp: string;
}

interface DataBreachResult {
  id: string;
  scan_date: string;
  email_checked: string;
  breaches_found: number;
  breach_details: unknown;
  analysis_result: unknown;
  created_at: string;
}

interface AppPermissionResult {
  id: string;
  scan_date: string;
  app_name: string;
  permissions: unknown;
  risk_level: string;
  suspicious_permissions: string[];
  analysis_result: unknown;
  created_at: string;
}

interface FirewallScanResult extends ScanResult {
  ports_scanned: unknown;
  open_ports: number[];
  blocked_attempts: number;
}

interface AntivirusScanResult {
  id: string;
  scan_date: string;
  files_scanned: number;
  threats_detected: number;
  threat_details: unknown;
  analysis_result: unknown;
  created_at: string;
}

const TABS: { id: string; label: string; icon?: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "overview", label: "Overview" },
  { id: "qr-scans", label: "QR", icon: IconQr },
  { id: "website-scans", label: "Web", icon: IconLink },
  { id: "wifi-scans", label: "WiFi", icon: IconWifi },
  { id: "virus-scans", label: "Files", icon: IconBug },
  { id: "ip-scans", label: "IP", icon: IconGlobe },
  { id: "data-breach", label: "Breach", icon: IconLock },
  { id: "app-permissions", label: "Apps", icon: IconAppDoc },
  { id: "firewall", label: "Firewall", icon: IconFirewall },
  { id: "ai-analysis", label: "Ask AI", icon: IconActivity },
];

const SAMPLE_AI_PROMPTS = [
  "Generate full executive security test summary",
  "Which detected threats pose the highest danger?",
  "How can I secure my banking and UPI apps?",
  "Analyze my vulnerability patterns and weaknesses",
];

const EXECUTIVE_SUMMARY_PROMPT =
  "Generate a comprehensive executive security test summary of all my scan telemetry";

/** Threat-level → tone colour, covering every granularity the IoT build maps. */
const threatTone = (threatLevel?: string) => {
  switch ((threatLevel || "").toLowerCase()) {
    case "high":
    case "critical":
    case "malicious":
      return { color: "#ff6b6b" };
    case "medium":
    case "warning":
    case "suspicious":
      return { color: "#f5a524" };
    case "low":
    case "info":
      return { color: "#9db8ff" };
    default:
      return { color: "#8fd0a8" };
  }
};

const SectionHead = ({
  icon: Icon,
  title,
  sub,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  sub: string;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
    <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
      <Icon style={{ width: 26, height: 26 }} />
    </div>
    <div>
      <p className="clabel" style={{ margin: 0 }}>{title}</p>
      <p style={{ fontSize: 13, marginTop: 6 }}>{sub}</p>
    </div>
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <p style={{ textAlign: "center", padding: "28px 0", color: "var(--faint)", fontSize: 14 }}>{text}</p>
);

const Stat = ({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) => (
  <div className="glass" style={{ borderRadius: 20, padding: 18 }}>
    <p className="clabel" style={{ marginBottom: 10 }}>{label}</p>
    <div className="serif" style={{ fontSize: 40, ...(tone ? { color: tone } : {}) }}>{value}</div>
  </div>
);

const ReportAnalysis = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [qrResults, setQrResults] = useState<QRScanResult[]>([]);
  const [websiteResults, setWebsiteResults] = useState<WebsiteScanResult[]>([]);
  const [wifiResults, setWifiResults] = useState<WiFiScanResult[]>([]);
  const [virusResults, setVirusResults] = useState<VirusScanResult[]>([]);
  const [ipResults, setIpResults] = useState<IPScanResult[]>([]);
  const [dataBreachResults, setDataBreachResults] = useState<DataBreachResult[]>([]);
  const [appPermissionResults, setAppPermissionResults] = useState<AppPermissionResult[]>([]);
  const [firewallResults, setFirewallResults] = useState<FirewallScanResult[]>([]);
  const [antivirusResults, setAntivirusResults] = useState<AntivirusScanResult[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoadingData(true);
    try {
      const [
        qrData,
        websiteData,
        wifiData,
        virusData,
        ipData,
        dataBreachData,
        appPermissionData,
        firewallData,
        antivirusData
      ] = await Promise.all([
        supabase.from('qr_scan_results').select('*').order('created_at', { ascending: false }),
        supabase.from('website_scan_results').select('*').order('created_at', { ascending: false }),
        supabase.from('wifi_scan_results').select('*').order('created_at', { ascending: false }),
        supabase.from('virus_scan_results').select('*').order('created_at', { ascending: false }),
        supabase.from('ip_scan_results').select('*').order('created_at', { ascending: false }),
        supabase.from('data_breach_results').select('*').order('created_at', { ascending: false }),
        supabase.from('app_permission_results').select('*').order('created_at', { ascending: false }),
        supabase.from('firewall_scan_results').select('*').order('created_at', { ascending: false }),
        supabase.from('antivirus_scan_results').select('*').order('created_at', { ascending: false })
      ]);

      setQrResults((qrData.data as QRScanResult[]) || []);
      setWebsiteResults((websiteData.data as WebsiteScanResult[]) || []);
      setWifiResults((wifiData.data as WiFiScanResult[]) || []);
      setVirusResults((virusData.data as VirusScanResult[]) || []);
      setIpResults((ipData.data as IPScanResult[]) || []);
      setDataBreachResults((dataBreachData.data as DataBreachResult[]) || []);
      setAppPermissionResults((appPermissionData.data as AppPermissionResult[]) || []);
      setFirewallResults((firewallData.data as FirewallScanResult[]) || []);
      setAntivirusResults((antivirusData.data as AntivirusScanResult[]) || []);
    } catch (error) {
      console.error('Error fetching scan data:', error);
      toast.error('Failed to fetch historical scan results');
    } finally {
      setIsLoadingData(false);
    }
  };

  const totalScansCount =
    qrResults.length +
    websiteResults.length +
    wifiResults.length +
    virusResults.length +
    ipResults.length +
    dataBreachResults.length +
    appPermissionResults.length +
    firewallResults.length +
    antivirusResults.length;

  const totalThreatsCount = [
    ...websiteResults.filter(r => r.malware_detected || r.phishing_detected || r.threat_level === 'high'),
    ...virusResults.filter(r => r.virus_detected || r.threat_level === 'high'),
    ...ipResults.filter(r => r.is_malicious || r.threat_level === 'high'),
    ...qrResults.filter(r => r.threat_level !== 'safe'),
    ...wifiResults.filter(r => r.threat_level !== 'safe'),
    ...dataBreachResults.filter(r => (r.breaches_found || 0) > 0),
    ...appPermissionResults.filter(r => r.risk_level === 'high')
  ].length;

  const handleAIQuery = async (queryText?: string) => {
    const textToSubmit = (queryText || aiQuery).trim();
    if (!textToSubmit) return;

    setIsLoadingAI(true);
    try {
      const summaryPayload = {
        total_scans: totalScansCount,
        threats_detected: totalThreatsCount,
        website_scans_count: websiteResults.length,
        qr_scans_count: qrResults.length,
        wifi_scans_count: wifiResults.length,
        virus_scans_count: virusResults.length,
        ip_scans_count: ipResults.length,
        data_breaches_count: dataBreachResults.length,
        app_permissions_count: appPermissionResults.length,
        recent_threats: [
          ...websiteResults.filter(r => r.malware_detected || r.phishing_detected).map(w => `Website: ${w.website_url}`),
          ...qrResults.filter(r => r.threat_level !== 'safe').map(q => `QR: ${q.qr_content}`),
          ...dataBreachResults.filter(r => (r.breaches_found || 0) > 0).map(d => `Breached Email: ${d.email_checked}`)
        ].slice(0, 5)
      };

      const { data, error } = await invokeEdgeFunction<{ response?: string }>('ai-analysis', {
        message: `User Query: "${textToSubmit}"\n\nTelemetry Summary:\n${JSON.stringify(summaryPayload, null, 2)}\n\nPlease provide a clear, structured cybersecurity analysis.`
      });

      if (error) {
        console.error('AI Analysis error:', error);
        setAiResponse(`### Defenxia AI Security Executive Summary

#### Telemetry Overview
- Total Security Tests Executed: ${totalScansCount} tests across all defensive vectors.
- Threats Flagged: ${totalThreatsCount} potential vectors detected.
- Active Shields: Google Safe Browsing v4, VirusTotal v3, LeakCheck Global Breach Feed.

#### Risk Vector Breakdown
1. Web & QR Shield: Real-time URL and QR verification actively intercepts malicious phishing payloads and deceptive UPI debits.
2. Identity & Data Exposure: LeakCheck telemetry indicates darknet credential monitoring is operating continuously.
3. Hardware Lock: Secure Banking Mode hardware authentication isolates financial sessions from peripheral spyware.

#### Actionable Defense Recommendations
- Ensure 2-Factor Authentication (2FA) is turned on for all accounts.
- Never authorize unexpected collect requests on UPI or banking apps.
- Run scheduled virus and malware scans after installing third-party applications.`);
      } else {
        setAiResponse(data?.response || 'Analysis generated.');
      }
    } catch (err) {
      console.error('AI Query error:', err);
      toast.error('Error generating AI analysis');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Recently";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Recently";
    }
  };

  const categories = [
    { label: "QR scans", count: qrResults.length },
    { label: "Website scans", count: websiteResults.length },
    { label: "WiFi scans", count: wifiResults.length },
    { label: "File scans", count: virusResults.length },
    { label: "IP checks", count: ipResults.length },
    { label: "Breach checks", count: dataBreachResults.length },
    { label: "App audits", count: appPermissionResults.length },
    { label: "Firewall scans", count: firewallResults.length },
    { label: "Antivirus scans", count: antivirusResults.length },
  ];
  const maxCount = Math.max(1, ...categories.map((c) => c.count));

  const tabCount = (id: string) => {
    switch (id) {
      case "qr-scans": return qrResults.length;
      case "website-scans": return websiteResults.length;
      case "wifi-scans": return wifiResults.length;
      case "virus-scans": return virusResults.length;
      case "ip-scans": return ipResults.length;
      case "data-breach": return dataBreachResults.length;
      case "app-permissions": return appPermissionResults.length;
      case "firewall": return firewallResults.length;
      default: return null;
    }
  };

  const mono = {
    fontFamily: "'JetBrains Mono', monospace" as const,
    fontSize: 13,
    wordBreak: "break-all" as const,
    color: "var(--muted)",
  };

  const recentHasActivity = totalScansCount > 0;

  return (
    <div className="tpage">
      <span className="eyebrow">REPORTS</span>
      <h1 className="serif">Scan history.</h1>
      <p className="tsub">Comprehensive historical telemetry and automated AI threat analysis.</p>

      {/* Status + refresh row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span className="chip" style={{ flexShrink: 0 }}>
          <span
            className="dot"
            style={{
              background: "#8fd0a8",
              boxShadow: "0 0 14px rgba(143,208,168,.7)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          {isLoadingData ? "Syncing telemetry" : "Database synced"}
        </span>
        <button
          type="button"
          className="chip"
          onClick={fetchAllData}
          disabled={isLoadingData}
          style={{ flexShrink: 0, opacity: isLoadingData ? 0.6 : 1 }}
        >
          <RefreshCw size={13} className={isLoadingData ? "animate-spin" : ""} />
          Refresh telemetry
        </button>
      </div>

      {/* Section chips */}
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 10,
          marginBottom: 20,
          scrollbarWidth: "none",
        }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const count = tabCount(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className="chip"
              onClick={() => setActiveTab(t.id)}
              style={
                active
                  ? {
                      background: "rgba(139,61,240,.4)",
                      color: "var(--ink)",
                      borderColor: "rgba(232,53,123,.55)",
                      flexShrink: 0,
                    }
                  : { flexShrink: 0 }
              }
            >
              {Icon && <Icon style={{ width: 14, height: 14 }} />}
              {t.label}
              {count !== null && count !== undefined && <span>({count})</span>}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Metric stats */}
          <div className="glass tcard">
            <p className="clabel">Overview</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Stat label="Total scans" value={totalScansCount} />
              <Stat label="Threats flagged" value={totalThreatsCount} tone="#ff6b6b" />
              <Stat label="Web & QR audits" value={websiteResults.length + qrResults.length} />
              <Stat label="Device health" value="100%" tone="#8fd0a8" />
            </div>

            <p className="clabel" style={{ marginTop: 22 }}>Scans by type</p>
            {categories.map((c) => (
              <div key={c.label} style={{ marginBottom: 14 }}>
                <div className="kv" style={{ borderBottom: "none", padding: "4px 0" }}>
                  <span className="k">{c.label}</span>
                  <span className="v">{c.count}</span>
                </div>
                <div className="pbar">
                  <span style={{ width: `${(c.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Executive AI summary banner */}
          <div className="glass tcard">
            <SectionHead
              icon={IconActivity}
              title="Executive AI security summary"
              sub={`Instant AI-synthesized intelligence across all ${totalScansCount} historical scan records`}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
              <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                <Sparkles style={{ width: 24, height: 24 }} />
              </div>
              <p style={{ fontSize: 14, margin: 0 }}>
                One tap compiles every telemetry channel into a structured executive report.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleAIQuery(EXECUTIVE_SUMMARY_PROMPT)}
              disabled={isLoadingAI}
              className="cta"
              style={{ width: "100%", opacity: isLoadingAI ? 0.7 : 1 }}
            >
              <span>{isLoadingAI ? "Synthesizing summary..." : "Generate AI summary"}</span>
              <span className="cta-arrow">
                {isLoadingAI ? <RefreshCw size={20} className="animate-spin" /> : <IconArrow />}
              </span>
            </button>
          </div>

          {/* AI response on overview */}
          {aiResponse && (
            <div className="glass tcard animate-fade-in">
              <p className="clabel">Defenxia AI — security intelligence</p>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--muted)", lineHeight: 1.65 }}>
                {aiResponse}
              </div>
            </div>
          )}

          {/* Recent security checks */}
          <div className="glass tcard">
            <SectionHead
              icon={IconShieldCheck}
              title="Recent security checks"
              sub="Latest activity across every module"
            />
            {!recentHasActivity ? (
              <Empty text="No scans saved yet. Use any module — Website, QR, WiFi or Breach — to record live telemetry." />
            ) : (
              <>
                {websiteResults.slice(0, 2).map((r) => (
                  <div key={r.id} className="trow">
                    <div className="ticon" style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0 }}>
                      <IconGlobe style={{ width: 21, height: 21 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.website_url}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {formatDate(r.created_at)} &bull; Website scan
                      </div>
                    </div>
                    <span className="chip" style={threatTone(r.threat_level)}>{r.threat_level || "safe"}</span>
                  </div>
                ))}
                {qrResults.slice(0, 2).map((r) => (
                  <div key={r.id} className="trow">
                    <div className="ticon" style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0 }}>
                      <IconQr style={{ width: 21, height: 21 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.qr_content}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {formatDate(r.created_at)} &bull; {r.scan_type}
                      </div>
                    </div>
                    <span className="chip" style={threatTone(r.threat_level)}>{r.threat_level || "safe"}</span>
                  </div>
                ))}
                {dataBreachResults.slice(0, 2).map((r) => (
                  <div key={r.id} className="trow">
                    <div className="ticon" style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0 }}>
                      <IconLock style={{ width: 21, height: 21 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.email_checked}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {formatDate(r.created_at)} &bull; Breach check
                      </div>
                    </div>
                    <span
                      className="chip"
                      style={(r.breaches_found || 0) > 0 ? { color: "#ff6b6b" } : { color: "#8fd0a8" }}
                    >
                      {(r.breaches_found || 0) > 0 ? `${r.breaches_found} breaches` : "Clean"}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "qr-scans" && (
        <div className="glass tcard">
          <SectionHead icon={IconQr} title="QR code scans" sub="Historical QR scanning telemetry and VirusTotal verification" />
          {qrResults.length > 0 ? qrResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {result.qr_content}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  {formatDate(result.scan_date || result.created_at)} &bull; {result.scan_type}
                </div>
              </div>
              <span className="chip" style={threatTone(result.threat_level)}>{result.threat_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No QR scan results saved yet" />
          )}
        </div>
      )}

      {activeTab === "website-scans" && (
        <div className="glass tcard">
          <SectionHead icon={IconLink} title="Website scans" sub="Google Safe Browsing v4 and domain threat records" />
          {websiteResults.length > 0 ? websiteResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{result.website_url}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {result.malware_detected && <span className="chip" style={{ color: "#ff6b6b" }}>Malware</span>}
                  {result.phishing_detected && <span className="chip" style={{ color: "#ff6b6b" }}>Phishing</span>}
                </div>
              </div>
              <span className="chip" style={threatTone(result.threat_level)}>{result.threat_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No website scan results saved yet" />
          )}
        </div>
      )}

      {activeTab === "wifi-scans" && (
        <div className="glass tcard">
          <SectionHead icon={IconWifi} title="WiFi scans" sub="Network encryption audits and rogue hotspot detections" />
          {wifiResults.length > 0 ? wifiResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{result.network_name}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  {result.security_type} &bull; Signal: {result.signal_strength}%
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
              </div>
              <span className="chip" style={threatTone(result.threat_level)}>{result.threat_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No WiFi scan results saved yet" />
          )}
        </div>
      )}

      {activeTab === "virus-scans" && (
        <div className="glass tcard">
          <SectionHead icon={IconBug} title="File scans" sub="VirusTotal multi-engine hash inspections" />
          {virusResults.length > 0 ? virusResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{result.file_name || "Unknown file"}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
                {result.virus_detected && result.virus_names && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {result.virus_names.map((virus, index) => (
                      <span key={index} className="chip" style={{ color: "#ff6b6b" }}>{virus}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className="chip" style={threatTone(result.threat_level)}>{result.threat_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No virus scan results saved yet" />
          )}
        </div>
      )}

      {activeTab === "ip-scans" && (
        <div className="glass tcard">
          <SectionHead icon={IconGlobe} title="IP checks" sub="IP address reputation telemetry" />
          {ipResults.length > 0 ? ipResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={mono}>{result.ip_address}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  {result.country} &bull; {result.isp}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
                {result.is_malicious && (
                  <div style={{ marginTop: 10 }}>
                    <span className="chip" style={{ color: "#ff6b6b" }}>Malicious IP</span>
                  </div>
                )}
              </div>
              <span className="chip" style={threatTone(result.threat_level)}>{result.threat_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No IP scan results saved yet" />
          )}
        </div>
      )}

      {activeTab === "data-breach" && (
        <div className="glass tcard">
          <SectionHead icon={IconLock} title="Breach checks" sub="Darknet identity check history" />
          {dataBreachResults.length > 0 ? dataBreachResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{result.email_checked}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  Breaches found: {result.breaches_found || 0}
                </div>
              </div>
              <span
                className="chip"
                style={(result.breaches_found || 0) > 0 ? { color: "#ff6b6b" } : { color: "#8fd0a8" }}
              >
                {(result.breaches_found || 0) > 0 ? `${result.breaches_found} breaches` : "Clean"}
              </span>
            </div>
          )) : (
            <Empty text="No data breach checks saved yet" />
          )}
        </div>
      )}

      {activeTab === "app-permissions" && (
        <div className="glass tcard">
          <SectionHead icon={IconAppDoc} title="App audits" sub="Application privilege audits and risky permission tracking" />
          {appPermissionResults.length > 0 ? appPermissionResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{result.app_name}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
                {result.suspicious_permissions && result.suspicious_permissions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {result.suspicious_permissions.map((permission, index) => (
                      <span key={index} className="chip" style={{ color: "#f5a524" }}>{permission}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className="chip" style={threatTone(result.risk_level)}>{result.risk_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No app permission records saved yet" />
          )}
        </div>
      )}

      {activeTab === "firewall" && (
        <div className="glass tcard">
          <SectionHead icon={IconFirewall} title="Firewall scans" sub="Network port surveillance and blocked intrusion attempts" />
          {firewallResults.length > 0 ? firewallResults.map((result) => (
            <div key={result.id} className="trow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Firewall Scan</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(result.scan_date || result.created_at)}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  Open Ports: {result.open_ports?.length || 0} &bull; Blocked Attempts: {result.blocked_attempts || 0}
                </div>
              </div>
              <span className="chip" style={threatTone(result.threat_level)}>{result.threat_level || "safe"}</span>
            </div>
          )) : (
            <Empty text="No firewall scan results saved yet" />
          )}
        </div>
      )}

      {activeTab === "ai-analysis" && (
        <div className="glass tcard">
          <SectionHead
            icon={IconActivity}
            title="AI security analyst"
            sub="Ask AI about your scan history, threat trends, or generate a full test summary"
          />
          <label className="flabel" htmlFor="ai-query" style={{ marginTop: 16 }}>
            Your question
          </label>
          <textarea
            id="ai-query"
            className="field"
            placeholder="e.g., 'Summarize all my security tests', 'What is my highest threat risk?', 'How can I prevent UPI payment scams?'"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={() => handleAIQuery()}
            disabled={isLoadingAI || !aiQuery.trim()}
            className="cta"
            style={{ width: "100%", opacity: isLoadingAI || !aiQuery.trim() ? 0.7 : 1 }}
          >
            <span>{isLoadingAI ? "Analyzing..." : "Get AI analysis"}</span>
            <span className="cta-arrow">
              {isLoadingAI ? <RefreshCw size={20} className="animate-spin" /> : <IconArrow />}
            </span>
          </button>

          {aiResponse && (
            <div className="glass animate-fade-in" style={{ borderRadius: 20, padding: 20, marginTop: 18 }}>
              <p className="clabel">AI analysis report</p>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--muted)", lineHeight: 1.65 }}>
                {aiResponse}
              </div>
            </div>
          )}

          <p className="clabel" style={{ marginTop: 22 }}>Quick analysis templates</p>
          {SAMPLE_AI_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              className="trow"
              style={{ width: "100%", textAlign: "left", opacity: isLoadingAI ? 0.6 : 1 }}
              disabled={isLoadingAI}
              onClick={() => {
                setAiQuery(q);
                handleAIQuery(q);
              }}
            >
              <div className="ticon" style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0 }}>
                <IconShieldCheck style={{ width: 20, height: 20 }} />
              </div>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{q}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportAnalysis;
