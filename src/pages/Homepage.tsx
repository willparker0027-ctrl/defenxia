import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSheet } from "@/components/mockup/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { QuickActionButton } from "@/components/quick-action-button";
import DraggableOrb from "@/components/DraggableOrb";
import { invokeEdgeFunction } from "@/lib/supabase-client";
import {
  IconArrow,
  IconBell,
  IconClock,
  IconProfile,
} from "@/components/mockup/icons";
import {
  AlertTriangle,
  Database,
  Globe,
  Landmark,
  LifeBuoy,
  Lock,
  Newspaper,
  QrCode,
  Search,
  Settings,
  Shield,
  Wifi,
  MessageSquareWarning,
} from "lucide-react";
import { nativeNfcService } from "@/services/nativeNfcService";
import { desktopBridge, isDesktopApp } from "@/services/desktopBridge";
import type { LucideIcon } from "lucide-react";

type QuickAction = {
  icon: LucideIcon;
  label: string;
  sub: string;
  path: string;
  img: string;
};

/* Every feature route from the IoT homepage, as tall portrait tool cards —
   icon chip, bold title, muted subtitle. On desktop the mobile-only
   "App Permissions" entry becomes the native Windows "App Lock". */
const buildQuickActions = (desktop: boolean): QuickAction[] => [
  { icon: Newspaper, label: "Cyber News", sub: "Latest threat alerts", path: "/cyber-news", img: "modules/mod-cyber-news.png" },
  { icon: LifeBuoy, label: "Cyber Help", sub: "Get help with scams", path: "/cyber-help", img: "modules/mod-cyber-help.png" },
  { icon: Landmark, label: "Secure Banking", sub: "Open a safer session", path: "/bank-shield", img: "modules/mod-secure-banking.png" },
  { icon: MessageSquareWarning, label: "AI And SMS Shield", sub: "Spot risky messages", path: "/ai-sms-shield", img: "modules/mod-ai-sms.png" },
  { icon: QrCode, label: "Scan QR Code", sub: "See where it leads", path: "/qr-scanner", img: "modules/mod-qr-code.png" },
  { icon: Wifi, label: "WiFi Security", sub: "Check network safety", path: "/wifi-security", img: "modules/mod-wifi.png" },
  { icon: Globe, label: "Scan Website", sub: "Inspect risky links", path: "/website-scanner", img: "modules/mod-website.png" },
  { icon: Shield, label: "Report & Analysis", sub: "AI threat report", path: "/report-analysis", img: "modules/mod-report.png" },
  { icon: Database, label: "Data Breach", sub: "Check exposed data", path: "/data-breach", img: "modules/mod-breach.png" },
  desktop
    ? { icon: Lock, label: "App Lock", sub: "Lock Windows software", path: "/app-lock", img: "modules/mod-permissions.png" }
    : { icon: Settings, label: "App Permissions", sub: "Review app access", path: "/app-permissions", img: "modules/mod-permissions.png" },
  { icon: Search, label: "Scan Files", sub: "Detect malware", path: "/virus-scanner", img: "modules/mod-scan-files.png" },
  { icon: AlertTriangle, label: "IP Security Check", sub: "Verify your IP", path: "/ip-security-check", img: "modules/mod-ip-check.png" },
];

/**
 * Desktop security score, computed from REAL signals (no invented numbers):
 * +20 NFC reader connected · +20 security card registered · +20 backup PIN
 * set · +20 Wi-Fi on WPA2/WPA3 · +20 Windows Firewall profile enabled.
 */
const computeDesktopScore = async (): Promise<number> => {
  let score = 0;
  try {
    const [status, cards, hasPin, wifi, fw] = await Promise.all([
      nativeNfcService.getNfcStatus(),
      nativeNfcService.getAuthorizedCards(),
      desktopBridge.hasPin(),
      desktopBridge.getWifi(),
      desktopBridge.getFirewall(),
    ]);
    if (status.available && status.enabled) score += 20;
    if (cards && (cards.blueCard?.registered || cards.whiteCard?.registered)) score += 20;
    if (hasPin) score += 20;
    const auth = (wifi.connected?.auth || "").toLowerCase();
    if (wifi.ok && wifi.connected && (auth.includes("wpa3") || auth.includes("wpa2"))) score += 20;
    if (fw.ok && (fw.domain || fw.private || fw.public)) score += 20;
  } catch {
    /* partial score stands */
  }
  return score;
};

/* Device score ring geometry — clean SVG progress ring, number centered
   inside, label below. */
const SCORE_SIZE = 148;
const SCORE_STROKE = 6;
const SCORE_RADIUS = (SCORE_SIZE - SCORE_STROKE) / 2;
const SCORE_CIRC = 2 * Math.PI * SCORE_RADIUS;
const SCORE_C = SCORE_SIZE / 2;

const greeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  return "evening";
};

