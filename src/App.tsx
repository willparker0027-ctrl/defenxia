import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { PhoneShell } from "./components/mockup/PhoneShell";
import { DesktopShell } from "./components/desktop/DesktopShell";
import { isDesktopApp } from "./services/desktopBridge";
import { SimulationProvider } from "./contexts/SimulationContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthModal } from "./components/AuthModal";
import { nativeNfcService } from "./services/nativeNfcService";
import Homepage from "./pages/Homepage";
import Scanning from "./pages/Scanning";
import QRScanner from "./pages/QRScanner";
import WebsiteScanner from "./pages/WebsiteScanner";
import Settings from "./pages/Settings";
import WiFiSecurity from "./pages/WiFiSecurity";
import ReportAnalysis from "./pages/ReportAnalysis";
import DataBreach from "./pages/DataBreach";
import AppPermissions from "./pages/AppPermissions";
import AISMSShield from "./pages/AISMSShield";
import AntiScamKillSwitch from "./pages/AntiScamKillSwitch";
import CyberSanchaarShield from "./pages/CyberSanchaarShield";
import VirusScanner from "./pages/VirusScanner";
import IPSecurityCheck from "./pages/IPSecurityCheck";
import CyberNews from "./pages/CyberNews";
import CyberHelp from "./pages/CyberHelp";
import ScamGuide from "./pages/ScamGuide";
import SafeRoom from "./pages/SafeRoom";
import WindowsKey from "./pages/WindowsKey";
import BankShield from "./pages/BankShield";
import AIAnalysis from "./pages/AIAnalysis";
import Antivirus from "./pages/Antivirus";
import Firewall from "./pages/Firewall";
import OTPSecurity from "./pages/OTPSecurity";
import VoiceAssistant from "./pages/VoiceAssistant";
import NotFound from "./pages/NotFound";
import LockOverlay from "./pages/LockOverlay";
import AppLockWindows from "./pages/AppLockWindows";

const queryClient = new QueryClient();

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hardware Back Button Navigation Handling (Fixes Issue 10)
  useEffect(() => {
    const handleHardwareBack = () => {
      // 1. Dispatch custom event to check if active view (e.g. BankShield subview) intercepts it
      const subViewEvent = new CustomEvent('defenxia:subViewBack', { cancelable: true });
      const wasIntercepted = !window.dispatchEvent(subViewEvent);

      if (wasIntercepted) {
        return; // Handled by active subview (e.g. returned to dashboard)
      }

      // 2. If on any nested screen other than root, go back one step in browser/route history
      if (location.pathname !== "/") {
        navigate(-1);
      } else {
        // 3. Only if at root screen, exit application
        nativeNfcService.exitApp();
      }
    };

    window.addEventListener('defenxia:hardwareBack', handleHardwareBack);
    return () => {
      window.removeEventListener('defenxia:hardwareBack', handleHardwareBack);
    };
  }, [location.pathname, navigate]);

  return (
    <>
      <AuthModal />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/scanning" element={<Scanning />} />
        <Route path="/qr-scanner" element={<QRScanner />} />
        <Route path="/website-scanner" element={<WebsiteScanner />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/wifi-security" element={<WiFiSecurity />} />
        <Route path="/report-analysis" element={<ReportAnalysis />} />
        <Route path="/data-breach" element={<DataBreach />} />
        <Route path="/app-permissions" element={<AppPermissions />} />
        {/* Desktop-native Windows app locker (Cisdem-style). Kept alongside
            /app-permissions, which the mobile path still uses. */}
        <Route path="/app-lock" element={<AppLockWindows />} />
        <Route path="/ai-sms-shield" element={<AISMSShield />} />
        <Route path="/anti-scam-kill-switch" element={<AntiScamKillSwitch />} />
        <Route path="/cyber-sanchaar-shield" element={<CyberSanchaarShield />} />
        <Route path="/virus-scanner" element={<VirusScanner />} />
        <Route path="/ip-security-check" element={<IPSecurityCheck />} />
        <Route path="/cyber-news" element={<CyberNews />} />
        <Route path="/cyber-help" element={<CyberHelp />} />
        <Route path="/cyber-help/guide/:scamType" element={<ScamGuide />} />
        <Route path="/bank-shield" element={<BankShield />} />
        <Route path="/ai-analysis" element={<AIAnalysis />} />
        <Route path="/antivirus" element={<Antivirus />} />
        <Route path="/firewall" element={<Firewall />} />
        <Route path="/otp-security" element={<OTPSecurity />} />
        <Route path="/voice-assistant" element={<VoiceAssistant />} />
        <Route path="/scam-guide" element={<CyberHelp />} />
        <Route path="/safe-room" element={<SafeRoom />} />
        <Route path="/windows-key" element={<WindowsKey />} />
        <Route path="/lock-overlay" element={<LockOverlay />} />
        {/* Legacy route kept for backward compat */}
        <Route path="/ai-sms-shield-legacy" element={<AISMSShield />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  // Windows desktop (Electron) build: HashRouter (file:// friendly) +
  // DesktopShell frame. Everywhere else: unchanged BrowserRouter + PhoneShell.
  const desktop = isDesktopApp();
  const Router = (desktop ? HashRouter : BrowserRouter) as typeof BrowserRouter;
  const Shell = desktop ? DesktopShell : PhoneShell;
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SimulationProvider>
            <AuthProvider>
              <Shell>
                <AppContent />
              </Shell>
            </AuthProvider>
          </SimulationProvider>
        </TooltipProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
