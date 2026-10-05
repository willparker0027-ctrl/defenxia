import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Nfc, CheckCircle2, AlertTriangle, Smartphone, KeyRound, Wifi, QrCode, X, UserRound, Fingerprint } from "lucide-react";
import QrScanner from "qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { nativeNfcService } from "@/services/nativeNfcService";
import { isNativePlatform, isFingerprintAvailable, authenticateFingerprint } from "@/services/fingerprintAuth";
import { isDesktopApp } from "@/services/desktopBridge";

type Phase = "enter" | "connecting" | "tap" | "sending" | "sent" | "error";

const EMAIL_MISMATCH_MSG = "Dono devices par same email se login karo.";
const LOGIN_REQUIRED_MSG = "Pehle app me login karo — phone unlock ke liye login zaroori hai.";

interface PairPayload {
  v: number;
  code: string;
  userId: string;
  email: string;
}

/**
 * Unlock Windows Wirelessly — the phone side of the Windows app-lock link.
 *
 * Same-email binding: works ONLY when this phone is logged in with the
 * SAME Supabase account as the Windows app. The Windows overlay shows a
 * 6-digit code + QR {v:1, code, userId, email}; this module joins the
 * channel `defenxia-winlock:<userId>:<code>`, says 'hello', waits for
 * 'welcome', then listens for an NFC tap and AUTO-publishes
 * {type:'approve', uid} the moment a card touches the phone — no manual
 * send button. The PC verifies the UID against its registered cards and
 * unlocks by itself. On phones with biometrics, an "Unlock with fingerprint"
 * button publishes {type:'approve-fingerprint'} instead — the phone's
 * biometric IS the auth, no UID check on the PC side.
 */
