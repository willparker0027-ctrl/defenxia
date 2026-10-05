import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Vault, Download, RefreshCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { safeRoomService } from "@/services/safeRoomService";

const steps = [
  {
    icon: Download,
    title: "Drop any APK in",
    text: "Downloaded a file from outside the Play Store? Send it to the Safe Room instead of installing it directly.",
  },
  {
    icon: Vault,
    title: "It runs in isolation",
    text: "The Safe Room is a separate, OS-enforced work profile. Anything inside — malware included — cannot touch your photos, messages, bank apps or main profile.",
  },
  {
    icon: RefreshCcw,
    title: "Wipe it with one tap",
    text: "Done testing? One tap destroys the entire sandbox and all its data, then rebuilds it fresh and clean.",
  },
];

const BLOCKED_TEXT: Record<string, { title: string; text: string }> = {
  profile_exists: {
    title: "Ek work profile pehle se hai",
    text: "Tumhare phone me pehle se ek work profile bana hua hai, isliye naya nahi ban sakta. Settings me “Work profile” search karke purana hatao, phir dobara try karo.",
  },
  check_error: {
    title: "Check me dikkat aayi",
    text: "System se baat karte waqt error aaya, isliye pakka pata nahi chal saka. Neeche “Phir bhi setup try karo” dabakar seedha try karo.",
  },
  restricted: {
    title: "System ne rok lagayi hai",
    text: "Tumhare phone ke system ne work profile banane par rok lagayi hai. Ye is phone ki limit hai — Safe Room hi nahi, koi bhi app is phone par work profile nahi bana sakti.",
  },
  device_owner: {
    title: "Phone company ke control me hai",
    text: "Ye phone kisi company ya organization ke control me lagta hai, isliye naya work profile nahi ban sakta.",
  },
  oem_blocked: {
    title: "Phone ke system ne mana kiya",
    text: "Tumhare phone ka system work profile banane ki permission nahi de raha. Agar phone me pehle se koi work profile hai to Settings me “Work profile” search karke use hatao, phir dobara try karo.",
  },
  not_allowed: {
    title: "Phone ke system ne mana kiya",
    text: "Tumhare phone ka system work profile banane ki permission nahi de raha.",
  },
  no_provisioning_ui: {
    title: "Is phone me option nahi hai",
    text: "Is phone ke system me work profile setup ka option hi maujood nahi hai.",
  },
  old_android: {
    title: "Android version purana hai",
    text: "Safe Room ke liye Android 7.0 ya usse naya chahiye.",
  },
};

const SafeRoom = () => {
  const navigate = useNavigate();
  const isNative = safeRoomService.isAvailable();
  const [provisioned, setProvisioned] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = async () => {
    const s = await safeRoomService.getStatus();
    setProvisioned(s.provisioned);
    if (!s.provisioned) {
      const c = await safeRoomService.checkProvision();
      setBlockedReason(c.allowed ? null : c.reason);
    } else {
      setBlockedReason(null);
    }
  };

  useEffect(() => {
    if (!isNative) return;
    refreshStatus();
  }, [isNative]);

  const handleOpen = async () => {
    setBusy(true);
    try {
      if (!provisioned) {
        toast.info("Setting up your Safe Room…");
        const ok = await safeRoomService.provision();
        if (!ok) {
          toast.error("Setup complete nahi hua.");
          await refreshStatus();
          return;
        }
        setProvisioned(true);
        toast.success("Safe Room ready.");
      }
      const opened = await safeRoomService.open();
      if (!opened) toast.error("Could not open Safe Room yet — try again.");
    } catch {
      toast.error("Something went wrong opening Safe Room.");
    } finally {
      setBusy(false);
    }
  };

  const handleWipe = async () => {
    if (!window.confirm("Wipe Safe Room? Every app and all data inside the sandbox will be destroyed. Your personal phone is untouched.")) return;
    setBusy(true);
    try {
      const ok = await safeRoomService.wipe();
      if (ok) {
        setProvisioned(false);
        toast.success("Safe Room wiped clean.");
      } else {
        toast.error("Wipe failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tpage">
      <span className="eyebrow">SAFE ROOM</span>
      <h1 className="serif">
        Run anything.
        <br />
        Risk nothing.
      </h1>
      <p className="tsub">
        Our flagship module. A sealed sandbox on your own phone for opening risky APKs, links and files —
        sealed off from everything you care about.
      </p>

      {isNative && (
        <div className="glass tcard" style={{ marginBottom: 18 }}>
          <p className="clabel">Your sandbox</p>
          {provisioned ? (
            <>
              <button
                type="button"
                className="cta"
                style={{ width: "100%" }}
                disabled={busy}
                onClick={handleOpen}
              >
                <span>{busy ? "Working…" : "Open Safe Room"}</span>
              </button>
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 10, opacity: 0.85 }}
                disabled={busy}
                onClick={handleWipe}
              >
                <span>Wipe Safe Room</span>
              </button>
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                Sandbox is active. Opening it feels like a fresh phone — install and run anything inside.
              </p>
            </>
          ) : blockedReason && BLOCKED_TEXT[blockedReason] ? (
            <>
              <div className="signal-row" style={{ borderBottom: "none", paddingTop: 6 }}>
                <div className="sicon">
                  <Smartphone />
                </div>
                <div>
                  <b>{BLOCKED_TEXT[blockedReason].title}</b>
                  <small>{BLOCKED_TEXT[blockedReason].text}</small>
                </div>
              </div>
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 8 }}
                disabled={busy}
                onClick={async () => { setBusy(true); await refreshStatus(); setBusy(false); }}
              >
                <span>{busy ? "Checking…" : "Dobara check karo"}</span>
              </button>
              <button
                type="button"
                className="cta"
                style={{ width: "100%", marginTop: 10, opacity: 0.8 }}
                disabled={busy}
                onClick={handleOpen}
              >
                <span>{busy ? "Working…" : "Phir bhi setup try karo"}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cta"
                style={{ width: "100%" }}
                disabled={busy}
                onClick={handleOpen}
              >
                <span>{busy ? "Working…" : "Set up Safe Room"}</span>
              </button>
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                One-time setup creates the isolated profile on this device.
              </p>
            </>
          )}
        </div>
      )}

      <div className="glass signals">
        <div className="signals-head">
          <h3>How it works</h3>
          <div className="avail">
            <div className="dot" />
            AVAILABLE
          </div>
        </div>
        {steps.map((s) => (
          <div className="signal-row" key={s.title}>
            <div className="sicon">
              <s.icon />
            </div>
            <div>
              <b>{s.title}</b>
              <small>{s.text}</small>
            </div>
          </div>
        ))}
      </div>

      {!isNative && (
        <div className="glass tcard" style={{ marginTop: 18 }}>
          <p className="clabel">On this device</p>
          <div className="signal-row" style={{ borderBottom: "none", paddingTop: 6 }}>
            <div className="sicon">
              <Smartphone />
            </div>
            <div>
              <b>Android app required</b>
              <small>The real sandbox runs inside the DEFENXIA Android app, enforced by the OS itself.</small>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="cta"
        style={{ width: "100%", marginTop: 18 }}
        onClick={() => navigate("/")}
      >
        <span>Back to Home</span>
      </button>
    </div>
  );
};

export default SafeRoom;