const Homepage = () => {
  const navigate = useNavigate();
  const { openSheet } = useSheet();
  const { openAuthModal } = useAuth();
  const daypart = greeting();

  const [desktop] = useState(isDesktopApp());
  const quickActions = useMemo(() => buildQuickActions(desktop), [desktop]);

  const [isScanning, setIsScanning] = useState(false);
  const [deviceScore, setDeviceScore] = useState(0);

  /* Score ring animation — counts 0→target while the gradient arc draws
     itself. Mobile keeps the legacy 100 target; desktop animates to the
     real composite score computed from live signals. Tapping replays it. */
  const scoreRaf = useRef(0);
  const playScoreAnimation = useCallback(async () => {
    cancelAnimationFrame(scoreRaf.current);
    let target = 100;
    if (isDesktopApp()) {
      target = await computeDesktopScore();
    }
    const DURATION = 1600;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDeviceScore(Math.round(eased * target));
      if (p < 1) scoreRaf.current = requestAnimationFrame(tick);
    };
    scoreRaf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    playScoreAnimation();
    return () => cancelAnimationFrame(scoreRaf.current);
  }, [playScoreAnimation]);

  const handleComprehensiveScan = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await invokeEdgeFunction("comprehensive-scan", {
        target: window.location.hostname || "current-device",
        scanType: "device",
      });

      if (error) {
        console.error("Comprehensive scan error:", error);
        toast.error("Failed to perform comprehensive scan");
      } else {
        console.log("Comprehensive scan results:", data);
        toast.success("Comprehensive scan completed successfully");
        navigate("/scanning", { state: { scanResults: data } });
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Error performing comprehensive scan");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="home">
      <div className="greet">
        <div>
          <div className="eyebrow">DEFENXIA</div>
          <h1 className="serif">
            Good
            <br />
            {daypart}.
          </h1>
        </div>
        <div className="greet-icons">
          <button
            className="glass gicon"
            aria-label="Notifications"
            onClick={() =>
              openSheet({
                icon: <IconBell />,
                title: "Notifications",
                desc: "You're all caught up. DEFENXIA will alert you here the moment a threat is detected on this device.",
              })
            }
          >
            <IconBell />
          </button>
          <button
            className="glass gicon"
            aria-label="Login and signup"
            onClick={() => openAuthModal("login")}
          >
            <IconProfile />
          </button>
        </div>
      </div>

      <div className="glass status">
        <h2 className="serif">
          Ready for a<br />
          safety check.
        </h2>
        <div className="scan-area">
          <div className="score">
            <div
              className="score-ring"
              role="button"
              tabIndex={0}
              title="Tap to replay the score animation"
              aria-label={`Device score ${deviceScore} percent. Activate to replay the animation.`}
              onClick={playScoreAnimation}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  playScoreAnimation();
                }
              }}
            >
              <svg
                width={SCORE_SIZE}
                height={SCORE_SIZE}
                viewBox={`0 0 ${SCORE_SIZE} ${SCORE_SIZE}`}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="homeScoreGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#f9613f" />
                    <stop offset="55%" stopColor="#e8357b" />
                    <stop offset="100%" stopColor="#8b3df0" />
                  </linearGradient>
                </defs>
                <circle
                  cx={SCORE_C}
                  cy={SCORE_C}
                  r={SCORE_RADIUS}
                  stroke="rgba(205,194,247,.12)"
                  strokeWidth={SCORE_STROKE}
                  fill="none"
                />
                <circle
                  cx={SCORE_C}
                  cy={SCORE_C}
                  r={SCORE_RADIUS}
                  stroke="url(#homeScoreGradient)"
                  strokeWidth={SCORE_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={SCORE_CIRC}
                  strokeDashoffset={
                    SCORE_CIRC - (deviceScore / 100) * SCORE_CIRC
                  }
                  transform={`rotate(-90 ${SCORE_C} ${SCORE_C})`}
                  className="score-arc"
                  style={{ transition: "none" }}
                />
              </svg>
              <div className="score-num">
                {deviceScore}
                <span>%</span>
              </div>
            </div>
            <div className="score-label">
              {desktop
                ? deviceScore >= 80
                  ? "Well protected"
                  : deviceScore >= 40
                    ? "Partially protected"
                    : "Needs attention"
                : "Secure and optimized"}
            </div>
          </div>
        </div>
        <button
          className="cta"
          onClick={handleComprehensiveScan}
          disabled={isScanning}
        >
          <span>{isScanning ? "Scanning…" : "Run safety check"}</span>
          <span className="cta-arrow">
            <IconArrow />
          </span>
        </button>
      </div>

      {/* Flagship module — Safe Room sits above every other module. */}
      <button
        type="button"
        className="glass flagship signal-row"
        onClick={() => navigate("/safe-room")}
        aria-label="Open Safe Room"
      >
        <img src="modules/mod-flagship-saferoom.png" alt="" className="flagship-img" draggable={false} />
        <div className="flagship-text">
          <b>Safe Room</b>
          <small>Run risky APKs in isolation</small>
        </div>
        <div className="ready">READY</div>
      </button>

      {/* Phone-as-key module — sits directly under Safe Room. */}
      <button
        type="button"
        className="glass flagship signal-row"
        onClick={() => navigate("/windows-key")}
        aria-label="Open Unlock Windows Wirelessly"
      >
        <img src="modules/mod-flagship-windows.png" alt="" className="flagship-img" draggable={false} />
        <div className="flagship-text">
          <b>Unlock Windows Wirelessly</b>
          <small>Tap a card on your phone to unlock your PC</small>
        </div>
        <div className="ready">NEW</div>
      </button>

      <div className="tools-head">
        <h2 className="serif">Protection tools</h2>
        <p>Tap a tool to open</p>
      </div>
      <div className="grid">
        {quickActions.map((action) => (
          <QuickActionButton
            key={action.path}
            icon={action.icon}
            label={action.label}
            sub={action.sub}
            img={action.img}
            onClick={() => navigate(action.path)}
          />
        ))}
      </div>

      <div className="glass recent">
        <div className="recent-top">
          <h3>Recent activity</h3>
          <span>THIS DEVICE</span>
        </div>
        <div className="clock">
          <IconClock />
        </div>
        <b>No checks yet</b>
        <p>Run a safety check to see a simple summary here.</p>
      </div>

      {/* Floating DEFENXIA voice orb — draggable, tap to talk */}
      <DraggableOrb />
    </div>
  );
};

export default Homepage;