const WindowsKey = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("enter");
  const [message, setMessage] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myUserId, setMyUserId] = useState("");
  const [noLogin, setNoLogin] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fingerprintSupported, setFingerprintSupported] = useState(false);
  const [fpMessage, setFpMessage] = useState("");
  const channelRef = useRef<any>(null);
  const stopNfcRef = useRef<(() => void) | null>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const helloTimerRef = useRef<number>(0);
  const approvedTimerRef = useRef<number>(0);
  const desktop = isDesktopApp();

  const teardown = useCallback(() => {
    window.clearTimeout(helloTimerRef.current);
    window.clearTimeout(approvedTimerRef.current);
    try {
      if (stopNfcRef.current) stopNfcRef.current();
    } catch { /* ignore */ }
    stopNfcRef.current = null;
    try {
      if (channelRef.current) channelRef.current.unsubscribe();
    } catch { /* ignore */ }
    channelRef.current = null;
  }, []);

  const stopQrScan = useCallback(() => {
    try {
      qrScannerRef.current?.stop();
      qrScannerRef.current?.destroy();
    } catch { /* ignore */ }
    qrScannerRef.current = null;
    if (videoRef.current?.srcObject) {
      try {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => {
          try { t.stop(); } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setMyUserId(data.user.id);
        setMyEmail(data.user.email || "");
      } else {
        setNoLogin(true);
      }
    }).catch(() => setNoLogin(true));
    // Fingerprint unlock is offered only on the native Android app, and only
    // when the device actually has biometrics enrolled.
    if (isNativePlatform()) {
      isFingerprintAvailable().then(setFingerprintSupported).catch(() => setFingerprintSupported(false));
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("code");
      if (q && /^\d{6}$/.test(q)) setCode(q);
    } catch { /* ignore */ }
    return () => {
      teardown();
      stopQrScan();
    };
  }, [teardown, stopQrScan]);

  const disconnect = useCallback(() => {
    teardown();
    setPhase("enter");
    setMessage("");
    setFpMessage("");
  }, [teardown]);

  const fail = useCallback((msg: string) => {
    teardown();
    setPhase("error");
    setMessage(msg);
  }, [teardown]);

  /* ---- QR scan: parse the PC's pairing payload and enforce same-email ---- */
  const startQrScan = useCallback(async () => {
    if (!myUserId) {
      fail(LOGIN_REQUIRED_MSG);
      return;
    }
    setMessage("");
    setScanning(true);
    await new Promise((r) => setTimeout(r, 150));
    if (!videoRef.current) {
      setScanning(false);
      return;
    }
    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const raw = result.data;
          stopQrScan();
          let payload: PairPayload | null = null;
          try {
            const p = JSON.parse(raw);
            if (p && p.v === 1 && p.code && p.userId) payload = p as PairPayload;
          } catch { /* not our payload */ }
          if (!payload) {
            fail("Ye QR DEFENXIA Windows pairing ka nahi lagta. Dobara scan karo.");
            return;
          }
          if (payload.userId !== myUserId) {
            fail(EMAIL_MISMATCH_MSG);
            return;
          }
          setCode(String(payload.code).replace(/\D/g, "").slice(0, 6));
          setPhase("enter");
        },
        {
          onDecodeError: () => {},
          highlightScanRegion: true,
          preferredCamera: "environment",
          maxScansPerSecond: 8,
        }
      );
      qrScannerRef.current = scanner;
      await scanner.start();
    } catch {
      stopQrScan();
      fail("Camera nahi khul paya. Permission check karo ya code haath se likho.");
    }
  }, [myUserId, stopQrScan, fail]);

  /* ---- Connect: join the per-user channel, handshake, then auto-listen ---- */
  const connect = useCallback(async () => {
    const clean = code.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) {
      fail("Enter the 6-digit code shown on your Windows PC.");
      return;
    }
    if (!myUserId) {
      fail(LOGIN_REQUIRED_MSG);
      return;
    }
    setPhase("connecting");
    setMessage("");
    setFpMessage("");
    teardown();

    try {
      const topic = `defenxia-winlock:${myUserId}:${clean}`;
      const channel = supabase.channel(topic, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel.on("broadcast", { event: "welcome" }, () => {
        window.clearTimeout(helloTimerRef.current);
        // PC confirmed: same account, listening. Start the NFC auto-listener.
        setPhase("tap");
        nativeNfcService.startCardTester(async (ev) => {
          if (!ev?.uid) return;
          // Auto-publish the MOMENT a card is tapped — no manual button.
          // Success is shown ONLY after the PC confirms ('approved').
          setPhase("sending");
          try {
            await channel.send({ type: "broadcast", event: "approve", payload: { uid: ev.uid } });
            window.clearTimeout(approvedTimerRef.current);
            approvedTimerRef.current = window.setTimeout(() => {
              fail("PC ne unlock confirm nahi kiya. Card PC par registered hai? Dobara try karo.");
            }, 15000);
          } catch {
            fail("Could not send the unlock signal. Check your internet and try again.");
          }
        }).then((stop) => {
          stopNfcRef.current = stop;
        }).catch(() => {
          fail("Could not start NFC listening. Make sure NFC is switched on in this phone's settings.");
        });
      });

      channel.on("broadcast", { event: "approved" }, () => {
        window.clearTimeout(approvedTimerRef.current);
        try { if (stopNfcRef.current) stopNfcRef.current(); } catch { /* ignore */ }
        stopNfcRef.current = null;
        setPhase("sent");
      });

      channel.on("broadcast", { event: "denied" }, (msg) => {
        window.clearTimeout(approvedTimerRef.current);
        const reason = msg?.payload?.reason;
        fail(reason === "email-mismatch" ? EMAIL_MISMATCH_MSG : reason === "card not registered" ? "Ye card PC par registered nahi hai — pehle PC ke NFC Keys me register karo." : "PC ne request reject kar di. Dobara try karo.");
      });

      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // Say hello so the PC can confirm the same-email binding.
          channel.send({ type: "broadcast", event: "hello", payload: { userId: myUserId, email: myEmail } }).catch(() => {});
          helloTimerRef.current = window.setTimeout(() => {
            fail("PC se connect nahi ho paya. Code sahi hai aur PC par pairing active hai?");
          }, 10000);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          fail("Could not reach the unlock service. Check your internet connection and try again.");
        }
      });
    } catch {
      fail("Something went wrong. Check your internet and try again.");
    }
  }, [code, myUserId, myEmail, teardown, fail]);

  /* ---- Fingerprint: phone biometric becomes the unlock auth ---- */
  const unlockWithFingerprint = useCallback(async () => {
    const result = await authenticateFingerprint();
    if (!result.ok) {
      // Biometric failed/cancelled — show the message, send NO broadcast.
      setFpMessage(result.message || "Fingerprint authenticate nahi ho paya. Dobara try karo.");
      return;
    }
    setFpMessage("");
    // Success is shown ONLY after the PC confirms ('approved') — the same
    // confirmation logic the NFC approve flow uses, verbatim.
    setPhase("sending");
    try {
      await channelRef.current.send({ type: "broadcast", event: "approve-fingerprint", payload: {} });
      window.clearTimeout(approvedTimerRef.current);
      approvedTimerRef.current = window.setTimeout(() => {
        fail("PC ne unlock confirm nahi kiya. Dobara try karo.");
      }, 15000);
    } catch {
      fail("Could not send the unlock signal. Check your internet and try again.");
    }
  }, [fail]);

  return (
    <div className="tpage">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-[13px] font-medium text-[#b9b0d9] transition hover:text-white"
        aria-label="Go back"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <span className="eyebrow">WINDOWS LINK</span>
      <h1 className="serif">
        Unlock Windows
        <br />
        Wirelessly.
      </h1>
      <p className="tsub">
        Your phone becomes the key for your PC. Open a locked app on Windows, tap{" "}
        <b>“Unlock with phone”</b>, enter the 6-digit code here, then tap your NFC card on the
        back of this phone — or unlock with your fingerprint if this phone supports it. Both
        devices must be logged in with the <b>same email</b>.
      </p>

      {desktop && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/8 p-4 text-[13px] leading-relaxed text-amber-200/90">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          This module is meant for your phone. Install the DEFENXIA app on your Android phone and
          open “Unlock Windows Wirelessly” there.
        </div>
      )}

      {noLogin ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-400/8 p-4 text-[13.5px] leading-relaxed text-red-200/90">
          <UserRound size={16} className="mt-0.5 shrink-0" />
          {LOGIN_REQUIRED_MSG}
        </div>
      ) : myEmail ? (
        <div className="mt-4 flex items-center gap-2 text-[12.5px] text-[#8f86b3]">
          <CheckCircle2 size={14} className="text-emerald-300" />
          Logged in as <b className="text-white">{myEmail}</b>
        </div>
      ) : null}

      {(phase === "enter" || phase === "error") && !noLogin ? (
        <div className="mt-6">
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f9613f] via-[#e8357b] to-[#8b3df0]">
                <KeyRound size={20} className="text-white" />
              </span>
              <div>
                <b className="text-[15px] text-white">Pairing code</b>
                <p className="text-[12.5px] text-[#b9b0d9]">Shown on your Windows lock screen</p>
              </div>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="••••••"
              maxLength={6}
              className="mt-4 w-full rounded-2xl border border-[rgba(205,194,247,0.16)] bg-[rgba(205,194,247,0.05)] py-4 text-center text-3xl font-bold tracking-[0.5em] text-white placeholder:text-[#5b5478] focus:border-[#e8357b]/60 focus:outline-none"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={startQrScan}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(205,194,247,0.16)] bg-[rgba(205,194,247,0.05)] py-3 text-[14px] font-semibold text-white transition hover:bg-[rgba(205,194,247,0.1)]"
              >
                <QrCode size={17} /> Scan QR
              </button>
              <button
                onClick={connect}
                disabled={code.replace(/\D/g, "").length !== 6}
                className="rounded-2xl bg-gradient-to-r from-[#f9613f] via-[#e8357b] to-[#8b3df0] py-3 text-[14px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(232,53,123,0.7)] transition hover:brightness-110 disabled:opacity-40"
              >
                Connect
              </button>
            </div>
          </div>
          {phase === "error" && message && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-400/8 p-4 text-[13px] leading-relaxed text-red-200/90">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {message}
            </div>
          )}
          <div className="mt-6 space-y-3 text-[13px] text-[#b9b0d9]">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8357b]/15 text-[12px] font-bold text-[#e8357b]">1</span>
              <p>On your PC, open the locked app and tap <b className="text-white">“Unlock with phone”</b>. Scan the QR or type the code.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8357b]/15 text-[12px] font-bold text-[#e8357b]">2</span>
              <p>Make sure this phone is logged in with the <b className="text-white">same email</b> as the PC app.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8357b]/15 text-[12px] font-bold text-[#e8357b]">3</span>
              <p>Tap your registered NFC card on the back of this phone — it sends the unlock signal by itself, and your PC unlocks. No card handy? The <b className="text-white">“Unlock with fingerprint”</b> button on the next screen works too, on supported phones.</p>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "connecting" ? (
        <div className="glass mt-6 flex flex-col items-center rounded-3xl p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8357b]/12">
            <Wifi size={28} className="animate-pulse text-[#e8357b]" />
          </span>
          <b className="mt-4 text-[16px] text-white">Connecting to your PC…</b>
          <p className="mt-1 text-[13px] text-[#b9b0d9]">Verifying the same-email binding</p>
          <button onClick={disconnect} className="mt-5 text-[13px] font-medium text-[#8f86b3] underline">
            Cancel
          </button>
        </div>
      ) : null}

      {phase === "tap" || phase === "sending" ? (
        <div className="glass mt-6 flex flex-col items-center rounded-3xl p-8 text-center">
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#e8357b]/20" />
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#f9613f] via-[#e8357b] to-[#8b3df0]">
              <Nfc size={36} className="text-white" />
            </span>
          </span>
          <b className="mt-5 text-[16px] text-white">
            {phase === "sending" ? "Waiting for PC to confirm…" : "Card tap karo ya fingerprint"}
          </b>
          <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-[#b9b0d9]">
            Apna registered NFC card is phone ke back par tap karo — signal khud chala jayega.
            {fingerprintSupported ? " Ya neeche button se fingerprint se unlock karo." : null}
          </p>
          {phase === "tap" && fingerprintSupported ? (
            <button
              onClick={unlockWithFingerprint}
              className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#f9613f] via-[#e8357b] to-[#8b3df0] px-6 py-3 text-[14px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(232,53,123,0.7)] transition hover:brightness-110"
            >
              <Fingerprint size={17} /> Unlock with fingerprint
            </button>
          ) : null}
          {fpMessage ? (
            <p className="mt-3 flex max-w-[280px] items-start gap-2 text-[12.5px] leading-relaxed text-red-300/90">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {fpMessage}
            </p>
          ) : null}
          <button onClick={disconnect} className="mt-5 text-[13px] font-medium text-[#8f86b3] underline">
            Cancel
          </button>
        </div>
      ) : null}

      {phase === "sent" ? (
        <div className="glass mt-6 flex flex-col items-center rounded-3xl p-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/15">
            <CheckCircle2 size={40} className="text-emerald-300" />
          </span>
          <b className="mt-5 text-[16px] text-white">PC unlocked ✓</b>
          <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-[#b9b0d9]">
            Your PC confirmed the unlock. You can put the phone away.
          </p>
          <button
            onClick={disconnect}
            className="mt-5 w-full rounded-2xl border border-[rgba(205,194,247,0.16)] bg-[rgba(205,194,247,0.05)] py-3 text-[14px] font-semibold text-white transition hover:bg-[rgba(205,194,247,0.1)]"
          >
            Done
          </button>
        </div>
      ) : null}

      {/* In-page QR scanner overlay */}
      {scanning && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
          <div className="flex items-center justify-between p-4">
            <b className="text-[15px] text-white">Scan the QR on your PC</b>
            <button
              onClick={stopQrScan}
              aria-label="Close scanner"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          </div>
          <p className="p-4 text-center text-[13px] text-white/70">
            Point the camera at the QR code shown on the Windows lock screen
          </p>
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[rgba(205,194,247,0.12)] bg-[rgba(205,194,247,0.04)] p-4 text-[12.5px] leading-relaxed text-[#8f86b3]">
        <Smartphone size={16} className="mt-0.5 shrink-0" />
        Only cards registered on your PC (NFC Keys) — or this phone's fingerprint on supported
        phones — can unlock it. The pairing code expires after
        2 minutes for your safety.
      </div>
    </div>
  );
};

export default WindowsKey;
