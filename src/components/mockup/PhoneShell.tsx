import { useEffect, type ReactNode } from "react";
import bgVideo from "../../assets/app-bg-video.mp4";
import { useLocation } from "react-router-dom";
import { useGlassShine } from "../Atmosphere";
import { SheetProvider } from "./sheet";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useSimulation } from "../../contexts/SimulationContext";
import { SimulateAttackPanel } from "../SimulateAttackPanel";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

/**
 * VideoBackground — full-bleed looping video behind the entire app.
 * Bundled locally (no streaming), with a dark readability veil so
 * text stays legible over the video.
 */
const VideoBackground = () => (
  <div
    aria-hidden
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 0,
      pointerEvents: "none",
      background: "#000",
      overflow: "hidden",
    }}
  >
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    >
      <source src={bgVideo} type="video/mp4" />
    </video>
    {/* readability veil — keeps text crisp over the video */}
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, rgba(6,3,10,.58) 0%, rgba(6,3,10,.34) 38%, rgba(6,3,10,.40) 72%, rgba(6,3,10,.60) 100%)",
      }}
    />
  </div>
);

/**
 * PhoneShell — the reference mockup frame for every route:
 * full-bleed video background, centered 430px phone column,
 * topbar, page content, fixed bottom nav, bottom sheet.
 */
export const PhoneShell = ({ children }: { children: ReactNode }) => {
  const { isSimulating } = useSimulation();
  const { pathname } = useLocation();
  useGlassShine();
  // Voice assistant has its own full-screen UI — hide the bottom nav there.
  const hideBottomNav = pathname === "/voice-assistant";

  return (
    <SheetProvider>
      <ScrollToTop />
      <VideoBackground />
      <div className="phone">
        <TopBar />
        <main>{children}</main>
      </div>
      {!hideBottomNav && <BottomNav />}
      {isSimulating && <SimulateAttackPanel />}
    </SheetProvider>
  );
};
