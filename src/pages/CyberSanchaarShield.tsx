import { useState, useEffect } from "react";
import { IconPhoneShield, IconShieldCheck, IconArrow } from "@/components/mockup/icons";
import { insertWithSession } from "@/lib/supabase-client";
import { toast } from "sonner";

// Capacitor placeholder for PhoneStateListener
// In production: import { PhoneState } from '@nicoara/capacitor-phone-state';
// PhoneState.addListener('phoneStateChange', (state) => { ... });

const CyberSanchaarShield = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [flashOn, setFlashOn] = useState(true);

  // Flash animation when warning is active
  useEffect(() => {
    if (!showWarning) return;
    const interval = setInterval(() => {
      setFlashOn(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, [showWarning]);

  const simulateCallDetected = async () => {
    setIsOnCall(true);
    setShowWarning(true);

    toast.error('🚨 Call Detected While Banking!', {
      description: 'DO NOT share any PIN or OTP on this call.',
      duration: 10000,
    });

    // Log threat to Supabase
    try {
      await insertWithSession('security_threats' as any, {
        type: 'call_during_banking',
        content: 'Phone call detected while banking app is open',
        severity: 'critical',
      } as any);
    } catch (err) {
      console.error('Failed to log threat:', err);
    }
  };

  const dismissWarning = () => {
    setShowWarning(false);
    setIsOnCall(false);
  };

  return (
    <div className="tpage" style={{ position: "relative" }}>
      {/* Persistent warning overlay */}
      {showWarning && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: flashOn ? "rgba(120,22,40,.96)" : "rgba(90,14,28,.9)",
            transition: "background .3s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            padding: 32,
            textAlign: "center",
          }}
        >
          <div className="ticon animate-pulse-aurora" style={{ width: 96, height: 96, borderRadius: 30, margin: "0 auto" }}>
            <IconShieldCheck />
          </div>
          <h1 className="serif" style={{ fontSize: 52, margin: 0, color: "#fff" }}>
            Do Not Share.
          </h1>
          <h2 className="serif" style={{ fontSize: 34, margin: 0, color: "#fff" }}>
            PIN / OTP on call.
          </h2>
          <div className="glass" style={{ borderRadius: 24, padding: "20px 22px", maxWidth: 340 }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "#fff" }}>
              A phone call is active while you are using a banking application.
              <strong style={{ display: "block", marginTop: 8, fontSize: 16 }}>
                No bank employee will ever ask for your PIN, OTP, or CVV.
              </strong>
            </p>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.75)", margin: 0 }}>
            Capacitor: PhoneStateListener active
          </p>
          <button
            type="button"
            onClick={dismissWarning}
            className="btn-ghost"
            style={{ marginTop: 8, color: "#fff", borderColor: "rgba(255,255,255,.4)" }}
          >
            I Understand - Dismiss Warning
          </button>
        </div>
      )}

      <span className="eyebrow">CYBER-SANCHAAR SHIELD</span>
      <h1 className="serif">Call Guard.</h1>
      <p className="tsub">Detects phone calls during banking sessions &amp; warns against OTP/PIN sharing.</p>

      {/* Monitoring Toggle */}
      <div className="glass tcard">
        <p className="clabel">Call monitoring</p>
        <div className="trow" style={{ borderBottom: "none", paddingTop: 4 }}>
          <div className="ticon" style={{ width: 56, height: 56, borderRadius: 18, flexShrink: 0 }}>
            <IconPhoneShield />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px", color: "var(--ink)" }}>Call Monitoring</p>
            <p style={{ fontSize: 13, margin: 0 }}>Monitor for active phone calls during banking.</p>
          </div>
          <button
            type="button"
            className="switch"
            aria-checked={isMonitoring}
            aria-label="Toggle call monitoring"
            onClick={() => setIsMonitoring((v) => !v)}
            style={{ transform: "scale(1.3)", transformOrigin: "right center" }}
          />
        </div>
        <div className="glass" style={{ borderRadius: 20, padding: "16px 18px", marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 20, color: isMonitoring ? "#8fd0a8" : "var(--faint)" }}>
            {isMonitoring ? "◉" : "○"}
          </span>
          <div>
            <p className={isMonitoring ? "ok" : ""} style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px", color: isMonitoring ? undefined : "var(--ink)" }}>
              {isMonitoring ? "Monitoring Active" : "Monitoring Off"}
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              {isMonitoring ? "Will alert if a phone call is detected." : "Enable to detect calls during banking."}
            </p>
          </div>
        </div>
      </div>

      {/* Simulate */}
      <div className="glass tcard">
        <p className="clabel">Test the shield</p>
        <h3>Simulate a Call.</h3>
        <p>Simulate a phone call detection while using a banking app to see the warning in action.</p>
        <button type="button" onClick={simulateCallDetected} className="cta" style={{ width: "100%", opacity: showWarning ? 0.5 : 1 }} disabled={showWarning}>
          <span>Simulate Call During Banking</span>
          <span className="cta-arrow"><IconArrow /></span>
        </button>
        <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 14, marginBottom: 0 }}>
          Capacitor: Uses PhoneStateListener to detect real call state.
        </p>
      </div>

      {/* Status */}
      <div className="glass tcard">
        <p className="clabel">Current status</p>
        <div className="kv">
          <span className="k">Phone state</span>
          <span className={`v ${isOnCall ? "bad" : "ok"}`}>{isOnCall ? "ON CALL" : "Idle"}</span>
        </div>
        <div className="kv">
          <span className="k">Banking app</span>
          <span className="v ok">Active</span>
        </div>
      </div>
    </div>
  );
};

export default CyberSanchaarShield;
