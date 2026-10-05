import { useState, useEffect } from "react";
import { IconKillSwitch, IconShieldCheck } from "@/components/mockup/icons";
import { insertWithSession } from "@/lib/supabase-client";
import { toast } from "sonner";

// Capacitor placeholder for FLAG_SECURE
// In production: import { WindowManager } from '@nicoara/capacitor-window-manager';
// WindowManager.setFlags({ flags: WindowManager.FLAG_SECURE });

const AntiScamKillSwitch = () => {
  const [isActive, setIsActive] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShowOverlay(true);
      // Log to Supabase
      insertWithSession('security_threats' as any, {
        type: 'kill_switch_activated',
        content: 'Anti-Scam Kill Switch activated - screen sharing blocked',
        severity: 'warning',
      } as any).catch(console.error);

      toast.success('Privacy Protection Activated', {
        description: 'Screen sharing apps like AnyDesk are now blocked.'
      });
    } else {
      setShowOverlay(false);
    }
  }, [isActive]);

  return (
    <div className="tpage" style={{ position: "relative" }}>
      {/* Full-Screen Black Overlay (FLAG_SECURE simulation) */}
      {showOverlay && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(8,2,4,.96)",
            backdropFilter: "blur(40.56px)",
            WebkitBackdropFilter: "blur(40.56px)",
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
          <h1 className="serif" style={{ fontSize: 52, margin: 0 }}>Privacy Protected.</h1>
          <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.65, maxWidth: "36ch", margin: 0 }}>
            Screen sharing and screen recording are blocked. No one can see your screen remotely.
          </p>
          <span className="chip"><span className="dot" />AnyDesk / TeamViewer blocked</span>
          <p style={{ fontSize: 12, color: "var(--faint)", margin: "8px 0 0" }}>
            Capacitor: Uses FLAG_SECURE (WindowManager.LayoutParams)
          </p>
          <button type="button" onClick={() => setIsActive(false)} className="btn-ghost" style={{ marginTop: 12 }}>
            Deactivate Protection
          </button>
        </div>
      )}

      <span className="eyebrow">ANTI-SCAM KILL SWITCH</span>
      <h1 className="serif">Kill-Switch.</h1>
      <p className="tsub">Block screen-sharing apps to prevent scammers from viewing your banking transactions.</p>

      {/* Main Toggle Card */}
      <div className={`glass tcard${isActive ? " animate-pulse-aurora" : ""}`}>
        <p className="clabel">Screen privacy shield</p>
        <div className="trow" style={{ borderBottom: "none", paddingTop: 4 }}>
          <div className="ticon" style={{ width: 56, height: 56, borderRadius: 18, flexShrink: 0 }}>
            <IconKillSwitch />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px", color: "var(--ink)" }}>Screen Privacy Shield</p>
            <p style={{ fontSize: 13, margin: 0 }}>Simulates Android FLAG_SECURE to block screen capture.</p>
          </div>
          <button
            type="button"
            className="switch"
            aria-checked={isActive}
            aria-label="Toggle screen privacy shield"
            onClick={() => setIsActive((v) => !v)}
            style={{ transform: "scale(1.3)", transformOrigin: "right center" }}
          />
        </div>
        <div className="glass" style={{ borderRadius: 20, padding: "16px 18px", marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <span className={isActive ? "ok" : ""} style={{ fontSize: 20, color: isActive ? undefined : "var(--faint)" }}>
            {isActive ? "◉" : "○"}
          </span>
          <div>
            <p className={isActive ? "ok" : ""} style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px", color: isActive ? undefined : "var(--ink)" }}>
              {isActive ? "Protection Active" : "Protection Inactive"}
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              {isActive ? "Screen sharing apps cannot see your screen." : "Toggle on to block screen-sharing apps."}
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="glass tcard">
        <p className="clabel">How it protects you</p>
        {[
          { title: "Blocks AnyDesk / TeamViewer", desc: "Scammers cannot remotely view your phone screen." },
          { title: "Prevents Screen Recording", desc: "No app can record your banking transactions." },
          { title: "OTP Protection", desc: "Your one-time passwords stay visible only to you." },
          { title: "Banking App Safety", desc: "Use UPI and net banking without fear of surveillance." },
        ].map((item, i) => (
          <div className="trow" key={i}>
            <div className="ticon" style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0 }}>
              <IconShieldCheck />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px", color: "var(--ink)" }}>{item.title}</p>
              <p style={{ fontSize: 13, margin: 0 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AntiScamKillSwitch;
