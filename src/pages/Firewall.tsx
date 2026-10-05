import { useState } from "react";
import { IconShieldCheck, IconFirewall, IconGlobe } from "@/components/mockup/icons";

/**
 * Firewall — enable/disable + connection lists preserved,
 * re-skinned in the reference mockup's visual language.
 */
const Firewall = () => {
  const [firewallEnabled, setFirewallEnabled] = useState(true);

  const allowedConnections = [
    "https://www.google.com",
    "https://github.com",
    "https://stackoverflow.com",
    "https://api.openai.com",
    "https://cdn.jsdelivr.net"
  ];

  const blockedConnections = [
    "http://malicious-site.com",
    "192.168.1.255 (Unknown IP)",
    "http://phishing-attempt.net",
    "203.45.67.89 (Suspicious IP)"
  ];

  return (
    <div className="tpage">
      <span className="eyebrow">FIREWALL</span>
      <h1 className="serif">Traffic control.</h1>
      <p className="tsub">Monitor and control network traffic to protect your device.</p>

      {/* Main firewall control */}
      <div className="glass tcard" style={{ textAlign: "center" }}>
        <div className="ticon" style={{ margin: "0 auto 18px" }}>
          {firewallEnabled ? <IconShieldCheck /> : <IconFirewall />}
        </div>
        <p className="clabel">Firewall status</p>
        <h3 style={{ fontSize: 34, color: firewallEnabled ? "#8fd0a8" : "#ff6b6b" }}>
          {firewallEnabled ? "Enabled" : "Disabled"}
        </h3>

        {/* Data flow animation */}
        <div
          className="glass"
          style={{ borderRadius: 22, padding: 22, margin: "18px 0", overflow: "hidden" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <IconGlobe style={{ width: 30, height: 30, stroke: "#cdc2f7", fill: "none" }} />
            <div style={{ display: "flex", gap: 7 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="dot"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    background: firewallEnabled && i % 2 !== 0 ? "#ff6b6b" : undefined,
                  }}
                />
              ))}
            </div>
            <IconShieldCheck style={{ width: 30, height: 30, stroke: "#cdc2f7", fill: "none" }} />
            <div style={{ display: "flex", gap: 7 }}>
              {[1, 2, 3].map((i) => (
                <span key={i} className="dot" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="trow" style={{ textAlign: "left", borderBottom: "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              Firewall protection
            </div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>
              Filter inbound and outbound traffic
            </div>
          </div>
          <button
            type="button"
            className="switch"
            aria-checked={firewallEnabled}
            aria-label="Toggle firewall"
            onClick={() => setFirewallEnabled((v) => !v)}
          />
        </div>

        <p style={{ marginTop: 8 }}>
          {firewallEnabled
            ? "Firewall is actively filtering network traffic"
            : "All network traffic is allowed through"}
        </p>
      </div>

      {/* Connection status */}
      <div className="glass tcard">
        <p className="clabel">Allowed connections</p>
        {allowedConnections.map((connection) => (
          <div key={connection} className="trow">
            <span className="dot" style={{ background: "#8fd0a8", flexShrink: 0 }} />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                wordBreak: "break-all",
                color: "var(--muted)",
              }}
            >
              {connection}
            </span>
          </div>
        ))}
      </div>

      <div className="glass tcard">
        <p className="clabel">Blocked connections</p>
        {blockedConnections.map((connection) => (
          <div key={connection} className="trow">
            <span className="dot" style={{ background: "#ff6b6b", flexShrink: 0 }} />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                wordBreak: "break-all",
                color: "var(--muted)",
              }}
            >
              {connection}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Firewall;
