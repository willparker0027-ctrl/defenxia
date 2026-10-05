import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconShieldCheck,
  IconFileSearch,
  IconGlobe,
  IconBug,
  IconLock,
  IconGear,
  IconActivity,
  IconArrow,
} from "@/components/mockup/icons";

/**
 * Scanning — mockup-styled scan experience.
 * Progress / step logic preserved exactly; only the JSX is re-skinned.
 */
const scanItems = [
  { label: "Initializing security scan...", icon: IconShieldCheck },
  { label: "Checking system files...", icon: IconFileSearch },
  { label: "Analyzing network connections...", icon: IconGlobe },
  { label: "Scanning for malware...", icon: IconBug },
  { label: "Checking data integrity...", icon: IconLock },
  { label: "Verifying system settings...", icon: IconGear },
  { label: "Finalizing security report...", icon: IconActivity },
];

const RING_C = 2 * Math.PI * 100;

const Scanning = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 2;

        // Update current scan item based on progress
        const itemIndex = Math.floor((newProgress / 100) * scanItems.length);
        setCurrentScanIndex(Math.min(itemIndex, scanItems.length - 1));

        if (newProgress >= 100) {
          setIsComplete(true);
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = scanItems[currentScanIndex]?.icon || IconShieldCheck;

  return (
    <div className="tpage">
      <span className="eyebrow">SECURITY SCAN</span>
      <h1 className="serif">Security Scan.</h1>
      <p className="tsub">Please wait while DEFENXIA analyzes your device security.</p>

      <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
        {isComplete && <div className="scan-sweep-line" aria-hidden="true" />}

        <p className="eyebrow" style={{ fontSize: 11, marginBottom: 18 }}>
          {isComplete ? "SCAN COMPLETE" : "SCANNING"}
        </p>

        <div className="scanring" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <svg viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(205,194,247,.08)" strokeWidth="10" />
            <circle
              cx="110"
              cy="110"
              r="100"
              fill="none"
              stroke="#e8357b"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C - (progress / 100) * RING_C}
              style={{
                transition: "stroke-dashoffset .12s linear",
                filter: "drop-shadow(0 0 10px rgba(232,53,123,.6))",
              }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 56, lineHeight: 1 }}>
              {progress}%
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <span className={`ticon ${isComplete ? "" : "animate-pulse-aurora"}`} style={{ width: 52, height: 52, borderRadius: 17 }}>
            <CurrentIcon style={{ width: 24, height: 24, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", textAlign: "left" }}>
            {isComplete ? "Finalizing security report..." : scanItems[currentScanIndex]?.label || "Scanning..."}
          </span>
        </div>

        {isComplete && (
          <div className="animate-fade-in" style={{ marginTop: 26 }}>
            <h3 className="ok" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, marginBottom: 8 }}>
              Scan Complete!
            </h3>
            <p style={{ marginBottom: 22 }}>Your device security has been analyzed successfully.</p>
            <button type="button" onClick={() => navigate("/")} className="cta" style={{ minWidth: 250, margin: "0 auto" }}>
              <span>View Results</span>
              <span className="cta-arrow">
                <IconArrow />
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="glass tcard">
        <p className="clabel">Scan steps</p>
        {scanItems.map((item, index) => {
          const isCompleted = index < currentScanIndex;
          const isCurrent = index === currentScanIndex && !isComplete;
          const StepIcon = item.icon;
          return (
            <div className="trow" key={item.label}>
              <span className="ticon" style={{ width: 48, height: 48, borderRadius: 16 }}>
                <StepIcon
                  style={{
                    width: 22,
                    height: 22,
                    stroke: isCompleted ? "#8fd0a8" : "#cdc2f7",
                    fill: "none",
                    strokeWidth: 1.7,
                  }}
                />
              </span>
              <div style={{ flex: 1, fontSize: 15, color: isCompleted ? "var(--ink)" : "var(--muted)" }}>
                {item.label}
              </div>
              <span
                className="eyebrow"
                style={{ fontSize: 10, color: isCompleted ? "#8fd0a8" : isCurrent ? "#f5a524" : "var(--faint)" }}
              >
                {isCompleted || (isComplete && index <= currentScanIndex) ? "DONE" : isCurrent ? "ACTIVE" : "QUEUED"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Scanning;
