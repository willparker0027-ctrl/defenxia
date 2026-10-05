import { useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  IconBell,
  IconGear,
  IconShieldCheck,
  IconActivity,
  IconLock,
  IconGlobe,
  IconArrow,
} from "@/components/mockup/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { isDesktopApp } from "@/services/desktopBridge";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Settings — every preference toggle, the Simulate Attack demo switch,
 * app information and the danger-zone actions, rendered in the Aurora
 * visual language (serif headline, glass cards, pill switches).
 */
interface SettingItem {
  id: string;
  label: string;
  description: string;
  icon: IconComponent;
  enabled: boolean;
}

const Settings = () => {
  const { isSimulating, setIsSimulating } = useSimulation();
  const { user, signOut, openAuthModal } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settings, setSettings] = useState<SettingItem[]>([
    {
      id: "notifications",
      label: "Enable Notifications",
      description: "Receive alerts about security threats and scan results",
      icon: IconBell,
      enabled: true,
    },
    {
      id: "darkMode",
      label: "Dark Mode",
      description: "Use dark theme for better viewing in low light",
      icon: IconGear,
      enabled: true,
    },
    {
      id: "autoScan",
      label: "Auto Security Scan",
      description: "Automatically run security scans daily",
      icon: IconShieldCheck,
      enabled: false,
    },
    {
      id: "soundAlerts",
      label: "Sound Alerts",
      description: "Play sound notifications for security alerts",
      icon: IconActivity,
      enabled: true,
    },
    {
      id: "realTimeProtection",
      label: "Real-time Protection",
      description: "Monitor system activity continuously",
      icon: IconLock,
      enabled: true,
    },
    {
      id: "language",
      label: "Language",
      description: "English (US)",
      icon: IconGlobe,
      enabled: true,
    },
  ]);

  const toggleSetting = (id: string) => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? { ...setting, enabled: !setting.enabled }
          : setting
      )
    );
  };

  return (
    <div className="tpage">
      <span className="eyebrow">SETTINGS</span>
      <h1 className="serif">Your controls.</h1>
      <p className="tsub">Customize your Defenxia security preferences.</p>

      {/* Account */}
      <div className="glass tcard">
        <p className="clabel">Account</p>
        {user ? (
          <div className="trow" style={{ borderBottom: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </div>
              <div
                style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}
              >
                Signed in
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              style={{ minHeight: 44, padding: "10px 18px" }}
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true);
                await signOut();
                setIsSigningOut(false);
              }}
            >
              {isSigningOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="trow" style={{ borderBottom: "none" }}>
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
              >
                You&apos;re signed out
              </div>
              <div
                style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}
              >
                Sign in to sync your protection
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              style={{ minHeight: 44, padding: "10px 18px" }}
              onClick={openAuthModal}
            >
              Sign in
            </button>
          </div>
        )}
      </div>

      {/* Simulate Attack — demo-only; hidden in the Windows desktop build */}
      {!isDesktopApp() && (
        <div className="glass tcard">
          <div className="trow" style={{ borderBottom: "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#f5a524" }}>
                Simulate Attack
              </div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>
                Trigger fake Scam SMS &amp; Screen Share alert for demo
              </div>
            </div>
            <button
              type="button"
              className="switch"
              aria-checked={isSimulating}
              aria-label="Toggle attack simulation"
              onClick={() => setIsSimulating(!isSimulating)}
            />
          </div>
        </div>
      )}

      {/* Settings list */}
      <div className="glass tcard">
        <p className="clabel">Preferences</p>
        {settings.map((setting) => {
          const Icon = setting.icon;
          return (
            <div key={setting.id} className="trow">
              <div
                className="ticon"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  flexShrink: 0,
                }}
              >
                <Icon style={{ width: 24, height: 24 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
                >
                  {setting.label}
                </div>
                <div
                  style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}
                >
                  {setting.description}
                </div>
              </div>
              {setting.id !== "language" ? (
                <button
                  type="button"
                  className="switch"
                  aria-checked={setting.enabled}
                  aria-label={setting.label}
                  onClick={() => toggleSetting(setting.id)}
                />
              ) : (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ minHeight: 44, padding: "10px 18px" }}
                >
                  Change
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* App information */}
      <div className="glass tcard">
        <p className="clabel">App information</p>
        <div className="kv">
          <span className="k">Version</span>
          <span className="v">2.1.0</span>
        </div>
        <div className="kv">
          <span className="k">Last update</span>
          <span className="v">Dec 22, 2024</span>
        </div>
        <div className="kv">
          <span className="k">Database version</span>
          <span className="v">1.8.3</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button type="button" className="btn-ghost" style={{ flex: 1 }}>
            Check for Updates
          </button>
          <button type="button" className="btn-ghost" style={{ flex: 1 }}>
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass tcard danger">
        <p className="clabel" style={{ color: "#ff6b6b" }}>
          Danger zone
        </p>
        <h3 style={{ color: "#ff6b6b" }}>Start over.</h3>
        <p>These actions cannot be undone. Please proceed with caution.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            type="button"
            className="cta"
            style={{ flex: 1, marginTop: 0 }}
          >
            <span style={{ fontSize: 16 }}>Reset All Settings</span>
            <span className="cta-arrow" style={{ width: 44, height: 44 }}>
              <IconArrow />
            </span>
          </button>
          <button type="button" className="btn-ghost" style={{ flex: 1 }}>
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
