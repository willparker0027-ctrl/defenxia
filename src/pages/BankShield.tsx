import { useState, useEffect, useCallback, useRef, type FormEvent, type ReactNode } from "react";
import {
  IconBack,
  IconBank,
  IconClock,
  IconLock,
  IconShieldCheck,
  IconKeyRound,
} from "@/components/mockup/icons";
import {
  Radio,
  Cpu,
  Usb,
  Bluetooth,
  CreditCard,
  Smartphone,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  Zap,
  Layers,
  Timer,
  AlertTriangle,
  Code2,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { invokeEdgeFunction, queryWithSession, insertWithSession } from "@/lib/supabase-client";
import { useSerialPort } from "@/hooks/useSerialPort";
import { useBluetoothService } from "@/hooks/useBluetoothService";
import {
  nativeNfcService,
  isNativeAndroid,
  type InstalledApp,
  type CardDetectionEvent,
} from "@/services/nativeNfcService";
import { isDesktopApp } from "@/services/desktopBridge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

/**
 * BankShield — Aurora visual language.
 * ALL functionality from the IoT version preserved; only presentation re-skinned:
 * NFC card tester, authorized card slots, protected apps, permissions guide,
 * Arduino UNO + RC522 IoT hardware check, verification overlay, timed secure
 * sessions, and the NFC authorization audit log.
 */

type ViewState =
  | "dashboard"
  | "nfc-tester"
  | "authorized-cards"
  | "register-apps"
  | "permissions-guide"
  | "iot-hardware-check"
  | "register-rfid"
  | "connect-hardware"
  | "verify"
  | "session"
  | "history"
  | "hardware-guide";

interface BankingApp {
  id: string;
  name: string;
  package: string;
  enabled: boolean;
}

interface RFIDCard {
  id: string;
  uid: string;
  owner_name: string;
  status: "active" | "revoked";
  created_at: string;
}

interface SessionRecord {
  id: string;
  app_name: string;
  rfid_uid: string;
  started_at: string;
  expires_at?: string;
  duration_seconds: number;
  verification_status: string;
}

const DEFAULT_BANKING_APPS: BankingApp[] = [
  { id: "whatsapp", name: "WhatsApp", package: "com.whatsapp", enabled: true },
  { id: "phonepe", name: "PhonePe UPI", package: "com.phonepe.app", enabled: true },
  { id: "gpay", name: "Google Pay", package: "com.google.android.apps.nbu.paisa.user", enabled: true },
  { id: "paytm", name: "Paytm Payments", package: "net.one97.paytm", enabled: true },
  { id: "bhim", name: "BHIM NPCI", package: "in.org.npci.upiapp", enabled: true },
  { id: "sbi", name: "SBI YONO", package: "com.sbi.lotusintouch", enabled: true },
  { id: "gmail", name: "Gmail", package: "com.google.android.gm", enabled: true },
  { id: "chrome", name: "Google Chrome", package: "com.android.chrome", enabled: false },
];

const DEFAULT_RFID_CARDS: RFIDCard[] = [
  { id: "card-1", uid: "97:B4:E9:00", owner_name: "Blue Security KeyFob (Primary)", status: "active", created_at: new Date().toISOString() },
  { id: "card-2", uid: "A1:B2:C3:D4", owner_name: "White Security Card", status: "active", created_at: new Date(Date.now() - 86400000).toISOString() },
];

const ARDUINO_RC522_SKETCH = `#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  delay(300);
  SPI.begin();
  mfrc522.PCD_Init();
  delay(50);
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
  Serial.println("DEFENXIA_RC522_READY");
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  Serial.print("CARD_UID:");
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) Serial.print("0");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
    if (i < mfrc522.uid.size - 1) Serial.print(":");
  }
  Serial.println();
  Serial.flush();

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(500);
}`;

/* ---------- Aurora presentation helpers ---------- */

const ViewHead = ({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: ReactNode;
  sub: string;
}) => (
  <>
    <span className="eyebrow">{eyebrow}</span>
    <h1 className="serif">{title}</h1>
    <p className="tsub">{sub}</p>
  </>
);

const BackButton = ({ onBack, label }: { onBack: () => void; label: string }) => (
  <button
    type="button"
    className="btn-ghost"
    onClick={onBack}
    style={{ marginBottom: 22, padding: "10px 20px", minHeight: 46, fontSize: 14 }}
  >
    <IconBack style={{ width: 16, height: 16 }} />
    {label}
  </button>
);

const AuroraSwitch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className="switch"
    onClick={onChange}
  />
);

