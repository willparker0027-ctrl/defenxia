import { useState, useEffect } from "react";
import { useSimulation } from "@/contexts/SimulationContext";
import { analyzeIncomingSMS } from "@/pages/AISMSShield";
import { insertWithSession } from "@/lib/supabase-client";
import { toast } from "sonner";
import { ShieldAlert, MessageSquareWarning, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const FAKE_SCAM_SMS = "Dear Customer, your KYC verification has expired. Click here to update immediately: http://fake-bank-kyc.com or your account will be blocked in 24 hours. Share OTP to verify.";

export const SimulateAttackPanel = () => {
  const [phase, setPhase] = useState<'idle' | 'sms' | 'screen' | 'done'>('idle');
  const [showSmsAlert, setShowSmsAlert] = useState(false);
  const [showScreenAlert, setShowScreenAlert] = useState(false);
  const { setIsSimulating } = useSimulation();

  useEffect(() => {
    // Start simulation sequence
    const timer1 = setTimeout(() => {
      setPhase('sms');
      setShowSmsAlert(true);

      // Analyze and log the fake SMS
      const result = analyzeIncomingSMS(FAKE_SCAM_SMS);
      insertWithSession('security_threats' as any, {
        type: 'sms_fraud_simulation',
        content: FAKE_SCAM_SMS,
        severity: result.severity,
      } as any).catch(console.error);

      toast.error('🚨 SIMULATED: Scam SMS Detected!', {
        description: 'KYC fraud attempt intercepted',
        duration: 5000,
      });
    }, 1500);

    const timer2 = setTimeout(() => {
      setPhase('screen');
      setShowSmsAlert(false);
      setShowScreenAlert(true);

      insertWithSession('security_threats' as any, {
        type: 'screen_share_simulation',
        content: 'Simulated screen-sharing app detected (AnyDesk)',
        severity: 'critical',
      } as any).catch(console.error);

      toast.error('🚨 SIMULATED: Screen Sharing Detected!', {
        description: 'AnyDesk-like activity blocked',
        duration: 5000,
      });
    }, 8000);

    const timer3 = setTimeout(() => {
      setPhase('done');
      setShowScreenAlert(false);
      toast.success('✅ Simulation Complete', {
        description: 'All threats were detected and blocked successfully.',
      });
      setIsSimulating(false);
    }, 14000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [setIsSimulating]);

  return (
    <>
      {/* Fake Scam SMS Alert */}
      <Dialog open={showSmsAlert} onOpenChange={setShowSmsAlert}>
        <DialogContent className="glass glass-card">
          <DialogHeader>
            <DialogTitle className="text-magenta flex items-center gap-2 text-xl font-serif">
              <MessageSquareWarning className="h-6 w-6" />
              🚨 SCAM SMS INTERCEPTED
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <div className="bg-[rgba(205,194,247,0.04)] rounded-[18px] border border-[rgba(205,194,247,0.10)] p-3">
                <p className="text-sm text-faint italic">"{FAKE_SCAM_SMS}"</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {['kyc', 'otp', 'account will be blocked', 'click here immediately'].map((kw, i) => (
                  <span key={i} className="text-xs bg-[#c93a72]/20 text-[#ff6b6b] border border-[#c93a72]/40 px-2 py-1 rounded-full font-mono">
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-sm text-lav font-semibold">
                ⚠️ This is a SIMULATION for demo purposes.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Screen Share Alert Overlay */}
      {showScreenAlert && (
        <div className="fixed inset-0 z-[9999] bg-[#060609]/95 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-fade-in">
          <div className="relative">
            <ShieldAlert className="h-24 w-24 text-[#ff6b6b] animate-pulse drop-shadow-[0_0_24px_rgba(193,74,94,0.6)]" />
          </div>
          <h1 className="text-3xl font-bold text-ink text-center font-serif">
            🚨 SCREEN SHARING DETECTED
          </h1>
          <div className="flex items-center gap-2 bg-[#c93a72]/15 border border-[#c93a72]/40 rounded-full px-6 py-3">
            <EyeOff className="h-5 w-5 text-[#ff6b6b]" />
            <span className="text-[#ff6b6b] font-semibold">AnyDesk Activity Blocked</span>
          </div>
          <p className="text-faint text-center text-sm px-8">
            Privacy shield activated. This is a SIMULATION demonstrating real-time threat response.
          </p>
        </div>
      )}
    </>
  );
};
