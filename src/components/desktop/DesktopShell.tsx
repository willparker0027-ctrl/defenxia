import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bug,
  Copy,
  Home,
  Landmark,
  LifeBuoy,
  Lock,
  MessageSquareWarning,
  Minus,
  Newspaper,
  ScanLine,
  Settings,
  ShieldCheck,
  Smartphone,
  Square,
  Vault,
  Wifi,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Atmosphere } from "../Atmosphere";

type NavItem = { icon: LucideIcon; label: string; path: string };

const PRIMARY_NAV: NavItem[] = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Lock, label: "App Lock", path: "/app-lock" },
  { icon: ScanLine, label: "Scan", path: "/scanning" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const MODULE_NAV: NavItem[] = [
  { icon: Landmark, label: "Secure Banking", path: "/bank-shield" },
  { icon: Vault, label: "Safe Room", path: "/safe-room" },
  { icon: Smartphone, label: "Unlock Windows Wirelessly", path: "/windows-key" },
  { icon: MessageSquareWarning, label: "AI SMS Shield", path: "/ai-sms-shield" },
  { icon: Wifi, label: "WiFi Security", path: "/wifi-security" },
  { icon: Bug, label: "Virus Scanner", path: "/virus-scanner" },
  { icon: Newspaper, label: "Cyber News", path: "/cyber-news" },
  { icon: LifeBuoy, label: "Cyber Help", path: "/cyber-help" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all duration-200",
    isActive
      ? "text-white shadow-[0_8px_24px_-8px_rgba(232,53,123,0.55)]"
      : "text-[#b9b0d9] hover:text-white hover:bg-[rgba(205,194,247,0.06)]",
  ].join(" ");

const NavEntry = ({ item }: { item: NavItem }) => (
  <NavLink to={item.path} end={item.path === "/"} className={navLinkClass}>
    {({ isActive }) => (
      <>
        <span
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
            isActive
              ? "bg-gradient-to-br from-[#f9613f] via-[#e8357b] to-[#8b3df0] text-white"
              : "bg-[rgba(205,194,247,0.07)] text-[#cdc2f7] group-hover:text-white",
          ].join(" ")}
        >
          <item.icon size={16} strokeWidth={2.2} />
        </span>
        {item.label}
      </>
    )}
  </NavLink>
);

const TitleBar = () => {
  const [maxed, setMaxed] = useState(false);
  const [version, setVersion] = useState("");

  const refreshMaxed = async () => {
    try {
      setMaxed(await window.defenxia!.window.isMaxed());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refreshMaxed();
    // On-screen version badge so test builds are always identifiable.
    // Shows the FULL version (e.g. v2.9.5), not just major.minor.
    (async () => {
      try {
        const v = await (window as any).defenxia?.getVersion?.();
        if (v) setVersion("v" + String(v));
      } catch { /* ignore */ }
    })();
  }, []);

  const winBtn =
    "flex h-11 w-12 items-center justify-center text-[#b9b0d9] transition-colors hover:bg-[rgba(205,194,247,0.10)] hover:text-white";

  return (
    <header
      className="relative z-20 flex h-11 shrink-0 items-center justify-between border-b border-[rgba(205,194,247,0.10)] bg-[rgba(11,7,20,0.72)] backdrop-blur-xl"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5 pl-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#f9613f] via-[#e8357b] to-[#8b3df0]">
          <ShieldCheck size={14} className="text-white" strokeWidth={2.4} />
        </span>
        <span className="font-serif text-[15px] font-semibold tracking-[0.22em] text-white">
          DEFENXIA
        </span>
        <span className="rounded-full border border-[rgba(205,194,247,0.18)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#8f86b3]">
          DESKTOP
        </span>
        {version && (
          <span className="rounded-full border border-[#e8357b]/45 bg-[#e8357b]/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.18em] text-[#ff8fb0]">
            {version}
          </span>
        )}
      </div>
      <div className="flex items-stretch" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          className={winBtn}
          onClick={() => window.defenxia?.window.minimize()}
          aria-label="Minimize"
        >
          <Minus size={15} />
        </button>
        <button
          className={winBtn}
          onClick={async () => {
            window.defenxia?.window.maximize();
            setTimeout(refreshMaxed, 120);
          }}
          aria-label={maxed ? "Restore" : "Maximize"}
        >
          {maxed ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          className={`${winBtn} hover:!bg-[#e81123] hover:!text-white`}
          onClick={() => window.defenxia?.window.close()}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
};

/**
 * DesktopShell — the Windows desktop frame: custom title bar with window
 * controls, left sidebar navigation, and the main content area. The
 * fullscreen lock-overlay route renders bare (no chrome).
 */
export const DesktopShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (pathname === "/lock-overlay") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0B0714] text-[#f5f3ff]">
      <Atmosphere />
      <TitleBar />
      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-[rgba(205,194,247,0.10)] bg-[rgba(11,7,20,0.55)] px-4 py-6 backdrop-blur-xl">
          <div className="mb-7 px-1">
            <div className="font-serif text-[26px] font-semibold leading-none tracking-[0.14em] text-white">
              DEFENXIA
            </div>
            <div className="mt-1.5 text-[10.5px] font-semibold tracking-[0.3em] text-[#8f86b3]">
              AURORA&nbsp;·&nbsp;WINDOWS
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            <div className="px-3.5 pb-2 text-[10px] font-bold tracking-[0.24em] text-[#8f86b3]">
              NAVIGATION
            </div>
            {PRIMARY_NAV.map((item) => (
              <NavEntry key={item.path} item={item} />
            ))}
            <div className="px-3.5 pb-2 pt-6 text-[10px] font-bold tracking-[0.24em] text-[#8f86b3]">
              MODULES
            </div>
            {MODULE_NAV.map((item) => (
              <NavEntry key={item.path} item={item} />
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-[rgba(205,194,247,0.12)] bg-[rgba(205,194,247,0.04)] p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              Shield active
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#8f86b3]">
              Real-time protection is monitoring this device.
            </p>
          </div>
        </aside>

        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
};
