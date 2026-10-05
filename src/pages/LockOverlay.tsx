import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Nfc, Delete, Smartphone, ArrowLeft, AlertTriangle, UserRound, X, Fingerprint } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { desktopBridge, type OverlayTarget } from "@/services/desktopBridge";
import { useAuth } from "@/contexts/AuthContext";

/**
 * LockOverlay — the fullscreen unlock screen rendered inside the Electron
 * overlay window when a protected app comes to the foreground.
 *
 * Unlock paths: NFC card tap (main auto-unlocks), RFID kit tag
 * (keyboard-wedge burst or serial reader), backup PIN,
 * phone-tap via pairing. The native window is hidden by the main process
 * the moment any path succeeds — there is intentionally NO "Unlocked"
 * success screen (it used to linger and lie when a re-lock raced it).
 */
type PhoneMode = "idle" | "starting" | "waiting" | "expired" | "error";

const LockOverlay = () => {
  const { user } = useAuth();
  const [target, setTarget] = useState<OverlayTarget | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phoneMode, setPhoneMode] = useState<PhoneMode>("idle");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [rfidAvailable, setRfidAvailable] = useState(false);
  const [fpEnrolled, setFpEnrolled] = useState(false);
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState("");
  const countdownRef = useRef<number>(0);
  const [countdown, setCountdown] = useState(0);

  const resetLockState = useCallback((nextTarget: OverlayTarget | null) => {
    if (nextTarget) setTarget(nextTarget);
    setPin("");
    setError("");
    setSubmitting(false);
    // The overlay window is reused — refresh unlock-method availability
    // in case the user set something up since the last lock.
    desktopBridge.getRfidTags().then((t) => setRfidAvailable(t.length > 0)).catch(() => {});
    desktopBridge.getFingerprintStatus().then((s) => setFpEnrolled(s.enrolled)).catch(() => setFpEnrolled(false));
    setFpError("");
    window.clearInterval(countdownRef.current);
    desktopBridge.phonePairCancel().catch(() => {});
    setPhoneMode("idle");
    setPhoneCode("");
    setPhoneError("");
    setCountdown(0);
  }, []);

  useEffect(() => {
    desktopBridge.getOverlayTarget().then(setTarget).catch(() => setTarget(null));
    desktopBridge.getRfidTags().then((t) => setRfidAvailable(t.length > 0)).catch(() => {});
    desktopBridge.getFingerprintStatus().then((s) => setFpEnrolled(s.enrolled)).catch(() => setFpEnrolled(false));
    // The overlay window is reused across locks — reset for every fresh lock.
    let offShow: (() => void) | undefined;
    try {
      offShow = desktopBridge.onOverlayShow((t) => resetLockState(t || null));
    } catch { /* ignore */ }
    let offPhone: (() => void) | undefined;
    try {
      offPhone = desktopBridge.onPhoneStatus((s) => {
        // "approved" needs no UI: the main process hides this window natively.
        if (s.state === "waiting") {
          setPhoneMode("waiting");
          setPhoneError("");
        } else if (s.state === "expired") {
          setPhoneMode("expired");
          setCountdown(0);
        } else if (s.state === "denied") {
          setPhoneError(s.reason === "email-mismatch"
            ? "Dono devices par same email se login karo."
            : s.reason === "card not registered"
              ? "That card is not registered on this PC — register it under NFC Keys first."
              : "Phone approval rejected. Try again.");
        } else if (s.state === "error") {
          setPhoneMode("error");
          setPhoneError("Could not reach the unlock service. Check the PC's internet connection.");
        }
      });
    } catch {
      /* phone events unavailable */
    }
    return () => {
      if (typeof offShow === "function") offShow();
      if (typeof offPhone === "function") offPhone();
      desktopBridge.phonePairCancel().catch(() => {});
    };
  }, [resetLockState]);

  const startPhonePair = useCallback(async () => {
    if (!user?.id) {
      setPhoneMode("error");
      setPhoneError("Pehle app me login karo — phone unlock ke liye dono devices par same email se login zaroori hai.");
      return;
    }
    setPhoneError("");
    setPhoneMode("starting");
    const res = await desktopBridge.phonePairStart(user.id, user.email || "");
    if (res?.ok && res.code) {
      setPhoneCode(res.code);
      const secs = Math.max(1, Math.round(((res.expiresAt || Date.now() + 120000) - Date.now()) / 1000));
      setCountdown(secs);
      countdownRef.current = window.setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            window.clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      // 'waiting' arrives via the phone:status event once subscribed.
    } else if (res?.loginRequired) {
      setPhoneMode("error");
      setPhoneError("Pehle app me login karo — phone unlock ke liye dono devices par same email se login zaroori hai.");
    } else {
      setPhoneMode("error");
      setPhoneError(res?.message || "Could not start phone pairing. Check the PC's internet connection.");
    }
  }, [user]);

  const cancelPhonePair = useCallback(() => {
    window.clearInterval(countdownRef.current);
    desktopBridge.phonePairCancel().catch(() => {});
    setPhoneMode("idle");
    setPhoneCode("");
    setPhoneError("");
    setCountdown(0);
  }, []);

  const pressDigit = useCallback(
    (d: string) => {
      setError("");
      setPin((p) => (p + d).slice(0, 6));
    },
    [],
  );

  const backspace = useCallback(() => {
    setError("");
    setPin((p) => p.slice(0, -1));
  }, []);

  /* ✕ (top): close the locked app WITHOUT unlocking it.
     The app process is terminated and was never usable. */
  const [closing, setClosing] = useState(false);
  const closeApp = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      await desktopBridge.closeLockedApp();
    } finally {
      setClosing(false);
    }
  }, [closing]);

  const submitPin = useCallback(async () => {
    if (pin.length < 4 || submitting) return;
    setSubmitting(true);
    try {
      const ok = await desktopBridge.pinUnlockOverlay(pin);
      if (!ok) {
        setError("Incorrect PIN — try again");
        setPin("");
      }
      // On success the main process hides this window natively — no UI needed.
    } finally {
      setSubmitting(false);
    }
  }, [pin, submitting]);

  /* Fingerprint unlock (Mantra MFS100). The main process hides this window
     natively the moment the helper reports a match — on failure we show
     error text under the button. */
  const verifyFingerprint = useCallback(async () => {
    if (fpBusy) return;
    setFpBusy(true);
    setFpError("");
    try {
      const ok = await desktopBridge.verifyFingerprint();
      if (!ok) setFpError("Fingerprint not recognized — try again.");
    } finally {
      setFpBusy(false);
    }
  }, [fpBusy]);

  /* ---- RFID kit: USB keyboard-wedge readers "type" the tag ID very fast.
     A burst is confirmed when a 2nd key arrives within 80ms — the 1st key is
     held tentatively (never eaten as a PIN digit). Human-speed typing goes
     to the PIN pad: digits append, Backspace deletes, Enter submits. ---- */
  useEffect(() => {
    let buf = "";
    let lastAt = 0;
    let idleTimer: number | undefined;
    let burst = false; // true once >=2 keys arrive with <=80ms gaps (wedge)
    const hexLen = (s: string) => s.replace(/[^0-9a-fA-F]/g, "").length;
    const flushRfid = async () => {
      const tag = buf;
      buf = "";
      burst = false;
      window.clearTimeout(idleTimer);
      if (hexLen(tag) >= 8) {
        const ok = await desktopBridge.unlockWithRfid(tag);
        if (!ok) setError("RFID tag not recognized — register it under NFC Keys first.");
      }
    };
    // A burst that turned out to be fast human typing -> replay as PIN digits.
    const replayAsPin = (submit: boolean) => {
      const chars = buf;
      buf = "";
      burst = false;
      window.clearTimeout(idleTimer);
      for (const ch of chars) if (/^[0-9]$/.test(ch)) pressDigit(ch);
      if (submit) submitPin();
    };
    // A lone tentative key that never became a burst was human typing.
    const commitHumanKey = () => {
      const ch = buf;
      buf = "";
      burst = false;
      window.clearTimeout(idleTimer);
      if (/^[0-9]$/.test(ch)) pressDigit(ch);
    };
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      const gap = now - lastAt;
      lastAt = now;
      if (e.key === "Enter") {
        if (burst && buf) {
          if (hexLen(buf) >= 8) flushRfid();
          else replayAsPin(true);
        } else if (buf && !burst) {
          commitHumanKey();
          submitPin();
        } else {
          submitPin();
        }
        return;
      }
      if (e.key === "Backspace") {
        if (!burst) {
          if (buf) commitHumanKey();
          backspace();
        }
        return;
      }
      if (e.key.length === 1) {
        if (buf && gap <= 80) {
          burst = true; // 2nd fast key -> wedge burst confirmed
          buf += e.key;
        } else {
          if (buf && !burst) commitHumanKey(); // previous lone key was human
          buf = e.key; // tentative: burst start or human digit
          burst = false;
        }
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          if (burst) {
            if (hexLen(buf) >= 8) flushRfid();
            else replayAsPin(false);
          } else {
            commitHumanKey();
          }
        }, 200);
        return;
      }
      window.clearTimeout(idleTimer);
      if (buf && !burst) commitHumanKey();
      buf = "";
      burst = false;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(idleTimer);
    };
  }, [pressDigit, backspace, submitPin]);

  const appName = target?.appName || "This application";

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-[#0B0714] text-[#f5f3ff]">
      {/* ✕ — close the locked app without unlocking it */}
      <button
        onClick={closeApp}
        disabled={closing}
        aria-label="Close locked app"
        title="Close this app (it will stay locked)"
        className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(205,194,247,0.18)] bg-[rgba(205,194,247,0.06)] text-[#b9b0d9] transition hover:border-[#e8357b]/60 hover:text-white active:scale-95 disabled:opacity-50"
      >
        <X size={20} />
      </button>
      <style>{`
        @keyframes nfc-ring {
          0% { transform: scale(0.55); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes float-soft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .nfc-ring { animation: nfc-ring 2.2s ease-out infinite; }
        .nfc-ring-2 { animation-delay: 0.7s; }
        .nfc-ring-3 { animation-delay: 1.4s; }
        .float-soft { animation: float-soft 4s ease-in-out infinite; }
      `}</style>

      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-[#e8357b]/16 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-[#8b3df0]/16 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-[#f9613f]/10 blur-[120px]" />

      <div className="relative z-10 m-auto flex w-full max-w-md flex-col items-center px-8 py-8 text-center">
          <div className="float-soft relative flex h-44 w-44 items-center justify-center">
            <span className="nfc-ring absolute inset-0 rounded-full border-2 border-[#e8357b]/70" />
            <span className="nfc-ring nfc-ring-2 absolute inset-0 rounded-full border-2 border-[#8b3df0]/60" />
            <span className="nfc-ring nfc-ring-3 absolute inset-0 rounded-full border-2 border-[#f9613f]/50" />
            <span className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#f9613f] via-[#e8357b] to-[#8b3df0] shadow-[0_0_60px_-8px_rgba(232,53,123,0.7)]">
              <Nfc size={48} className="text-white" />
            </span>
          </div>

          <div className="mt-8 flex items-center gap-2 text-[11px] font-bold tracking-[0.3em] text-[#e8357b]">
            <Lock size={13} /> APP LOCKED
          </div>
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-tight">
            {appName}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#b9b0d9]">
            Tap your NFC security card on the reader
            <br />
            to unlock this application.
          </p>

          <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[#8f86b3]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#e8357b]" />
            Waiting for card tap…
          </div>

          {/* Phone-tap unlock — requires the same logged-in email on both devices */}
          <div className="mt-5 w-full">
            {phoneMode === "idle" && !user?.id && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(205,194,247,0.14)] bg-[rgba(205,194,247,0.04)] px-4 py-3 text-[13px] text-[#b9b0d9]">
                <UserRound size={15} className="shrink-0" />
                Pehle app me login karo — phone unlock ke liye login zaroori hai.
              </div>
            )}
            {phoneMode === "idle" && user?.id && (
              <button
                onClick={startPhonePair}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8b3df0]/40 bg-[#8b3df0]/10 py-3 text-[14px] font-semibold text-white transition hover:bg-[#8b3df0]/20 active:scale-[0.99]"
              >
                <Smartphone size={17} />
                Unlock with phone
              </button>
            )}
            {phoneMode === "starting" && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(205,194,247,0.14)] bg-[rgba(205,194,247,0.04)] py-3 text-[13.5px] text-[#b9b0d9]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#8b3df0]/30 border-t-[#8b3df0]" />
                Starting secure pairing…
              </div>
            )}
            {phoneMode === "waiting" && (
              <div className="rounded-3xl border border-[#8b3df0]/30 bg-[#8b3df0]/8 p-5 text-center">
                <p className="text-[12px] font-semibold tracking-[0.2em] text-[#b9b0d9]">
                  ON YOUR PHONE
                </p>
                <p className="mt-1 text-[13px] text-[#8f86b3]">
                  Open DEFENXIA → <b className="text-white">Unlock Windows Wirelessly</b>
                </p>
                <div className="mt-4 flex justify-center">
                  <div className="rounded-2xl bg-white p-3">
                    <QRCodeSVG
                      value={JSON.stringify({ v: 1, code: phoneCode, userId: user?.id || "", email: user?.email || "" })}
                      size={140}
                    />
                  </div>
                </div>
                <div className="mt-4 text-[34px] font-bold tracking-[0.35em] text-white">
                  {phoneCode}
                </div>
                <p className="mt-1 text-[12.5px] text-[#8f86b3]">
                  Enter this code on your phone, then tap your NFC card on the phone.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-[#8f86b3]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#8b3df0]" />
                  Waiting for phone… {countdown > 0 && <span>({countdown}s)</span>}
                </div>
                {phoneError && (
                  <p className="mt-2 text-[12.5px] font-medium text-amber-300">{phoneError}</p>
                )}
                <button
                  onClick={cancelPhonePair}
                  className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-[#8f86b3] underline hover:text-white"
                >
                  <ArrowLeft size={13} /> Back
                </button>
              </div>
            )}
            {(phoneMode === "expired" || phoneMode === "error") && (
              <div className="rounded-2xl border border-red-400/25 bg-red-400/8 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-[13.5px] font-semibold text-red-200">
                  <AlertTriangle size={15} />
                  {phoneMode === "expired" ? "Code expired" : "Pairing failed"}
                </div>
                {phoneError && <p className="mt-1 text-[12.5px] text-red-200/80">{phoneError}</p>}
                <button
                  onClick={startPhonePair}
                  className="mt-3 rounded-xl border border-[#8b3df0]/40 bg-[#8b3df0]/10 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#8b3df0]/20"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* RFID alternative unlock method */}
          {rfidAvailable && (
            <div className="mt-5 flex w-full flex-col gap-2.5">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(205,194,247,0.14)] bg-[rgba(205,194,247,0.04)] px-4 py-3 text-[13px] text-[#b9b0d9]">
                <Nfc size={15} className="shrink-0 text-[#8b3df0]" />
                or tap your RFID tag on the USB reader
              </div>
            </div>
          )}

          {/* Hardware fingerprint unlock (Mantra MFS100) — shown only when enrolled */}
          {fpEnrolled && (
            <div className="mt-5 w-full">
              <button
                onClick={verifyFingerprint}
                disabled={fpBusy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e8357b]/40 bg-[#e8357b]/10 py-3 text-[14px] font-semibold text-white transition hover:bg-[#e8357b]/20 active:scale-[0.99] disabled:opacity-60"
              >
                {fpBusy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e8357b]/30 border-t-[#e8357b]" />
                    Place your finger on the reader…
                  </>
                ) : (
                  <>
                    <Fingerprint size={17} />
                    Unlock with hardware fingerprint
                  </>
                )}
              </button>
              {fpError && <p className="mt-2 text-[13px] font-medium text-red-400">{fpError}</p>}
            </div>
          )}

          <div className="my-6 flex w-full items-center gap-4">
            <span className="h-px flex-1 bg-[rgba(205,194,247,0.14)]" />
            <span className="text-[11px] font-semibold tracking-[0.24em] text-[#8f86b3]">
              OR USE PIN
            </span>
            <span className="h-px flex-1 bg-[rgba(205,194,247,0.14)]" />
          </div>

          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`flex h-12 w-10 items-center justify-center rounded-xl border text-xl font-bold transition-all ${
                  pin[i]
                    ? "border-[#e8357b]/60 bg-[#e8357b]/12 text-white"
                    : "border-[rgba(205,194,247,0.16)] bg-[rgba(205,194,247,0.04)]"
                }`}
              >
                {pin[i] ? "•" : ""}
              </span>
            ))}
          </div>
          {error && <p className="mt-3 text-[13px] font-medium text-red-400">{error}</p>}

          <div className="mt-5 grid w-full max-w-[280px] grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => pressDigit(d)}
                className="rounded-2xl border border-[rgba(205,194,247,0.14)] bg-[rgba(205,194,247,0.05)] py-3.5 text-xl font-semibold text-white transition hover:border-[#e8357b]/50 hover:bg-[#e8357b]/10 active:scale-95"
              >
                {d}
              </button>
            ))}
            <span />
            <button
              onClick={() => pressDigit("0")}
              className="rounded-2xl border border-[rgba(205,194,247,0.14)] bg-[rgba(205,194,247,0.05)] py-3.5 text-xl font-semibold text-white transition hover:border-[#e8357b]/50 hover:bg-[#e8357b]/10 active:scale-95"
            >
              0
            </button>
            <button
              onClick={backspace}
              aria-label="Delete"
              className="flex items-center justify-center rounded-2xl border border-[rgba(205,194,247,0.14)] bg-[rgba(205,194,247,0.05)] py-3.5 text-[#b9b0d9] transition hover:bg-[rgba(205,194,247,0.1)] active:scale-95"
            >
              <Delete size={20} />
            </button>
          </div>

          <button
            onClick={submitPin}
            disabled={pin.length < 4 || submitting}
            className="mt-5 w-full max-w-[280px] rounded-2xl bg-gradient-to-r from-[#f9613f] via-[#e8357b] to-[#8b3df0] py-3.5 text-[15px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(232,53,123,0.7)] transition hover:brightness-110 disabled:opacity-40"
          >
            {submitting ? "Unlocking…" : "Unlock"}
          </button>

          <p className="mt-6 text-[11.5px] tracking-wide text-[#8f86b3]">
            Protected by DEFENXIA · Enhanced lock active
          </p>
        </div>
    </div>
  );
};

export default LockOverlay;