const maskUid = (uid: string) => {
  const parts = uid.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}:**:**`;
  return "**:**:**:**";
};

export default function BankShield() {
  const [activeView, setActiveView] = useState<ViewState>("dashboard");

  // Platform & Native State
  const [isAndroidPlatform, setIsAndroidPlatform] = useState(false);
  const [nfcState, setNfcState] = useState({ available: false, enabled: false });
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loadingInstalledApps, setLoadingInstalledApps] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    accessibilityGranted: false,
    usageStatsGranted: false,
    overlayGranted: false,
    batteryOptimizationIgnored: false,
    monitorServiceRunning: false,
  });
  const [lockDiagnostics, setLockDiagnostics] = useState<import("../services/nativeNfcService").LockDiagnostics | null>(null);

  // Authorized Physical Cards
  const [blueCardUid, setBlueCardUid] = useState("97:B4:E9:00");
  const [whiteCardUid, setWhiteCardUid] = useState("");
  const [showBlueUid, setShowBlueUid] = useState(false);
  const [showWhiteUid, setShowWhiteUid] = useState(false);
  const [editingCardSlot, setEditingCardSlot] = useState<"blue" | "white" | null>(null);
  const [cardEditInput, setCardEditInput] = useState("");

  // NFC Card Tester state
  const [testerStatus, setTesterStatus] = useState<"idle" | "waiting" | "detected">("idle");
  const [detectedCard, setDetectedCard] = useState<CardDetectionEvent | null>(null);
  const testerStopRef = useRef<(() => void) | null>(null);

  // Apps & Cards state
  const [bankingApps, setBankingApps] = useState<BankingApp[]>(DEFAULT_BANKING_APPS);
  const [rfidCards, setRfidCards] = useState<RFIDCard[]>(DEFAULT_RFID_CARDS);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // Registration Form State
  const [newCardUid, setNewCardUid] = useState("");
  const [newCardOwner, setNewCardOwner] = useState("");
  const [isRegisteringCard, setIsRegisteringCard] = useState(false);

  // Active Session & Timer
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes (300s)
  const [activeSessionBank, setActiveSessionBank] = useState("PhonePe UPI");
  const [activeSessionUid, setActiveSessionUid] = useState("97:B4:E9:00");

  // Verification state machine
  const [verifyState, setVerifyState] = useState<"waiting" | "reading" | "authorized" | "denied">("waiting");
  const [verifiedCardUid, setVerifiedCardUid] = useState<string | null>(null);

  // Hooks
  const serial = useSerialPort();
  const bluetooth = useBluetoothService();

  // IoT Hardware Check State (Arduino UNO + RC522)
  const [iotTapState, setIotTapState] = useState<"idle" | "reading" | "success">("idle");
  const [scannedIotCard, setScannedIotCard] = useState<{
    uid: string;
    cardName: string;
    timestamp: string;
    protocol: string;
  } | null>(null);
  const [copiedArduinoCode, setCopiedArduinoCode] = useState(false);
  const [serialLogs, setSerialLogs] = useState<
    Array<{ id: string; time: string; text: string; isUid?: boolean }>
  >([
    { id: "init-1", time: new Date().toLocaleTimeString(), text: "RC522 Web Serial Driver Initialized (9600 Baud)." },
  ]);

  // Universal RFID UID extractor that handles every known Arduino RC522 output format
  const parseAnyRfidUid = (input: string): string | null => {
    if (!input) return null;
    const str = input.trim();

    // Pattern 1: 4-byte or 7-byte hex separated by colons, spaces, or hyphens
    // e.g. "97:B4:E9:00", "97 B4 E9 00", "97-B4-E9-00", "04:12:34:56:78:9A:BC"
    const sepMatch = str.match(
      /([0-9A-Fa-f]{2}[:\s\-][0-9A-Fa-f]{2}[:\s\-][0-9A-Fa-f]{2}[:\s\-][0-9A-Fa-f]{2}(?:[:\s\-][0-9A-Fa-f]{2}[:\s\-][0-9A-Fa-f]{2}[:\s\-][0-9A-Fa-f]{2})?)/
    );
    if (sepMatch && sepMatch[1]) {
      return sepMatch[1].trim().replace(/[\s\-]+/g, ":").toUpperCase();
    }

    // Pattern 2: Continuous 8 or 14 hex characters (e.g. "CARD_UID:97B4E900", "97B4E900")
    const hexMatch = str.match(/(?:CARD_UID|UID|AUTHORIZED|DENIED)?[ :]*([0-9A-Fa-f]{8}|[0-9A-Fa-f]{14})\b/i);
    if (hexMatch && hexMatch[1]) {
      const raw = hexMatch[1].toUpperCase();
      return raw.match(/.{1,2}/g)?.join(":") || raw;
    }

    // Pattern 3: Any raw 8 hex characters anywhere in message
    const generalHex = str.match(/\b([0-9A-Fa-f]{8})\b/);
    if (generalHex && generalHex[1]) {
      const raw = generalHex[1].toUpperCase();
      return raw.match(/.{1,2}/g)?.join(":") || raw;
    }

    // Pattern 4: Decimal byte array (e.g. "151 180 233 0" or "151, 180, 233, 0")
    const decMatch = str.match(/\b(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})\b/);
    if (decMatch && decMatch[1] && decMatch[2] && decMatch[3] && decMatch[4]) {
      const b1 = parseInt(decMatch[1], 10);
      const b2 = parseInt(decMatch[2], 10);
      const b3 = parseInt(decMatch[3], 10);
      const b4 = parseInt(decMatch[4], 10);
      if (b1 <= 255 && b2 <= 255 && b3 <= 255 && b4 <= 255) {
        return [b1, b2, b3, b4].map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();
      }
    }

    return null;
  };

  const processIncomingSerial = useCallback(
    (rawMsg: string) => {
      const clean = rawMsg.trim();
      if (!clean) return;

      console.log("[DEFENXIA ARDUINO RC522 RX]:", clean);
      const detectedUid = parseAnyRfidUid(clean);

      // Always log to terminal monitor
      setSerialLogs((prev) => [
        ...prev.slice(-35),
        {
          id: `${Date.now()}-${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          text: `RX: ${clean}`,
          isUid: !!detectedUid,
        },
      ]);

      if (detectedUid) {
        const rawUid = detectedUid.toUpperCase();
        const cleanCompact = rawUid.replace(/:/g, "");
        const isBlue = cleanCompact === "97B4E900" || blueCardUid.replace(/:/g, "") === cleanCompact;
        const isWhite = whiteCardUid && whiteCardUid.replace(/[:\-\s]/g, "").toUpperCase() === cleanCompact;
        const cardName = isBlue
          ? "Authorized Blue KeyFob (97:B4:E9:00)"
          : isWhite
          ? `Authorized White Security Card (${whiteCardUid})`
          : `RFID Card (${rawUid})`;

        setScannedIotCard({
          uid: rawUid,
          cardName,
          timestamp: new Date().toLocaleTimeString(),
          protocol: rawUid.split(":").length === 7 ? "ISO 14443-3A (NTAG / Ultralight 7-Byte)" : "ISO 14443-3A (MIFARE Classic 1K)",
        });
        setIotTapState("success");
        toast.success(`RFID Tap Successful! ${cardName} detected.`);
      }
    },
    [blueCardUid, whiteCardUid]
  );

  // Channel 1: Register callback with serial hook
  useEffect(() => {
    if (activeView === "iot-hardware-check" && serial.isConnected) {
      serial.startListening(processIncomingSerial);
    }
  }, [activeView, serial.isConnected, processIncomingSerial, serial.startListening]);

  // Channel 2: Reactively process serial.lastMessage
  useEffect(() => {
    if (activeView === "iot-hardware-check" && serial.lastMessage) {
      processIncomingSerial(serial.lastMessage);
    }
  }, [activeView, serial.lastMessage, processIncomingSerial]);

  const handleSimulateIotTap = (uid = "97:B4:E9:00") => {
    setIotTapState("reading");
    const nowStr = new Date().toLocaleTimeString();
    setSerialLogs((prev) => [
      ...prev.slice(-35),
      {
        id: `${Date.now()}-1`,
        time: nowStr,
        text: "RX: CARD_DETECTED (MIFARE Classic 1K)",
      },
      {
        id: `${Date.now()}-2`,
        time: nowStr,
        text: `RX: CARD_UID:${uid}`,
        isUid: true,
      },
    ]);

    setTimeout(() => {
      setScannedIotCard({
        uid,
        cardName: "Authorized Blue KeyFob (97:B4:E9:00)",
        timestamp: new Date().toLocaleTimeString(),
        protocol: "ISO 14443-3A (MIFARE Classic 1K)",
      });
      setIotTapState("success");
      toast.success("RFID Tap Successful! Card Verified");
    }, 400);
  };

  // Initialize Native / Web capabilities & cache
  useEffect(() => {
    const isNative = isNativeAndroid();
    setIsAndroidPlatform(isNative);

    // Scroll view to top whenever active view changes
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    if (isNative) {
      // 1. Immediately read cached installed apps from localStorage (0ms delay)
      try {
        const cached = localStorage.getItem("defenxia_installed_apps_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInstalledApps(parsed);
          }
        }
      } catch (e) {
        console.warn("Error reading installed apps cache:", e);
      }

      loadNativeData();
    } else {
      loadSavedData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // Listen to Window Focus and App Lifecycle to automatically refresh permissions after returning from Settings
  useEffect(() => {
    const refreshPermissions = async () => {
      if (isNativeAndroid()) {
        try {
          const perms = await nativeNfcService.checkPermissions();
          setPermissionStatus({ batteryOptimizationIgnored: false, ...perms });
          // Auto-start the UsageStats-based monitor once its permissions are granted
          if (perms.usageStatsGranted && perms.overlayGranted && !perms.monitorServiceRunning) {
            await nativeNfcService.startAppLockMonitor();
          }
          const nfc = await nativeNfcService.getNfcStatus();
          setNfcState(nfc);
        } catch (e) {
          console.warn("Error refreshing permissions on resume:", e);
        }
      }
    };

    const handleSubViewBack = (e: Event) => {
      if (activeView !== "dashboard") {
        e.preventDefault();
        setActiveView("dashboard");
      }
    };

    window.addEventListener("focus", refreshPermissions);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshPermissions();
      }
    });
    window.addEventListener("defenxia:subViewBack", handleSubViewBack);

    return () => {
      window.removeEventListener("focus", refreshPermissions);
      window.removeEventListener("defenxia:subViewBack", handleSubViewBack);
    };
  }, [activeView]);

  const loadNativeData = async () => {
    try {
      const status = await nativeNfcService.getNfcStatus();
      setNfcState(status);

      const cards = await nativeNfcService.getAuthorizedCards();
      if (cards) {
        if (cards.blueCard.registered) setBlueCardUid(cards.blueCard.uidMasked);
        if (cards.whiteCard.registered) setWhiteCardUid(cards.whiteCard.uidMasked);
      }

      const perms = await nativeNfcService.checkPermissions();
      setPermissionStatus({ batteryOptimizationIgnored: false, ...perms });

      loadNativeInstalledApps();
    } catch (e) {
      console.error("Error loading native data:", e);
    }
  };

  const loadNativeInstalledApps = async (force = false) => {
    setLoadingInstalledApps(true);
    try {
      const apps = await nativeNfcService.getInstalledApps(force);
      if (apps && apps.length > 0) {
        setInstalledApps(apps);
        try {
          localStorage.setItem("defenxia_installed_apps_cache", JSON.stringify(apps));
        } catch (e) {
          // LocalStorage quota may be exceeded for large icon sets, safe to ignore
        }
      }
    } catch (err) {
      console.warn("Could not fetch installed apps:", err);
    } finally {
      setLoadingInstalledApps(false);
    }
  };

  const loadSavedData = async () => {
    try {
      // 1. Load banking apps from Supabase
      const { data: appData } = await queryWithSession("banking_apps");
      if (appData && Array.isArray(appData) && appData.length > 0) {
        const mapped = DEFAULT_BANKING_APPS.map((app) => {
          const found = appData.find((a: { package_name: string }) => a.package_name === app.package);
          return found ? { ...app, enabled: found.enabled } : app;
        });
        setBankingApps(mapped);
      }

      // 2. Load RFID cards from Supabase
      const { data: cardData } = await queryWithSession("rfid_cards");
      if (cardData && Array.isArray(cardData) && cardData.length > 0) {
        setRfidCards(
          cardData.map((c: { id: string; uid: string; owner_name?: string; owner?: string; status?: "active" | "revoked"; created_at: string }) => ({
            id: c.id,
            uid: c.uid,
            owner_name: c.owner_name || c.owner || "Registered Card",
            status: c.status || "active",
            created_at: c.created_at,
          }))
        );
      }

      // 3. Load Session history
      const { data: sessionData } = await queryWithSession("secure_sessions");
      if (sessionData && Array.isArray(sessionData) && sessionData.length > 0) {
        setSessions(sessionData);
      }
    } catch (e) {
      console.log("Using local state for banking data");
    }
  };

  // Hardware message listener
  const handleHardwareMessage = useCallback(
    async (msg: string) => {
      const trimmed = msg.trim().toUpperCase();
      console.log("[DEFENXIA HARDWARE MSG]:", trimmed);

      // If on Card Registration view -> capture scanned UID
      if (activeView === "register-rfid") {
        let uid = "";
        if (trimmed.startsWith("AUTHORIZED:")) uid = trimmed.replace("AUTHORIZED:", "");
        else if (trimmed.startsWith("CARD_READ:")) uid = trimmed.replace("CARD_READ:", "");
        else if (trimmed.startsWith("DENIED:")) uid = trimmed.replace("DENIED:", "");
        else if (/^[A-F0-9:]{8,16}$/.test(trimmed)) uid = trimmed;

        if (uid) {
          setNewCardUid(uid);
          toast.success(`RFID Card Detected: ${uid}`);
        }
        return;
      }

      // If on Verification View
      if (activeView === "verify") {
        let uid = "";
        if (trimmed.startsWith("AUTHORIZED:")) uid = trimmed.replace("AUTHORIZED:", "");
        else if (trimmed.startsWith("CARD_READ:")) uid = trimmed.replace("CARD_READ:", "");
        else if (trimmed.startsWith("DENIED:")) uid = trimmed.replace("DENIED:", "");
        else if (/^[A-F0-9:]{8,16}$/.test(trimmed)) uid = trimmed;

        setVerifyState("reading");

        setTimeout(async () => {
          // Verify with authorized cards
          const isAuthorizedCard =
            uid.replace(/:/g, "") === blueCardUid.replace(/:/g, "") ||
            uid.replace(/:/g, "") === whiteCardUid.replace(/:/g, "") ||
            rfidCards.some(
              (c) => c.status === "active" && c.uid.replace(/:/g, "").toUpperCase() === (uid || "97B4E900").replace(/:/g, "").toUpperCase()
            ) ||
            trimmed.startsWith("AUTHORIZED:");

          if (isAuthorizedCard) {
            const finalUid = uid || "97:B4:E9:00";
            setVerifiedCardUid(finalUid);
            setVerifyState("authorized");
            toast.success("RFID Card Authenticated! Unlocking Secure Banking.");

            // Record session in Supabase
            try {
              await invokeEdgeFunction("create-secure-session", {
                app_name: activeSessionBank,
                package_name: "com.phonepe.app",
                rfid_uid: finalUid,
              });
            } catch (err) {
              console.error("Session record error:", err);
            }

            // Transition to active session after 1.5s
            setTimeout(() => {
              setIsSessionActive(true);
              setTimeLeft(300);
              setActiveSessionUid(finalUid);
              setActiveView("session");
              setVerifyState("waiting");
            }, 1500);
          } else {
            setVerifyState("denied");
            toast.error("Access Denied: Unrecognized RFID Security Card.");
          }
        }, 800);
      }
    },
    [activeView, rfidCards, activeSessionBank, blueCardUid, whiteCardUid]
  );

  // Connect serial & bluetooth listeners
  useEffect(() => {
    serial.startListening(handleHardwareMessage);
    bluetooth.startListening(handleHardwareMessage);
    return () => {
      serial.stopListening();
      bluetooth.stopListening();
    };
  }, [handleHardwareMessage, serial, bluetooth]);

  // Secure Session Countdown Timer
  useEffect(() => {
    if (!isSessionActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsSessionActive(false);
          toast.error("Secure Banking Session expired. Device locked.");
          setActiveView("dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Start & Stop NFC Card Tester
  const startNfcTester = async () => {
    setTesterStatus("waiting");
    setDetectedCard(null);

    // Desktop Electron build: the native bridge forwards real card taps
    // (USB PC/SC readers and Arduino Uno + RC522 over serial).
    if (isNativeAndroid() || isDesktopApp()) {
      try {
        const cleanup = await nativeNfcService.startCardTester((event: CardDetectionEvent) => {
          setDetectedCard(event);
          setTesterStatus("detected");
          if (isDesktopApp()) {
            toast.success(`Card detected: ${event.uid}`);
          } else if (event.authorized) {
            toast.success(`Authorized Card Detected: ${event.cardName} (${event.uid})`);
          } else {
            toast.error(`Unauthorized Card: ${event.uid}`);
          }
        });
        testerStopRef.current = cleanup;
      } catch (err) {
        toast.error("Failed to engage NFC hardware reader");
      }
    }
  };

  const stopNfcTester = () => {
    if (testerStopRef.current) {
      testerStopRef.current();
      testerStopRef.current = null;
    }
    setTesterStatus("idle");
  };

  const resetNfcTester = () => {
    setDetectedCard(null);
    startNfcTester();
  };

  // Toggle App Protection
  const handleToggleApp = async (appId: string) => {
    const updated = bankingApps.map((app) => (app.id === appId ? { ...app, enabled: !app.enabled } : app));
    setBankingApps(updated);

    const target = updated.find((a) => a.id === appId);
    if (target) {
      toast.success(`${target.name} is now ${target.enabled ? "PROTECTED" : "UNPROTECTED"}`);
      try {
        await insertWithSession("banking_apps", {
          package_name: target.package,
          display_name: target.name,
          enabled: target.enabled,
        });
      } catch (e) {
        console.log("Updated app locally");
      }
    }
  };

  const handleToggleNativeApp = async (packageName: string) => {
    const target = installedApps.find((a) => a.packageName === packageName);
    // Safety gate: never arm a lock the user cannot unlock (no card / no PIN).
    if (target && !target.isProtected) {
      const ok = await nativeNfcService.hasUnlockMethod();
      if (!ok) {
        toast.error(
          "Pehle NFC card register karo — bina unlock method ke app lock nahi lagega.",
          { duration: 6000 }
        );
        return;
      }
    }
    const updated = installedApps.map((app) =>
      app.packageName === packageName ? { ...app, isProtected: !app.isProtected } : app
    );
    setInstalledApps(updated);

    const protectedPackages = updated.filter((a) => a.isProtected).map((a) => a.packageName);
    await nativeNfcService.setProtectedApps(protectedPackages);
    toast.success(`Protection updated for ${packageName}`);
  };

  // Save / Update Card UID
  const handleSaveCardSlot = async () => {
    if (!editingCardSlot || !cardEditInput.trim()) return;
    const cleanUid = cardEditInput.trim().toUpperCase();

    if (editingCardSlot === "blue") {
      setBlueCardUid(cleanUid);
      if (isNativeAndroid()) {
        await nativeNfcService.registerCard("blue", cleanUid);
      }
      toast.success(`Blue Card UID updated to ${cleanUid}`);
    } else {
      setWhiteCardUid(cleanUid);
      if (isNativeAndroid()) {
        await nativeNfcService.registerCard("white", cleanUid);
      }
      toast.success(`White Card UID updated to ${cleanUid}`);
    }

    setEditingCardSlot(null);
    setCardEditInput("");
  };

  // Register New RFID Card in Supabase
  const handleSaveCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCardUid.trim() || !newCardOwner.trim()) {
      toast.error("Please enter Card UID and Owner Name");
      return;
    }

    setIsRegisteringCard(true);
    const cardObj: RFIDCard = {
      id: `card-${Date.now()}`,
      uid: newCardUid.trim().toUpperCase(),
      owner_name: newCardOwner.trim(),
      status: "active",
      created_at: new Date().toISOString(),
    };

    setRfidCards((prev) => [cardObj, ...prev.filter((c) => c.uid !== cardObj.uid)]);

    try {
      await insertWithSession("rfid_cards", {
        uid: cardObj.uid,
        owner: cardObj.owner_name,
        session_id: "session",
      } as never);
      toast.success(`RFID Security Card "${cardObj.owner_name}" registered successfully!`);
    } catch (err) {
      toast.success(`Card ${cardObj.uid} registered locally.`);
    } finally {
      setIsRegisteringCard(false);
      setNewCardUid("");
      setNewCardOwner("");
    }
  };

  const handleDeleteCard = (uid: string) => {
    setRfidCards((prev) => prev.filter((c) => c.uid !== uid));
    toast.success(`RFID Card ${uid} removed from authorized list.`);
  };

  const startVerification = (bankName: string = "PhonePe UPI") => {
    setActiveSessionBank(bankName);
    setVerifyState("waiting");
    setActiveView("verify");
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSafeDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  const protectedCount = (isAndroidPlatform || isDesktopApp())
    ? installedApps.filter((a) => a.isProtected).length
    : bankingApps.filter((a) => a.enabled).length;

  return (
    <div className="tpage animate-fade-in">
      {/* ========================================================= */}
      {/* VIEW 1: DASHBOARD                                         */}
      {/* ========================================================= */}
      {activeView === "dashboard" && (
        <>
          <ViewHead
            eyebrow="BANKSHIELD"
            title={
              <>
                Secure
                <br />
                banking.
              </>
            }
            sub="Hardware-authenticated NFC app lock. Your banking apps stay sealed until your physical card taps."
          />

          {/* Status hero */}
          <div className="glass status">
            <div className="status-top">
              <div className="label">CURRENT STATUS</div>
              <div className="pill">{isAndroidPlatform ? "NFC READY" : isDesktopApp() ? "DESKTOP · NFC" : "WEB MODE"}</div>
            </div>
            <h2 className="serif">
              Armed and
              <br />
              active.
            </h2>
            <div className="scan-area">
              <div className="rings">
                <div className="ring-icon">
                  <IconShieldCheck />
                </div>
              </div>
              <div className="scan-text">
                <b>{isSessionActive ? "Session live" : "No session running"}</b>
                <span>
                  {isSessionActive
                    ? `${activeSessionBank} unlocked — ${formatTimer(timeLeft)} remaining.`
                    : "Protected apps stay locked until your NFC card taps."}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="cta"
              style={{ width: "100%" }}
              onClick={() => (isSessionActive ? setActiveView("session") : startVerification("WhatsApp"))}
            >
              <span>{isSessionActive ? "View active session" : "Test lock overlay"}</span>
              <span className="cta-arrow">
                <IconLock style={{ width: 20, height: 20 }} />
              </span>
            </button>
          </div>

          {/* Protection signals */}
          <div className="glass signals">
            <div className="signals-head">
              <h3>Protection signals</h3>
              <div className="avail">
                <div className="dot" />
                AVAILABLE
              </div>
            </div>
            <button className="signal-row" onClick={() => setActiveView("permissions-guide")}>
              <div className="sicon">
                <IconShieldCheck />
              </div>
              <div>
                <b>App lock</b>
                <small>Blocks apps until card tap</small>
              </div>
              <div className="ready ok">ARMED</div>
            </button>
            <button className="signal-row" onClick={() => setActiveView("register-apps")}>
              <div className="sicon">
                <Smartphone style={{ width: 26, height: 26 }} />
              </div>
              <div>
                <b>Protected apps</b>
                <small>Applications guarded with NFC lock</small>
              </div>
              <div className="ready">{protectedCount} ACTIVE</div>
            </button>
            <button className="signal-row" onClick={() => setActiveView("authorized-cards")}>
              <div className="sicon">
                <CreditCard style={{ width: 26, height: 26 }} />
              </div>
              <div>
                <b>Authorized cards</b>
                <small>Blue fob and white card slots</small>
              </div>
              <div className="ready">2 SLOTS</div>
            </button>
            <button className="signal-row" onClick={() => setActiveView("history")}>
              <div className="sicon">
                <IconClock />
              </div>
              <div>
                <b>Secure session</b>
                <small>{isSessionActive ? `${activeSessionBank} unlocked` : "Locked until NFC tap"}</small>
              </div>
              <div className="ready">{isSessionActive ? formatTimer(timeLeft) : "STANDBY"}</div>
            </button>
          </div>

          {/* Hardware control tools */}
          <div className="tools-head">
            <h2 className="serif">Hardware controls</h2>
            <p>NFC &amp; IoT</p>
          </div>
          <div className="grid">
            <button
              type="button"
              className="glass tool"
              onClick={() => {
                setActiveView("nfc-tester");
                startNfcTester();
              }}
              aria-label="NFC Card Tester"
            >
              <div>
                <div className="ticon">
                  <Radio style={{ width: 32, height: 32 }} />
                </div>
                <div>
                  <b>NFC Card Tester</b>
                  <small>Tap a physical card on your phone</small>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="glass tool"
              onClick={() => setActiveView("iot-hardware-check")}
              aria-label="IoT Hardware Check"
            >
              <div>
                <div className="ticon">
                  <Cpu style={{ width: 32, height: 32 }} />
                </div>
                <div>
                  <b>IoT Hardware Check</b>
                  <small>Arduino UNO + RC522 over USB</small>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="glass tool"
              onClick={() => setActiveView("authorized-cards")}
              aria-label="Authorized NFC Cards"
            >
              <div>
                <div className="ticon">
                  <CreditCard style={{ width: 32, height: 32 }} />
                </div>
                <div>
                  <b>Authorized Cards</b>
                  <small>Manage card UIDs and registry</small>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="glass tool"
              onClick={() => setActiveView("register-apps")}
              aria-label="Protected Applications"
            >
              <div>
                <div className="ticon">
                  <Smartphone style={{ width: 32, height: 32 }} />
                </div>
                <div>
                  <b>Protected Apps</b>
                  <small>Choose apps to lock with NFC</small>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="glass tool"
              onClick={() => setActiveView("permissions-guide")}
              aria-label="App Lock Permissions"
            >
              <div>
                <div className="ticon">
                  <Layers style={{ width: 32, height: 32 }} />
                </div>
                <div>
                  <b>App Permissions</b>
                  <small>Accessibility and overlay setup</small>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="glass tool"
              onClick={() => setActiveView("history")}
              aria-label="Session History"
            >
              <div>
                <div className="ticon">
                  <IconClock />
                </div>
                <div>
                  <b>Session History</b>
                  <small>Audit log of card unlocks</small>
                </div>
              </div>
            </button>
          </div>

          {/* Active session banner */}
          {isSessionActive && (
            <div className="glass tcard" style={{ marginTop: 22, textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <span className="chip ok">HARDWARE VERIFIED · LIVE</span>
              </div>
              <h3 className="serif" style={{ fontSize: 34 }}>
                Session live.
              </h3>
              <p>
                {activeSessionBank} · Key <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--lav)" }}>{activeSessionUid}</span> ·
                {" "}{formatTimer(timeLeft)} left
              </p>
              <button type="button" className="cta" style={{ width: "100%" }} onClick={() => setActiveView("session")}>
                <span>Open secure session</span>
                <span className="cta-arrow">
                  <Timer style={{ width: 20, height: 20 }} />
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: NFC CARD TESTER                                   */}
      {/* ========================================================= */}
      {activeView === "nfc-tester" && (
        <>
          <BackButton
            onBack={() => {
              stopNfcTester();
              setActiveView("dashboard");
            }}
            label="Back to BankShield"
          />
          <ViewHead
            eyebrow="BANKSHIELD · NFC"
            title="Card tester."
            sub="Verify that your physical cards are detected by your phone's NFC hardware."
          />

          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            <button type="button" className="btn-ghost" style={{ fontSize: 14, padding: "10px 20px", minHeight: 46 }} onClick={resetNfcTester}>
              <RefreshCw style={{ width: 15, height: 15 }} />
              Reset / rescan
            </button>
          </div>

          <div className="glass tcard">
            <p className="clabel">Hardware diagnostics</p>
            <div className="kv">
              <span className="k">NFC status</span>
              <span className={isAndroidPlatform || isDesktopApp() ? "v ok" : "v warn"}>
                {isAndroidPlatform
                  ? "NFC available and active"
                  : isDesktopApp()
                    ? "NFC active via desktop reader"
                    : "Web mode (diagnostic)"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Reader mode</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                {testerStatus === "waiting" ? "Polling (ISO 14443-3A)" : testerStatus === "detected" ? "Card read complete" : "Standby"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Target device</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                iQOO 15 (vivo I2501)
              </span>
            </div>
          </div>

          <div className="glass tcard" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
            <p className="clabel">Tap station</p>

            <div style={{ position: "relative", width: 190, height: 190, margin: "6px auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {testerStatus === "waiting" && (
                <>
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2px solid rgba(205,194,247,.4)",
                      animation: "fadeIn 1.6s ease-out infinite",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 18,
                      borderRadius: "50%",
                      border: "1px solid rgba(139,61,240,.5)",
                    }}
                  />
                </>
              )}
              <div
                className={`rings ${testerStatus === "waiting" ? "animate-pulse-aurora" : ""}`}
                style={{ width: 132, height: 132, margin: 0 }}
              >
                <div className="ring-icon">
                  {testerStatus === "detected" && detectedCard ? (
                    detectedCard.authorized ? (
                      <CheckCircle2 style={{ width: 50, height: 50, stroke: "#8fd0a8", fill: "none", strokeWidth: 1.8 }} />
                    ) : (
                      <XCircle style={{ width: 50, height: 50, stroke: "#ff6b6b", fill: "none", strokeWidth: 1.8 }} />
                    )
                  ) : (
                    <Radio style={{ width: 50, height: 50, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} />
                  )}
                </div>
              </div>
            </div>

            {testerStatus === "waiting" && (
              <>
                <h3 className="serif" style={{ fontSize: 30 }}>
                  Waiting for your card.
                </h3>
                <p style={{ maxWidth: "34ch", margin: "8px auto 18px" }}>
                  Hold your Blue or White card against the upper camera area of your phone.
                </p>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span className="chip">WAITING FOR NFC CARD</span>
                </div>
              </>
            )}

            {testerStatus === "detected" && detectedCard && (
              <>
                <h3 className="serif" style={{ fontSize: 30 }}>
                  Card detected.
                </h3>
                <p>Physical NFC tag captured successfully.</p>
                <div style={{ textAlign: "left", marginTop: 18 }}>
                  <div className="kv">
                    <span className="k">UID (hardware)</span>
                    <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{detectedCard.uid}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Technology</span>
                    <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                      {detectedCard.technologies.join(", ") || "NfcA (ISO 14443-3A)"}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">Credential type</span>
                    <span className="v">{detectedCard.cardName}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Status</span>
                    <span className={detectedCard.authorized ? "v ok" : "v bad"}>
                      {detectedCard.authorized ? "AUTHORIZED" : "UNAUTHORIZED"}
                    </span>
                  </div>
                </div>
                <p className={detectedCard.authorized ? "ok" : "bad"} style={{ marginTop: 14, fontSize: 14 }}>
                  {detectedCard.authorized ? "NFC communication successful." : "This card is not registered."}
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button type="button" className="cta" style={{ flex: 1 }} onClick={resetNfcTester}>
                    <span>Scan another</span>
                    <span className="cta-arrow">
                      <RefreshCw style={{ width: 20, height: 20 }} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      stopNfcTester();
                      setActiveView("authorized-cards");
                    }}
                  >
                    Manage cards
                  </button>
                </div>
              </>
            )}

            {testerStatus === "idle" && (
              <>
                <h3 className="serif" style={{ fontSize: 30 }}>
                  Tester ready.
                </h3>
                <p style={{ marginBottom: 22 }}>
                  Start a scan, then place your Blue or White card near the phone&apos;s NFC reader.
                </p>
                <button type="button" className="cta" style={{ width: "100%" }} onClick={startNfcTester}>
                  <span>Start NFC scan</span>
                  <span className="cta-arrow">
                    <Radio style={{ width: 20, height: 20 }} />
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Browser hardware notice — not shown on Android or desktop (both have real NFC) */}
          {!isAndroidPlatform && !isDesktopApp() && (
            <div className="glass tcard">
              <p className="clabel warn">Browser hardware notice</p>
              <p>
                The W3C Web NFC standard in mobile browsers strictly withholds raw ISO 14443-3A
                tag UIDs for privacy. To run real physical NFC reader mode, open the Defenxia
                Android app.
              </p>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", marginTop: 14 }}
                onClick={() => {
                  setDetectedCard({
                    uid: "97:B4:E9:00",
                    technologies: ["NfcA", "MifareClassic"],
                    authorized: true,
                    cardName: "Blue Security KeyFob",
                  });
                  setTesterStatus("detected");
                }}
              >
                Simulate Blue Card (97:B4:E9:00)
              </button>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: AUTHORIZED NFC CARDS                             */}
      {/* ========================================================= */}
      {activeView === "authorized-cards" && (
        <>
          <BackButton onBack={() => setActiveView("dashboard")} label="Back to BankShield" />
          <ViewHead
            eyebrow="BANKSHIELD · CARDS"
            title="Authorized cards."
            sub="Only these physical cards can unlock your protected applications."
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
            {/* Blue card slot */}
            <div className="glass tcard">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                    <Radio style={{ width: 26, height: 26 }} />
                  </div>
                  <div>
                    <p className="clabel" style={{ margin: 0 }}>Blue card</p>
                    <p style={{ fontSize: 13, marginTop: 6 }}>Primary security KeyFob</p>
                  </div>
                </div>
                <span className="chip ok">REGISTERED</span>
              </div>
              <div className="kv">
                <span className="k">Card UID</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {showBlueUid ? blueCardUid : maskUid(blueCardUid)}
                  </span>
                  <button
                    type="button"
                    aria-label={showBlueUid ? "Hide UID" : "Show UID"}
                    onClick={() => setShowBlueUid((v) => !v)}
                    style={{ color: "var(--faint)", display: "flex" }}
                  >
                    {showBlueUid ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </span>
              </div>
              <div className="kv">
                <span className="k">Tag technology</span>
                <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>MIFARE 1K (NfcA)</span>
              </div>
              <div className="kv">
                <span className="k">Access privilege</span>
                <span className="v ok">Full unlock</span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", marginTop: 16, fontSize: 14 }}
                onClick={() => {
                  setEditingCardSlot("blue");
                  setCardEditInput(blueCardUid);
                }}
              >
                Edit / re-register Blue Card UID
              </button>
            </div>

            {/* White card slot */}
            <div className="glass tcard">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                    <CreditCard style={{ width: 26, height: 26 }} />
                  </div>
                  <div>
                    <p className="clabel" style={{ margin: 0 }}>White card</p>
                    <p style={{ fontSize: 13, marginTop: 6 }}>Secondary backup card</p>
                  </div>
                </div>
                <span className={whiteCardUid ? "chip ok" : "chip warn"}>
                  {whiteCardUid ? "REGISTERED" : "AWAITING UID"}
                </span>
              </div>
              <div className="kv">
                <span className="k">Card UID</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {whiteCardUid ? (showWhiteUid ? whiteCardUid : maskUid(whiteCardUid)) : "Not configured"}
                  </span>
                  {whiteCardUid && (
                    <button
                      type="button"
                      aria-label={showWhiteUid ? "Hide UID" : "Show UID"}
                      onClick={() => setShowWhiteUid((v) => !v)}
                      style={{ color: "var(--faint)", display: "flex" }}
                    >
                      {showWhiteUid ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  )}
                </span>
              </div>
              <div className="kv">
                <span className="k">Tag technology</span>
                <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>ISO 14443-3A</span>
              </div>
              <div className="kv">
                <span className="k">Access privilege</span>
                <span className="v ok">Full unlock</span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", marginTop: 16, fontSize: 14 }}
                onClick={() => {
                  setEditingCardSlot("white");
                  setCardEditInput(whiteCardUid || "");
                }}
              >
                {whiteCardUid ? "Edit / update White Card UID" : "Register White Card"}
              </button>
            </div>
          </div>

          {/* Registered cards registry */}
          <div className="tools-head">
            <h2 className="serif">Card registry</h2>
            <p>{rfidCards.length} registered</p>
          </div>
          <div className="glass tcard">
            {rfidCards.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px 0", color: "var(--faint)", fontSize: 14 }}>
                No cards registered yet. Add your first security card below.
              </p>
            ) : (
              rfidCards.map((card) => (
                <div className="trow" key={card.id}>
                  <div className="ticon" style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0 }}>
                    <IconKeyRound style={{ width: 22, height: 22 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{card.owner_name}</div>
                    <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: "var(--lav)", marginTop: 4 }}>
                      {card.uid}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>{formatSafeDate(card.created_at)}</div>
                  </div>
                  <span className={card.status === "active" ? "chip ok" : "chip bad"}>{card.status}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${card.owner_name}`}
                    onClick={() => handleDeleteCard(card.uid)}
                    style={{ color: "var(--faint)", display: "flex", padding: 8 }}
                  >
                    <Trash2 style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Register a new card */}
          <div className="glass tcard">
            <p className="clabel">Register a new card</p>
            <form onSubmit={handleSaveCard}>
              <label className="flabel" htmlFor="new-card-uid">Card UID</label>
              <input
                id="new-card-uid"
                className="field"
                style={{ fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", marginBottom: 14 }}
                value={newCardUid}
                onChange={(e) => setNewCardUid(e.target.value.toUpperCase())}
                placeholder="e.g. 97:B4:E9:00"
              />
              <label className="flabel" htmlFor="new-card-owner">Owner name</label>
              <input
                id="new-card-owner"
                className="field"
                style={{ marginBottom: 18 }}
                value={newCardOwner}
                onChange={(e) => setNewCardOwner(e.target.value)}
                placeholder="e.g. Office backup card"
              />
              <button type="submit" className="cta" style={{ width: "100%" }} disabled={isRegisteringCard}>
                <span>{isRegisteringCard ? "Registering…" : "Register card"}</span>
                <span className="cta-arrow">
                  {isRegisteringCard ? (
                    <Loader2 style={{ width: 20, height: 20 }} className="animate-spin-slow" />
                  ) : (
                    <Plus style={{ width: 20, height: 20 }} />
                  )}
                </span>
              </button>
            </form>
          </div>

          {/* UID edit modal */}
          {editingCardSlot && (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                background: "rgba(0,0,0,.6)",
                backdropFilter: "blur(16.9px)",
                WebkitBackdropFilter: "blur(16.9px)",
              }}
              onClick={() => setEditingCardSlot(null)}
            >
              <div
                className="glass"
                style={{ borderRadius: 32, padding: 28, width: "100%", maxWidth: 400 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>
                  Update {editingCardSlot === "blue" ? "Blue" : "White"} Card.
                </h3>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 18 }}>
                  Enter the hexadecimal UID (e.g. 97:B4:E9:00) — or scan it with the card tester.
                </p>
                <label className="flabel" htmlFor="card-uid-edit">Card UID</label>
                <input
                  id="card-uid-edit"
                  className="field"
                  style={{ fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", marginBottom: 18 }}
                  value={cardEditInput}
                  onChange={(e) => setCardEditInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 97:B4:E9:00"
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setEditingCardSlot(null)}>
                    Cancel
                  </button>
                  <button type="button" className="cta" style={{ flex: 1, marginTop: 0 }} onClick={handleSaveCardSlot}>
                    <span>Save UID</span>
                    <span className="cta-arrow">
                      <Check style={{ width: 20, height: 20 }} />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: PROTECTED APPLICATIONS                          */}
      {/* ========================================================= */}
      {activeView === "register-apps" && (
        <>
          <BackButton onBack={() => setActiveView("dashboard")} label="Back to BankShield" />
          <ViewHead
            eyebrow="BANKSHIELD · APPS"
            title="Protected apps."
            sub={
              isAndroidPlatform
                ? "Select installed applications to lock with your authorized NFC card."
                : "Configure banking and sensitive applications to lock with NFC card authentication."
            }
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <span className="chip">{protectedCount} PROTECTED</span>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 14, padding: "10px 20px", minHeight: 46, marginLeft: "auto" }}
              onClick={() => loadNativeInstalledApps(true)}
              disabled={loadingInstalledApps}
            >
              <RefreshCw style={{ width: 15, height: 15 }} className={loadingInstalledApps ? "animate-spin-slow" : ""} />
              Refresh
            </button>
          </div>

          {/* Real installed apps on Android AND desktop (bridge Start-Menu scan);
              demo list only in the plain web preview. */}
          {(isAndroidPlatform || isDesktopApp()) ? (
            loadingInstalledApps && installedApps.length === 0 ? (
              <div className="glass tcard" style={{ textAlign: "center", padding: "48px 24px" }}>
                <Loader2 style={{ width: 44, height: 44, color: "var(--lav)", margin: "0 auto 16px" }} className="animate-spin-slow" />
                <h3 className="serif" style={{ fontSize: 30 }}>Loading apps…</h3>
                <p>Reading registered packages from your phone&apos;s system.</p>
              </div>
            ) : installedApps.length > 0 ? (
              <div className="glass tcard">
                {installedApps.map((app) => (
                  <div className="trow" key={app.packageName}>
                    {app.icon ? (
                      <img
                        src={app.icon}
                        alt={app.appName}
                        style={{ width: 48, height: 48, borderRadius: 16, objectFit: "contain", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        className="ticon"
                        style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0, fontWeight: 700, fontSize: 15 }}
                      >
                        {app.appName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {app.appName}
                        </span>
                        {app.isProtected && <span className="chip ok">LOCKED</span>}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "var(--faint)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {app.packageName}
                      </div>
                    </div>
                    <AuroraSwitch
                      checked={!!app.isProtected}
                      onChange={() => handleToggleNativeApp(app.packageName)}
                      label={`Toggle protection for ${app.appName}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass tcard" style={{ textAlign: "center", padding: "40px 24px" }}>
                <div className="ticon" style={{ width: 72, height: 72, borderRadius: 24, margin: "0 auto 16px" }}>
                  <Smartphone style={{ width: 32, height: 32 }} />
                </div>
                <h3 className="serif" style={{ fontSize: 30 }}>No apps detected.</h3>
                <p style={{ marginBottom: 20 }}>Tap refresh to query your device packages.</p>
                <button type="button" className="cta" style={{ margin: "0 auto" }} onClick={() => loadNativeInstalledApps(true)}>
                  <span>Scan applications</span>
                  <span className="cta-arrow">
                    <RefreshCw style={{ width: 20, height: 20 }} />
                  </span>
                </button>
              </div>
            )
          ) : (
            <>
              <div className="glass tcard" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Info style={{ width: 18, height: 18, color: "var(--lav)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13.5, margin: 0 }}>
                  Desktop preview mode: showing demo applications. On your Android phone, Defenxia
                  automatically loads your actual installed applications.
                </p>
              </div>
              <div className="glass tcard">
                {bankingApps.map((app) => (
                  <div className="trow" key={app.id}>
                    <div className="ticon" style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0, fontWeight: 700, fontSize: 15 }}>
                      {app.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{app.name}</span>
                        {app.enabled && <span className="chip ok">GUARDED</span>}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "var(--faint)", marginTop: 4 }}>
                        {app.package}
                      </div>
                    </div>
                    <AuroraSwitch
                      checked={app.enabled}
                      onChange={() => handleToggleApp(app.id)}
                      label={`Toggle protection for ${app.name}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: APP LOCK PERMISSIONS SETUP (GUIDE)                */}
      {/* ========================================================= */}
      {activeView === "permissions-guide" && (
        <>
          <BackButton onBack={() => setActiveView("dashboard")} label="Back to BankShield" />
          <ViewHead
            eyebrow="BANKSHIELD · PERMISSIONS"
            title="App permissions."
            sub="Status updates automatically when you return from Android Settings."
          />

          <div style={{ display: "flex", marginBottom: 22 }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 14, padding: "10px 20px", minHeight: 46 }}
              onClick={async () => {
                const p = await nativeNfcService.checkPermissions();
                setPermissionStatus({ batteryOptimizationIgnored: false, ...p });
                const n = await nativeNfcService.getNfcStatus();
                setNfcState(n);
                toast.success("Permission states refreshed");
              }}
            >
              <RefreshCw style={{ width: 15, height: 15 }} />
              Check status
            </button>
          </div>

          {/* Accessibility service (primary app-lock interception) */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                  <IconShieldCheck style={{ width: 26, height: 26 }} />
                </div>
                <div>
                  <p className="clabel" style={{ margin: 0 }}>Accessibility service</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Instant lock on protected apps</p>
                </div>
              </div>
              <span className={permissionStatus.accessibilityGranted ? "chip ok" : "chip warn"}>
                {permissionStatus.accessibilityGranted ? "GRANTED" : "REQUIRED"}
              </span>
            </div>
            <p>
              Allows Defenxia to instantly detect when a protected app is opened and show the NFC
              lock overlay before the app can be used. Without this, locked apps cannot be blocked.
            </p>
            {permissionStatus.accessibilityGranted ? (
              <p className="ok" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 14 }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                Accessibility service active — protected apps will be locked instantly.
              </p>
            ) : (
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 14 }}
                onClick={() => nativeNfcService.openAccessibilitySettings()}
              >
                <span>Enable accessibility service</span>
                <span className="cta-arrow">
                  <IconShieldCheck style={{ width: 20, height: 20 }} />
                </span>
              </button>
            )}
          </div>

          {/* Usage access (UsageStatsManager foreground detection) */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                  <IconShieldCheck style={{ width: 26, height: 26 }} />
                </div>
                <div>
                  <p className="clabel" style={{ margin: 0 }}>Usage access</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Detects protected app launches</p>
                </div>
              </div>
              <span className={permissionStatus.usageStatsGranted ? "chip ok" : "chip warn"}>
                {permissionStatus.usageStatsGranted ? "GRANTED" : "REQUIRED"}
              </span>
            </div>
            <p>
              Allows Defenxia to detect when a protected app is opened, so the physical NFC lock
              screen can block unauthorized access immediately. Works together with the
              accessibility service above.
            </p>
            {permissionStatus.usageStatsGranted ? (
              <p className="ok" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 14 }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                {permissionStatus.monitorServiceRunning
                  ? "Monitor active — watching protected apps."
                  : "Permission granted — starting monitor…"}
              </p>
            ) : (
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 14 }}
                onClick={() => nativeNfcService.openUsageStatsSettings()}
              >
                <span>Enable usage access</span>
                <span className="cta-arrow">
                  <IconShieldCheck style={{ width: 20, height: 20 }} />
                </span>
              </button>
            )}
          </div>

          {/* Overlay permission */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                  <Layers style={{ width: 26, height: 26 }} />
                </div>
                <div>
                  <p className="clabel" style={{ margin: 0 }}>Display over other apps</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Renders the NFC lock screen</p>
                </div>
              </div>
              <span className={permissionStatus.overlayGranted ? "chip ok" : "chip warn"}>
                {permissionStatus.overlayGranted ? "GRANTED" : "REQUIRED"}
              </span>
            </div>
            <p>
              Required on Android 14/15, OnePlus, and iQOO to display the Defenxia NFC lock screen
              directly over protected apps before they open.
            </p>
            {permissionStatus.overlayGranted ? (
              <p className="ok" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 14 }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                Overlay capability active.
              </p>
            ) : (
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 14 }}
                onClick={() => nativeNfcService.openOverlaySettings()}
              >
                <span>Enable overlay permission</span>
                <span className="cta-arrow">
                  <Layers style={{ width: 20, height: 20 }} />
                </span>
              </button>
            )}
          </div>

          {/* Battery optimization */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                  <Zap style={{ width: 26, height: 26 }} />
                </div>
                <div>
                  <p className="clabel" style={{ margin: 0 }}>Background execution</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Prevents OEM battery killers</p>
                </div>
              </div>
              <span className={permissionStatus.batteryOptimizationIgnored ? "chip ok" : "chip"}>
                {permissionStatus.batteryOptimizationIgnored ? "UNRESTRICTED" : "RECOMMENDED"}
              </span>
            </div>
            <p>
              On OnePlus (OxygenOS) and iQOO (Funtouch OS), aggressive battery savers can stop
              the app-lock monitor. Set Defenxia to &ldquo;Don&apos;t optimize / Unrestricted&rdquo;.
            </p>
            <button
              type="button"
              className="btn-ghost"
              style={{ width: "100%", marginTop: 14, fontSize: 14 }}
              onClick={() => nativeNfcService.openBatteryOptimizationSettings()}
            >
              Configure battery unrestricted
            </button>
          </div>

          {/* NFC hardware */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                  <Radio style={{ width: 26, height: 26 }} />
                </div>
                <div>
                  <p className="clabel" style={{ margin: 0 }}>NFC hardware</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Physical tag authentication</p>
                </div>
              </div>
              <span className={nfcState.enabled ? "chip ok" : nfcState.available ? "chip warn" : "chip bad"}>
                {nfcState.enabled ? "ENABLED" : nfcState.available ? "DISABLED" : "NOT AVAILABLE"}
              </span>
            </div>
            <p>
              {nfcState.enabled
                ? "NFC hardware is powered on and ready to detect Blue and White cards."
                : "NFC is currently turned off in your phone settings. Turn NFC on to scan cards."}
            </p>
            {!nfcState.enabled && (
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 14 }}
                onClick={() => nativeNfcService.openNfcSettings()}
              >
                <span>Open NFC settings</span>
                <span className="cta-arrow">
                  <Radio style={{ width: 20, height: 20 }} />
                </span>
              </button>
            )}
          </div>

          {/* Lock diagnostics (native) */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p className="clabel" style={{ margin: 0 }}>Lock diagnostics</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>Is the interceptor actually catching app launches?</p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 13, padding: "8px 16px", minHeight: 40 }}
                onClick={async () => {
                  const d = await nativeNfcService.getLockDiagnostics();
                  setLockDiagnostics(d);
                  if (!d) toast.error("Diagnostics unavailable — native Android only");
                }}
              >
                <RefreshCw style={{ width: 14, height: 14 }} />
                Refresh
              </button>
            </div>
            {lockDiagnostics ? (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.9 }}>
                <p style={{ margin: 0 }}>Monitor running: <b>{lockDiagnostics.serviceRunning ? "YES" : "NO"}</b></p>
                <p style={{ margin: 0 }}>Usage access: <b>{lockDiagnostics.usageStatsGranted ? "YES" : "NO"}</b></p>
                <p style={{ margin: 0 }}>Overlay permission: <b>{lockDiagnostics.overlayGranted ? "YES" : "NO"}</b></p>
                <p style={{ margin: 0 }}>Protected apps: <b>{lockDiagnostics.protectedPackages.length}</b></p>
                <p style={{ margin: 0 }}>Last intercepted: <b>{lockDiagnostics.lastDetectedPackage || "— none yet —"}</b></p>
                <p style={{ margin: 0 }}>Last launch result: <b>{lockDiagnostics.lastLaunchResult}</b></p>
                <p style={{ margin: 0 }}>Android SDK: <b>{lockDiagnostics.sdkInt}</b></p>
                {!lockDiagnostics.serviceRunning && (
                  <p className="warn" style={{ marginTop: 10, fontFamily: "inherit" }}>
                    Monitor not running — grant usage access and overlay permission above, then open a protected app to test interception.
                  </p>
                )}
                {/* Crash log — helps diagnose app crashes */}
                <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12 }}>
                  <p style={{ margin: "0 0 8px" }}>
                    Crash log: <b>{lockDiagnostics.lastCrashLog ? "RECORDED" : "— none —"}</b>
                  </p>
                  {lockDiagnostics.lastCrashLog ? (
                    <>
                      <pre style={{
                        margin: "0 0 10px", padding: 10, borderRadius: 8,
                        background: "rgba(0,0,0,.45)", fontSize: 10.5, lineHeight: 1.6,
                        maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {lockDiagnostics.lastCrashLog}
                      </pre>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: 12.5, padding: "8px 14px", minHeight: 40 }}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(lockDiagnostics.lastCrashLog);
                              toast.success("Crash log copied — send it to support");
                            } catch {
                              toast.error("Copy failed");
                            }
                          }}
                        >
                          Copy crash log
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: 12.5, padding: "8px 14px", minHeight: 40 }}
                          onClick={async () => {
                            await nativeNfcService.clearCrashLog();
                            const d = await nativeNfcService.getLockDiagnostics();
                            if (d) setLockDiagnostics(d);
                            toast.success("Crash log cleared");
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13.5, margin: 0 }}>
                Tap Refresh to check whether the native lock interceptor is alive and catching launches. (Android app only.)
              </p>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW: IOT HARDWARE CHECK (ARDUINO UNO + RC522)            */}
      {/* ========================================================= */}
      {activeView === "iot-hardware-check" && (
        <>
          <BackButton onBack={() => setActiveView("dashboard")} label="Back to BankShield" />
          <ViewHead
            eyebrow="BANKSHIELD · IOT"
            title="Hardware check."
            sub="Arduino UNO + RC522 RFID reader over USB Web Serial — for laptop and desktop browsers."
          />

          {isAndroidPlatform ? (
            <div className="glass tcard" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Info style={{ width: 18, height: 18, color: "var(--lav)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13.5, margin: 0 }}>
                <b style={{ color: "var(--ink)" }}>Platform notice.</b> This check connects to an
                external Arduino UNO + RC522 module via USB Web Serial, and works on laptop/PC
                browsers. To tap cards directly on this phone, use the NFC card tester from the
                dashboard.
              </p>
            </div>
          ) : isDesktopApp() ? (
            <div className="glass tcard" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Info style={{ width: 18, height: 18, color: "var(--lav)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13.5, margin: 0 }}>
                <b style={{ color: "var(--ink)" }}>Desktop mode.</b> The Windows app reads your
                Arduino UNO + RC522 automatically — no Web Serial setup needed here. Use{" "}
                <b style={{ color: "var(--ink)" }}>NFC Keys → Test your card</b> to verify taps.
              </p>
            </div>
          ) : (
            <div className="glass tcard" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span className="chip ok">WEB SERIAL READY</span>
              <p style={{ fontSize: 13.5, margin: 0 }}>
                Plug your Arduino UNO into any USB port and connect below.
              </p>
            </div>
          )}

          {/* Web Serial flow is browser-only; the desktop app handles Arduino via its native bridge */}
          {!isDesktopApp() && (
          <>
          {/* Connection card */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="clabel" style={{ margin: 0 }}>RC522 RFID sensor reader</p>
              {serial.isConnected ? (
                <span className="chip ok">ARDUINO CONNECTED</span>
              ) : (
                <span className="chip">SERIAL DISCONNECTED</span>
              )}
            </div>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginBottom: 16 }}>
              Baud rate {serial.baudRate} · SPI 4MHz · ISO 14443-3A
            </p>
            {!serial.isConnected ? (
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  aria-label="Baud rate"
                  value={serial.baudRate}
                  onChange={(e) => serial.setBaudRate(Number(e.target.value))}
                  className="field"
                  style={{ width: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}
                >
                  <option value={9600}>9600 Baud</option>
                  <option value={115200}>115200 Baud</option>
                  <option value={57600}>57600 Baud</option>
                  <option value={38400}>38400 Baud</option>
                </select>
                <button
                  type="button"
                  className="cta"
                  style={{ flex: 1, marginTop: 0 }}
                  onClick={async () => {
                    const ok = await serial.connect(serial.baudRate);
                    if (ok) {
                      toast.success(`Connected to Arduino UNO (${serial.baudRate} Baud)!`);
                    }
                  }}
                >
                  <span>Connect Arduino UNO</span>
                  <span className="cta-arrow">
                    <Usb style={{ width: 20, height: 20 }} />
                  </span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="chip" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  {serial.baudRate} BAUD
                </span>
                <button type="button" className="btn-ghost" style={{ fontSize: 14 }} onClick={serial.disconnect}>
                  Disconnect
                </button>
              </div>
            )}
            {/* Demo-only tap simulation — hidden on desktop where real taps work */}
            {!isDesktopApp() && (
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", marginTop: 12, fontSize: 13 }}
                onClick={() => handleSimulateIotTap()}
                title="Test the tap animation without plugging in Arduino"
              >
                Simulate tap
              </button>
            )}
          </div>

          {/* RC522 tap station */}
          <div className="glass tcard" style={{ textAlign: "center" }}>
            <p className="clabel">RC522 antenna</p>
            <button
              type="button"
              aria-label="Trigger card verification"
              title="Tap physical card or click to verify"
              onClick={() => handleSimulateIotTap("97:B4:E9:00")}
              className={`rings ${iotTapState === "reading" ? "animate-pulse-aurora" : ""}`}
              style={{ width: 150, height: 150, margin: "6px auto 18px", cursor: "pointer" }}
            >
              <div className="ring-icon">
                {iotTapState === "success" ? (
                  <CheckCircle2 style={{ width: 54, height: 54, stroke: "#8fd0a8", fill: "none", strokeWidth: 1.7 }} />
                ) : iotTapState === "reading" ? (
                  <Radio style={{ width: 54, height: 54, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7 }} className="animate-spin-slow" />
                ) : (
                  <Radio style={{ width: 54, height: 54, stroke: "#cdc2f7", fill: "none", strokeWidth: 1.7, opacity: 0.6 }} />
                )}
              </div>
            </button>

            {iotTapState === "success" && scannedIotCard ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <span className="chip ok">RFID TAP SUCCESSFUL</span>
                </div>
                <h3 className="serif" style={{ fontSize: 30 }}>
                  Card verified.
                </h3>
                <p>{scannedIotCard.cardName}</p>
                <div style={{ textAlign: "left", marginTop: 18 }}>
                  <div className="kv">
                    <span className="k">Card UID</span>
                    <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{scannedIotCard.uid}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Identity</span>
                    <span className="v">{scannedIotCard.cardName}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Protocol</span>
                    <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{scannedIotCard.protocol}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Timestamp</span>
                    <span className="v ok">{scannedIotCard.timestamp}</span>
                  </div>
                </div>
              </>
            ) : iotTapState === "reading" ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <span className="chip">READING CARD…</span>
                </div>
                <h3 className="serif" style={{ fontSize: 30 }}>
                  Reading card.
                </h3>
                <p>Transmitting card UID from the RC522…</p>
              </>
            ) : (
              <>
                <h3 className="serif" style={{ fontSize: 30 }}>
                  {serial.isConnected ? "Ready to read." : "Connect to begin."}
                </h3>
                <p style={{ marginBottom: 18 }}>
                  Hold your Blue KeyFob (97:B4:E9:00) or White card 1–2 cm from the RC522 sensor.
                </p>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}
                  onClick={() => handleSimulateIotTap("97:B4:E9:00")}
                >
                  Instant trigger · 97:B4:E9:00
                </button>
              </>
            )}
          </div>
          </>)}

          <p className="warn" style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "flex-start", margin: "0 4px 4px" }}>
            <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span>
              If Arduino IDE is open, close its Serial Monitor window so the COM port is free
              for DEFENXIA to read.
            </span>
          </p>

          {/* Serial terminal */}
          <div className="glass tcard" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid rgba(205,194,247,.08)",
              }}
            >
              <span className="clabel" style={{ margin: 0 }}>USB serial terminal</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="chip" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{serial.baudRate} BAUD</span>
                <span className="chip" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{serial.bytesReceived} BYTES RX</span>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ minHeight: 0, padding: "6px 14px", fontSize: 12 }}
                  onClick={() =>
                    setSerialLogs([
                      { id: `c-${Date.now()}`, time: new Date().toLocaleTimeString(), text: "Log buffer cleared." },
                    ])
                  }
                >
                  Clear
                </button>
              </div>
            </div>
            <div
              style={{
                padding: 16,
                minHeight: 160,
                maxHeight: 220,
                overflowY: "auto",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11.5,
                lineHeight: 1.7,
              }}
            >
              {serialLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--faint)", flexShrink: 0 }}>[{log.time}]</span>
                  <span
                    style={{
                      color: log.isUid ? "#8fd0a8" : log.text.includes("READY") ? "#cdc2f7" : log.text.includes("CARD_DETECTED") ? "#d7cdfa" : "var(--muted)",
                      fontWeight: log.isUid ? 700 : 400,
                      wordBreak: "break-all",
                    }}
                  >
                    {log.text}
                  </span>
                </div>
              ))}
              {!serial.isConnected && (
                <div style={{ color: "var(--faint)", fontStyle: "italic", paddingTop: 6 }}>
                  &gt; Serial port disconnected. Plug in your Arduino UNO and connect above.
                </div>
              )}
            </div>
          </div>

          {/* Arduino setup */}
          <div className="glass tcard">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
                <Code2 style={{ width: 26, height: 26 }} />
              </div>
              <div>
                <p className="clabel" style={{ margin: 0 }}>Arduino UNO + RC522 setup</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>Flash this sketch in Arduino IDE</p>
              </div>
            </div>

            <p className="clabel">Pin wiring</p>
            <div className="kv">
              <span className="k">SDA (SS)</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>Pin 10</span>
            </div>
            <div className="kv">
              <span className="k">SCK</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>Pin 13</span>
            </div>
            <div className="kv">
              <span className="k">MOSI</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>Pin 11</span>
            </div>
            <div className="kv">
              <span className="k">MISO</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>Pin 12</span>
            </div>
            <div className="kv">
              <span className="k">RST</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>Pin 9</span>
            </div>
            <div className="kv">
              <span className="k">3.3V</span>
              <span className="v ok" style={{ fontFamily: "'JetBrains Mono',monospace" }}>3.3V — not 5V</span>
            </div>
            <div className="kv">
              <span className="k">GND</span>
              <span className="v" style={{ fontFamily: "'JetBrains Mono',monospace" }}>GND</span>
            </div>
            <div className="kv">
              <span className="k">IRQ</span>
              <span className="v" style={{ color: "var(--faint)" }}>Unused</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 }}>
              <p className="clabel" style={{ margin: 0 }}>Arduino sketch (.ino)</p>
              <button
                type="button"
                className="btn-ghost"
                style={{ minHeight: 0, padding: "8px 16px", fontSize: 12 }}
                onClick={() => {
                  navigator.clipboard.writeText(ARDUINO_RC522_SKETCH);
                  setCopiedArduinoCode(true);
                  toast.success("Arduino code copied to clipboard!");
                  setTimeout(() => setCopiedArduinoCode(false), 2000);
                }}
              >
                {copiedArduinoCode ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copiedArduinoCode ? "Copied" : "Copy code"}
              </button>
            </div>
            <pre
              style={{
                background: "rgba(0,0,0,.45)",
                border: "1px solid var(--edge-soft)",
                borderRadius: 18,
                padding: 16,
                fontSize: 10.5,
                fontFamily: "'JetBrains Mono',monospace",
                color: "var(--lav)",
                maxHeight: 200,
                overflowY: "auto",
                whiteSpace: "pre",
              }}
            >
              {ARDUINO_RC522_SKETCH}
            </pre>
          </div>

          {/* Bluetooth companion note */}
          <div className="glass tcard" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="ticon" style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0 }}>
              <Bluetooth style={{ width: 22, height: 22 }} />
            </div>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              Bluetooth hardware channel is also listening for card events alongside USB serial.
            </p>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 6: VERIFICATION OVERLAY                             */}
      {/* ========================================================= */}
      {activeView === "verify" && (
        <div
          role="dialog"
          aria-modal="true"
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,.72)",
            backdropFilter: "blur(30.42px)",
            WebkitBackdropFilter: "blur(30.42px)",
          }}
        >
          <div className="glass" style={{ borderRadius: 36, padding: 32, width: "100%", maxWidth: 430, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 22 }}>
              <div className="ticon" style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0 }}>
                <IconLock style={{ width: 20, height: 20 }} />
              </div>
              <span className="clabel" style={{ margin: 0 }}>
                DEFENXIA SHIELD · {activeSessionBank.toUpperCase()}
              </span>
            </div>

            <div className={`rings ${verifyState === "waiting" ? "animate-pulse-aurora" : ""}`} style={{ width: 140, height: 140, margin: "0 auto 20px" }}>
              <div className="ring-icon">
                {verifyState === "waiting" && <IconShieldCheck style={{ width: 52, height: 52 }} />}
                {verifyState === "reading" && (
                  <Loader2 style={{ width: 52, height: 52, stroke: "#cdc2f7", fill: "none" }} className="animate-spin-slow" />
                )}
                {verifyState === "authorized" && (
                  <CheckCircle2 style={{ width: 52, height: 52, stroke: "#8fd0a8", fill: "none", strokeWidth: 1.8 }} />
                )}
                {verifyState === "denied" && (
                  <XCircle style={{ width: 52, height: 52, stroke: "#ff6b6b", fill: "none", strokeWidth: 1.8 }} />
                )}
              </div>
            </div>

            <h3 className="serif" style={{ fontSize: 34, lineHeight: 1.1 }}>
              {verifyState === "waiting" && "Tap your authorized card."}
              {verifyState === "reading" && "Reading credentials…"}
              {verifyState === "authorized" && "Access granted."}
              {verifyState === "denied" && "Access denied."}
            </h3>
            <p style={{ marginTop: 10, marginBottom: 20 }}>
              {verifyState === "waiting" && "Place your registered Blue Card (97:B4:E9:00) against the back of your phone."}
              {verifyState === "reading" && "Verifying cryptographic UID against the authorized banking whitelist…"}
              {verifyState === "authorized" && (
                <>
                  Authenticated UID{" "}
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--lav)" }}>
                    {verifiedCardUid || "97:B4:E9:00"}
                  </span>
                  . Starting encrypted session.
                </>
              )}
              {verifyState === "denied" && "This card is not registered in your authorized whitelist."}
            </p>

            <div style={{ textAlign: "left", marginBottom: 20 }}>
              <p className="clabel">Simulation · quick test</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn-ghost ok"
                  style={{ flex: 1, fontSize: 13, borderColor: "rgba(143,208,168,.3)" }}
                  onClick={() => handleHardwareMessage("AUTHORIZED:97:B4:E9:00")}
                >
                  Tap Blue Card
                </button>
                <button
                  type="button"
                  className="btn-ghost bad"
                  style={{ flex: 1, fontSize: 13, borderColor: "rgba(255,107,107,.3)" }}
                  onClick={() => handleHardwareMessage("DENIED:UNKNOWN_TAG")}
                >
                  Tap unknown tag
                </button>
              </div>
            </div>

            <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={() => setActiveView("dashboard")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 7: ACTIVE SECURE SESSION                             */}
      {/* ========================================================= */}
      {activeView === "session" && (
        <>
          <BackButton onBack={() => setActiveView("dashboard")} label="Back to BankShield" />
          <div className="glass tcard" style={{ textAlign: "center", padding: "36px 28px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <span className="chip ok">HARDWARE VERIFIED · ACTIVE</span>
            </div>
            <div className="ticon" style={{ width: 72, height: 72, borderRadius: 24, margin: "0 auto 18px" }}>
              <IconShieldCheck style={{ width: 34, height: 34 }} />
            </div>
            <h1 className="serif" style={{ fontSize: 46, margin: "0 0 8px" }}>
              Session live.
            </h1>
            <p>
              {activeSessionBank} · Card{" "}
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--lav)" }}>{activeSessionUid}</span>
            </p>

            <div
              style={{
                background: "rgba(0,0,0,.4)",
                border: "1px solid var(--edge-soft)",
                borderRadius: 24,
                padding: "24px 16px",
                maxWidth: 300,
                margin: "24px auto",
              }}
            >
              <p className="clabel" style={{ marginBottom: 10 }}>Session timeout</p>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 58,
                  lineHeight: 1,
                  color: "var(--ink)",
                }}
              >
                {formatTimer(timeLeft)}
              </div>
              <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 10, marginBottom: 0 }}>
                Auto-relocks when the timer expires.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-ghost bad"
                style={{ borderColor: "rgba(255,107,107,.3)", fontSize: 14 }}
                onClick={() => {
                  setIsSessionActive(false);
                  toast.info("Secure banking session closed.");
                  setActiveView("dashboard");
                }}
              >
                End session now
              </button>
              <button type="button" className="cta" style={{ marginTop: 0 }} onClick={() => setActiveView("dashboard")}>
                <span>Back to dashboard</span>
                <span className="cta-arrow">
                  <IconBank style={{ width: 20, height: 20 }} />
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 8: SESSION HISTORY                                   */}
      {/* ========================================================= */}
      {activeView === "history" && (
        <>
          <BackButton onBack={() => setActiveView("dashboard")} label="Back to BankShield" />
          <ViewHead
            eyebrow="BANKSHIELD · HISTORY"
            title="Session history."
            sub="Immutable timeline of NFC-authenticated unlock events."
          />

          <div className="glass tcard">
            <p className="clabel">NFC authorization audit log</p>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0" }}>
                <div className="ticon" style={{ width: 72, height: 72, borderRadius: 24, margin: "0 auto 16px" }}>
                  <IconClock style={{ width: 32, height: 32 }} />
                </div>
                <p style={{ color: "var(--faint)", fontSize: 14 }}>
                  No sessions logged yet. Tap an authorized card to start one.
                </p>
              </div>
            ) : (
              sessions.map((sess, idx) => (
                <div className="trow" key={sess.id || idx}>
                  <div className="ticon" style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0 }}>
                    <IconLock style={{ width: 22, height: 22 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{sess.app_name}</div>
                    <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: "var(--lav)", marginTop: 4 }}>
                      Card: {sess.rfid_uid}
                    </div>
                    {sess.started_at && (
                      <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>{formatSafeDate(sess.started_at)}</div>
                    )}
                  </div>
                  <span className="chip ok">{sess.verification_status}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
