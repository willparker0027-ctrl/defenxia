import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, Plus, RefreshCw, Search, FilePlus2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  nativeNfcService,
  isDesktopApp,
  type InstalledApp,
} from "@/services/nativeNfcService";

const MANUAL_APPS_KEY = "defenxia_manual_apps_v1";

const loadManualApps = (): string[] => {
  try {
    const raw = localStorage.getItem(MANUAL_APPS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map((s) => String(s).toLowerCase()).filter(Boolean) : [];
  } catch {
    return [];
  }
};

/**
 * AppLockWindows — desktop-native Windows app locker (Cisdem-style).
 * Lists installed Windows software (Start Menu scan via the bridge),
 * lets the user lock any of them with a toggle, and supports adding a
 * custom .exe by hand. Locking an .exe here arms the overlay + suspend
 * engine in the Electron main process.
 *
 * Desktop-only page; the mobile path keeps using AppPermissions.
 */
const AppLockWindows = () => {
  const [desktop] = useState(isDesktopApp());
  const { user, isLoading: authLoading, openAuthModal } = useAuth();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [protectedSet, setProtectedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  // null = still checking; false = no working unlock method (PIN, NFC card, RFID tag, fingerprint)
  const [hasUnlock, setHasUnlock] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (force = false) => {
    if (!isDesktopApp()) return;
    try {
      const [installed, prot] = await Promise.all([
        nativeNfcService.getInstalledApps(force),
        nativeNfcService.getProtectedApps(),
      ]);
      // Safety gate state: can the user actually unlock anything they lock?
      setHasUnlock(await nativeNfcService.hasUnlockMethod());
      const manual = loadManualApps();
      const seen = new Set(installed.map((a) => a.packageName.toLowerCase()));
      const manualApps: InstalledApp[] = manual
        .filter((exe) => !seen.has(exe))
        .map((exe) => ({
          packageName: exe,
          appName: exe.replace(/\.exe$/i, ""),
          isProtected: prot.map((p) => p.toLowerCase()).includes(exe),
        }));
      setApps([...installed, ...manualApps]);
      setProtectedSet(new Set(prot.map((p) => p.toLowerCase())));
    } catch (e) {
      console.warn("AppLockWindows load error:", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load(false);
      setLoading(false);
    })();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
    toast.success("App list refreshed");
  };

  const persistProtected = async (next: Set<string>) => {
    const list = Array.from(next);
    const ok = await nativeNfcService.setProtectedApps(list);
    if (ok) {
      setProtectedSet(next);
    } else {
      toast.error("Could not save the lock list");
    }
    return ok;
  };

  const toggleLock = async (exe: string) => {
    const key = exe.toLowerCase();
    if (toggling) return;
    const turningOn = !protectedSet.has(key);
    if (turningOn) {
      // Safety gate: never arm a lock the user cannot unlock.
      const ok = await nativeNfcService.hasUnlockMethod();
      setHasUnlock(ok);
      if (!ok) {
        toast.error(
          "Pehle NFC card / RFID tag register karo, fingerprint enroll karo, ya backup PIN set karo (NFC Keys page) — bina unlock method ke app lock nahi lagega.",
          { duration: 6000 }
        );
        return;
      }
    }
    setToggling(key);
    try {
      const next = new Set(protectedSet);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      const ok = await persistProtected(next);
      if (ok) {
        toast.success(
          next.has(key) ? `Locked ${exe}` : `Unlocked ${exe}`
        );
      }
    } finally {
      setToggling(null);
    }
  };

  const handleAddExe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const name = file.name || "";
    if (!/\.exe$/i.test(name)) {
      toast.error("Please choose a .exe file");
      return;
    }
    const exe = name.toLowerCase();
    const manual = loadManualApps();
    if (!manual.includes(exe)) {
      try {
        localStorage.setItem(MANUAL_APPS_KEY, JSON.stringify([...manual, exe]));
      } catch {
        /* storage full — still show it this session */
      }
    }
    setApps((prev) =>
      prev.some((a) => a.packageName.toLowerCase() === exe)
        ? prev
        : [...prev, { packageName: exe, appName: name.replace(/\.exe$/i, ""), isProtected: protectedSet.has(exe) }]
    );
    toast.success(`Added ${name} — toggle the lock to protect it`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = apps.filter(
      (a) =>
        !q ||
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => a.appName.localeCompare(b.appName));
  }, [apps, query]);

  const locked = useMemo(
    () => filtered.filter((a) => protectedSet.has(a.packageName.toLowerCase())),
    [filtered, protectedSet]
  );
  const unlocked = useMemo(
    () => filtered.filter((a) => !protectedSet.has(a.packageName.toLowerCase())),
    [filtered, protectedSet]
  );

  if (!desktop) {
    return (
      <div className="tpage">
        <span className="eyebrow">APP LOCK</span>
        <h1 className="serif">App Lock</h1>
        <p className="tsub">
          Windows software locking is only available inside the DEFENXIA desktop app.
        </p>
      </div>
    );
  }

  // First gate: login is mandatory. No user -> no App Lock at all.
  if (!authLoading && !user) {
    return (
      <div className="tpage">
        <span className="eyebrow">APP LOCK</span>
        <h1 className="serif">Lock any Windows software.</h1>
        <div className="glass tcard" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="ticon" style={{ width: 72, height: 72, borderRadius: 24, margin: "0 auto 16px" }}>
            <Lock size={30} />
          </div>
          <h3 className="serif" style={{ fontSize: 26 }}>Login zaroori hai.</h3>
          <p style={{ marginBottom: 20 }}>
            Pehle app me login karo — App Lock use karne ke liye login zaroori hai.
          </p>
          <button type="button" className="cta" style={{ margin: "0 auto" }} onClick={() => openAuthModal()}>
            <span>Login / Sign in</span>
          </button>
        </div>
      </div>
    );
  }

  const row = (app: InstalledApp) => {
    const key = app.packageName.toLowerCase();
    const isLocked = protectedSet.has(key);
    const busy = toggling === key;
    return (
      <div className="trow" key={key}>
        <span
          className="ticon"
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            flexShrink: 0,
            fontWeight: 700,
            fontSize: 15,
            color: isLocked ? "#fff" : undefined,
            background: isLocked
              ? "linear-gradient(135deg,#f9613f,#e8357b,#8b3df0)"
              : undefined,
          }}
        >
          {isLocked ? (
            <Lock size={19} />
          ) : (
            (app.appName || "?").substring(0, 2).toUpperCase()
          )}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {app.appName}
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono',monospace",
              color: "var(--faint)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {app.packageName}
          </div>
        </div>
        {isLocked && (
          <span className="pill ok" style={{ fontSize: 9, padding: "5px 10px" }}>
            LOCKED
          </span>
        )}
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={isLocked}
          aria-label={`${isLocked ? "Unlock" : "Lock"} ${app.appName}`}
          disabled={busy}
          onClick={() => toggleLock(app.packageName)}
          style={{ opacity: busy ? 0.5 : 1 }}
        />
      </div>
    );
  };

  return (
    <div className="tpage">
      <span className="eyebrow">APP LOCK</span>
      <h1 className="serif">Lock any Windows software.</h1>
      <p className="tsub">
        Toggle the lock on any installed program. When a locked app is opened,
        DEFENXIA freezes it and shows the unlock screen — tap your NFC card or
        enter your PIN to open it.
      </p>

      {hasUnlock === false && (
        <div
          className="glass tcard"
          role="alert"
          style={{
            border: "1px solid rgba(245,165,36,0.5)",
            background: "rgba(245,165,36,0.08)",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={18} style={{ color: "#f5a524", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13.5, margin: 0, color: "var(--ink)", lineHeight: 1.6 }}>
            <strong>No unlock method set.</strong> Pehle NFC card / RFID tag register karo, fingerprint enroll karo ya
            backup PIN set karo (NFC Keys page) — bina unlock method ke app lock
            nahi lagega.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="glass tcard">
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--faint)",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps…"
              aria-label="Search installed apps"
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid rgba(205,194,247,0.18)",
                background: "rgba(6,6,9,0.6)",
                padding: "11px 14px 11px 40px",
                fontSize: 14,
                color: "#fff",
                outline: "none",
              }}
            />
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Plus size={15} /> Add custom .exe
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Rescan installed apps"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin-slow" : ""} />
            Rescan
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".exe"
            onChange={handleAddExe}
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </div>

      {loading || authLoading ? (
        <div className="glass tcard" style={{ textAlign: "center", padding: "48px 24px" }}>
          <RefreshCw size={36} className="animate-spin-slow" style={{ margin: "0 auto 16px", color: "var(--lav)" }} />
          <h3 className="serif" style={{ fontSize: 26 }}>Scanning installed software…</h3>
          <p>Reading your Start Menu programs.</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="glass tcard" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="ticon" style={{ width: 72, height: 72, borderRadius: 24, margin: "0 auto 16px" }}>
            <FilePlus2 size={30} />
          </div>
          <h3 className="serif" style={{ fontSize: 26 }}>No apps found.</h3>
          <p style={{ marginBottom: 20 }}>
            Couldn't read your installed programs. You can still add any .exe by hand.
          </p>
          <button type="button" className="cta" style={{ margin: "0 auto" }} onClick={() => fileRef.current?.click()}>
            <span>Add a .exe manually</span>
          </button>
        </div>
      ) : (
        <>
          {locked.length > 0 && (
            <div className="glass tcard">
              <p className="clabel" style={{ color: "#8fd0a8" }}>
                Locked · {locked.length}
              </p>
              {locked.map(row)}
            </div>
          )}

          <div className="glass tcard">
            <p className="clabel">
              All apps · {unlocked.length}
              {query.trim() && ` · matching “${query.trim()}”`}
            </p>
            {unlocked.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--faint)", margin: 0 }}>
                {query.trim()
                  ? "No apps match your search."
                  : "Everything is locked — nice."}
              </p>
            ) : (
              unlocked.map(row)
            )}
          </div>
        </>
      )}

      <div className="glass tcard" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Lock size={17} style={{ color: "var(--lav)", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
          Locked apps are suspended the moment they come to the foreground and can
          only be opened with your registered NFC card or backup PIN. Manage your
          cards and PIN under <strong style={{ color: "var(--ink)" }}>NFC Keys</strong>.
        </p>
      </div>
    </div>
  );
};

export default AppLockWindows;
