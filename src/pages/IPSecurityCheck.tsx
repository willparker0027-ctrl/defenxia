import { useState } from "react";
import { IconGlobe, IconShieldCheck, IconArrow, IconBug } from "@/components/mockup/icons";
import { invokeEdgeFunction, insertWithSession } from "@/lib/supabase-client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

interface IPSecurityResult {
  service: string;
  ipAddress: string;
  isPublic: boolean;
  abuseConfidencePercentage: number;
  countryCode: string;
  usageType: string;
  isp: string;
  domain: string;
  totalReports: number;
  numDistinctUsers: number;
  lastReportedAt: string;
  status: string;
}

const IPSecurityCheck = () => {
  const [ipAddress, setIpAddress] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<IPSecurityResult | null>(null);

  const handleCheck = async () => {
    const cleanIp = ipAddress.trim();
    if (!cleanIp) {
      toast.error('Please enter an IP address');
      return;
    }

    setIsChecking(true);
    try {
      const { data, error } = await invokeEdgeFunction('ip-security-check', {
        ipAddress: cleanIp
      });

      if (error) {
        console.error('IP security check error:', error);
        toast.error('Failed to check IP address');
      } else {
        setResult(data);
        toast.success('IP security check completed');

        // Save to Supabase ip_scan_results table for Report & Analysis
        try {
          const confidence = data?.abuseConfidencePercentage || 0;
          await insertWithSession('ip_scan_results', {
            ip_address: cleanIp,
            is_malicious: confidence > 25 || data?.status === 'suspicious',
            country: data?.countryCode || 'IN',
            isp: data?.isp || 'Internet Service Provider',
            threat_level: confidence > 50 ? 'high' : confidence > 10 ? 'medium' : 'safe',
            analysis_result: data as unknown as Json,
            scan_type: 'abuseipdb_lookup'
          });
        } catch (err) {
          console.log('Saved IP check locally');
        }
      }
    } catch (err) {
      console.error('Check error:', err);
      toast.error('Error performing IP check');
    } finally {
      setIsChecking(false);
    }
  };

  const statusClass = (status: string) =>
    status === 'clean' ? 'ok' : status === 'suspicious' ? 'bad' : status === 'warning' ? 'warn' : '';

  const statusText = (status: string) =>
    status === 'clean' ? 'Clean' : status === 'suspicious' ? 'Suspicious' : status === 'warning' ? 'Warning' : 'Unknown';

  return (
    <div className="tpage">
      <span className="eyebrow">IP SECURITY CHECK</span>
      <h1 className="serif">IP Security Check.</h1>
      <p className="tsub">Check IP addresses for malicious activities using AbuseIPDB.</p>

      <div className="glass tcard">
        <p className="clabel">AbuseIPDB checker</p>
        <h3>Look Up an IP.</h3>
        <p style={{ marginBottom: 16 }}>Enter an IP address to check for reported malicious activities.</p>
        <p className="flabel">IP address</p>
        <input
          placeholder="Enter IP address (e.g., 192.168.1.1)"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isChecking && handleCheck()}
          className="field"
          style={{ marginBottom: 16 }}
        />
        <button type="button" onClick={handleCheck} disabled={isChecking} className="cta" style={{ width: "100%", opacity: isChecking ? 0.6 : 1 }}>
          <span>{isChecking ? "Checking..." : "Check IP"}</span>
          <span className="cta-arrow"><IconArrow /></span>
        </button>
      </div>

      {result && (
        <div className="glass tcard animate-fade-in">
          <p className="clabel">Security analysis</p>
          <div className="trow" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
              {result.status === 'clean' ? <IconShieldCheck /> : result.status === 'suspicious' ? <IconBug /> : <IconGlobe />}
            </div>
            <div>
              <span className="chip"><span className="dot" />{statusText(result.status)}</span>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, margin: "8px 0 0", color: "var(--ink)" }}>
                {result.ipAddress}
              </p>
            </div>
          </div>

          <div className="kv">
            <span className="k">Abuse confidence</span>
            <span className={`v ${result.abuseConfidencePercentage > 25 ? "bad" : "ok"}`}>
              {result.abuseConfidencePercentage}%
            </span>
          </div>
          <div className="kv">
            <span className="k">Total reports</span>
            <span className="v">{result.totalReports}</span>
          </div>
          <div className="kv">
            <span className="k">Location</span>
            <span className="v">{result.countryCode || 'N/A'}</span>
          </div>
          <div className="kv">
            <span className="k">ISP</span>
            <span className="v" style={{ fontSize: 13 }}>{result.isp || 'N/A'}</span>
          </div>
          <div className="kv">
            <span className="k">Usage type</span>
            <span className="v">{result.usageType || 'N/A'}</span>
          </div>
          <div className="kv">
            <span className="k">Domain</span>
            <span className="v" style={{ fontSize: 13, wordBreak: "break-all" }}>{result.domain || 'N/A'}</span>
          </div>
          {result.lastReportedAt && (
            <div className="kv">
              <span className="k">Last reported</span>
              <span className="v" style={{ fontSize: 13 }}>{result.lastReportedAt}</span>
            </div>
          )}
          <div className="kv">
            <span className="k">Report summary</span>
            <span className="v" style={{ fontSize: 13, fontWeight: 500 }}>
              {result.numDistinctUsers > 0
                ? `Reported by ${result.numDistinctUsers} distinct users`
                : 'No abuse reports found'}
            </span>
          </div>

          <button type="button" onClick={() => setResult(null)} className="btn-ghost" style={{ width: "100%", marginTop: 18 }}>
            Check Another IP
          </button>
        </div>
      )}

      <div className="glass tcard">
        <p className="clabel">About AbuseIPDB</p>
        <div className="trow"><p style={{ fontSize: 14, margin: 0 }}>AbuseIPDB is a collaborative database of IP addresses used for malicious activities.</p></div>
        <div className="trow"><p style={{ fontSize: 14, margin: 0 }}>Confidence percentage indicates likelihood of malicious behavior.</p></div>
        <div className="trow"><p style={{ fontSize: 14, margin: 0 }}>Higher confidence (&gt;25%) suggests suspicious or malicious activity.</p></div>
        <div className="trow"><p style={{ fontSize: 14, margin: 0 }}>Used by security professionals to identify threats and block malicious IPs.</p></div>
      </div>
    </div>
  );
};

export default IPSecurityCheck;
