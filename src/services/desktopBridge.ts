/**
 * desktopBridge — desktop (Electron/Windows) implementation of the
 * DefenxiaNfcPlugin capability surface, routed through the preload API
 * exposed as `window.defenxia`.
 *
 * IMPORTANT: this module is ONLY used when `window.defenxia?.isDesktop`
 * is true (see the delegation shim at the bottom of nativeNfcService.ts).
 * The Capacitor/Android path never touches this file, so mobile behavior
 * is completely unchanged.
 *
 * Method signatures intentionally mirror `nativeNfcService` (the object
 * pages import), so the proxy shim can delegate 1:1.
 */
import type {
  NfcStatus,
  InstalledApp,
  AuthorizedCardsResponse,
  CardSlotInfo,
  CardDetectionEvent,
  PermissionsStatus,
  LockDiagnostics,
} from './nativeNfcService';

export const isDesktopApp = (): boolean =>
  typeof window !== 'undefined' && !!window.defenxia?.isDesktop;

const invoke = <T = any>(channel: string, args?: any): Promise<T> => {
  const bridge = typeof window !== 'undefined' ? window.defenxia : undefined;
  if (!bridge?.isDesktop || typeof bridge.invoke !== 'function') {
    return Promise.reject(new Error(`Desktop bridge unavailable for channel "${channel}"`));
  }
  return bridge.invoke(channel, args) as Promise<T>;
};

/* nfc:cards:get may return a card slot as null (empty), as an object
   {slot, uidMasked, registered}, or — legacy shape — as a plain UID
   string for the white card. Normalize everything to CardSlotInfo. */
const normalizeSlot = (slot: 'blue' | 'white', raw: any): CardSlotInfo => {
  const label = slot === 'blue' ? 'Blue Security Card' : 'White Security Card';
  if (!raw) {
    return { slot, label, uidMasked: '', registered: false };
  }
  if (typeof raw === 'string') {
    return { slot, label, uidMasked: raw, registered: true };
  }
  return {
    slot,
    label,
    uidMasked: raw.uidMasked ?? '',
    rawUid: raw.rawUid,
    registered: raw.registered === true || !!raw.uidMasked,
  };
};

export interface OverlayTarget {
  appName: string;
  packageName?: string;
}

/* ---- Bridge query result shapes (DefenxiaBridge request/response) ---- */

export interface NfcReaderInfo {
  name: string;
  kind: 'pcsc' | 'serial';
}

export interface WifiNetInfo {
  ssid: string;
  bssid?: string;
  signal?: number; // 0–100 (%)
  radio?: string;
  auth?: string;
  cipher?: string;
  channel?: string;
}

export interface WifiQueryResult {
  ok: boolean;
  connected: WifiNetInfo | null;
  networks: WifiNetInfo[];
  error?: string;
}

export interface SysinfoResult {
  ok: boolean;
  os?: string;
  cpu?: string;
  ramGB?: number;
  diskFreeGB?: number;
  error?: string;
}

export interface FirewallResult {
  ok: boolean;
  domain?: boolean;
  private?: boolean;
  public?: boolean;
  error?: string;
}

export interface StartupItemInfo {
  name: string;
  command: string;
}

export interface StartupResult {
  ok: boolean;
  items: StartupItemInfo[];
  error?: string;
}

export const desktopBridge = {
  isAvailable: (): boolean => isDesktopApp(),

  async getNfcStatus(): Promise<NfcStatus> {
    try {
      const res = await invoke<any>('nfc:status');
      return { available: !!res?.available, enabled: !!res?.enabled };
    } catch (e) {
      console.warn('desktop getNfcStatus error:', e);
      return { available: false, enabled: false };
    }
  },

  async getInstalledApps(forceRefresh = false): Promise<InstalledApp[]> {
    try {
      const res = await invoke<{ apps?: InstalledApp[] }>('nfc:apps', { forceRefresh });
      return res?.apps || [];
    } catch (e) {
      console.warn('desktop getInstalledApps error:', e);
      return [];
    }
  },

  async getProtectedApps(): Promise<string[]> {
    try {
      const res = await invoke<{ protectedPackages?: string[] }>('nfc:protected:get');
      return res?.protectedPackages || [];
    } catch (e) {
      console.warn('desktop getProtectedApps error:', e);
      return [];
    }
  },

  async setProtectedApps(packages: string[]): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('nfc:protected:set', { packages });
      return res?.success === true;
    } catch (e) {
      console.warn('desktop setProtectedApps error:', e);
      return false;
    }
  },

  async getAuthorizedCards(): Promise<AuthorizedCardsResponse | null> {
    try {
      const res = await invoke<any>('nfc:cards:get');
      if (!res) return null;
      return {
        blueCard: normalizeSlot('blue', res.blueCard),
        whiteCard: normalizeSlot('white', res.whiteCard),
      };
    } catch (e) {
      console.warn('desktop getAuthorizedCards error:', e);
      return null;
    }
  },

  async registerCard(slot: 'blue' | 'white', uid: string): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('nfc:card:register', { slot, uid });
      return res?.success === true;
    } catch (e) {
      console.warn('desktop registerCard error:', e);
      return false;
    }
  },

  async unregisterCard(slot: 'blue' | 'white'): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('nfc:card:unregister', { slot });
      return res?.success === true;
    } catch (e) {
      console.warn('desktop unregisterCard error:', e);
      return false;
    }
  },

  async startCardTester(onCardDetected: (event: CardDetectionEvent) => void): Promise<() => void> {
    try {
      await invoke('nfc:tester:start');
    } catch (e) {
      console.warn('desktop startCardTester error:', e);
    }
    let off: (() => void) | undefined;
    try {
      off = window.defenxia!.onCardDetected((evt) => {
        onCardDetected({
          uid: evt.uid,
          technologies: [],
          authorized: false,
          cardName: evt.reader || 'NFC card',
        });
      });
    } catch (e) {
      console.warn('desktop onCardDetected subscribe error:', e);
    }
    let stopped = false;
    return async () => {
      if (stopped) return;
      stopped = true;
      try {
        if (typeof off === 'function') off();
      } catch {
        /* noop */
      }
      try {
        await invoke('nfc:tester:stop');
      } catch (e) {
        console.warn('desktop stopCardTester error:', e);
      }
    };
  },

  async stopCardTester(): Promise<void> {
    try {
      await invoke('nfc:tester:stop');
    } catch (e) {
      console.warn('desktop stopCardTester error:', e);
    }
  },

  async checkPermissions(): Promise<PermissionsStatus> {
    try {
      const res = await invoke<any>('nfc:perm');
      return {
        usageStatsGranted: !!res?.usageStatsGranted,
        overlayGranted: !!res?.overlayGranted,
        batteryOptimizationIgnored: res?.batteryOptimizationIgnored,
        nfcAvailable: res?.nfcAvailable,
        nfcEnabled: res?.nfcEnabled,
        monitorServiceRunning: res?.monitorServiceRunning,
      };
    } catch (e) {
      console.warn('desktop checkPermissions error:', e);
      return { usageStatsGranted: false, overlayGranted: false };
    }
  },

  async getLockDiagnostics(): Promise<LockDiagnostics | null> {
    try {
      const res = await invoke<any>('nfc:diag');
      return res ?? null;
    } catch (e) {
      console.warn('desktop getLockDiagnostics error:', e);
      return null;
    }
  },

  async startAppLockMonitor(): Promise<void> {
    try {
      await invoke('nfc:monitor:start');
    } catch (e) {
      console.warn('desktop startAppLockMonitor error:', e);
    }
  },

  async stopAppLockMonitor(): Promise<void> {
    try {
      await invoke('nfc:monitor:stop');
    } catch (e) {
      console.warn('desktop stopAppLockMonitor error:', e);
    }
  },

  async exitApp(): Promise<void> {
    try {
      await invoke('app:quit');
    } catch (e) {
      console.warn('desktop exitApp error:', e);
    }
  },

  async addListener(
    eventName: 'cardDetected',
    listenerFunc: (data: CardDetectionEvent) => void,
  ): Promise<{ remove: () => void }> {
    if (eventName !== 'cardDetected') {
      return { remove: () => {} };
    }
    const off = window.defenxia!.onCardDetected((evt) => {
      listenerFunc({
        uid: evt.uid,
        technologies: [],
        authorized: false,
        cardName: evt.reader || 'NFC card',
      });
    });
    return { remove: () => { if (typeof off === 'function') off(); } };
  },

  async removeAllListeners(): Promise<void> {
    // The preload API exposes per-subscription unsubscribe functions;
    // there is no global remove-all channel, so this is intentionally a no-op.
  },

  /* ---- Desktop-only helpers (PIN / enhanced protection / overlay) ---- */

  async getOverlayTarget(): Promise<OverlayTarget | null> {
    try {
      const res = await invoke<any>('overlay:getTarget');
      if (!res) return null;
      return { appName: res.appName || 'Locked application', packageName: res.packageName };
    } catch (e) {
      console.warn('desktop getOverlayTarget error:', e);
      return null;
    }
  },

  async pinUnlockOverlay(pin: string): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('overlay:pin:unlock', { pin });
      return res?.success === true;
    } catch (e) {
      console.warn('desktop pinUnlockOverlay error:', e);
      return false;
    }
  },

  /* Close the locked app without unlocking it (overlay ✕ button).
     The app process is terminated; it was never unlocked. */
  async closeLockedApp(): Promise<boolean> {
    try {
      const res = await invoke<{ ok?: boolean }>('overlay:close-app');
      return res?.ok === true;
    } catch (e) {
      console.warn('desktop closeLockedApp error:', e);
      return false;
    }
  },

  /* ---- Phone-tap unlock (pairing is driven by Electron main) ---- */

  async phonePairStart(userId?: string, email?: string): Promise<{ ok: boolean; code?: string; userId?: string; email?: string; expiresAt?: number; loginRequired?: boolean; message?: string }> {
    try {
      const res = await invoke<any>('phone:pair:start', { userId, email });
      return res || { ok: false };
    } catch (e) {
      console.warn('desktop phonePairStart error:', e);
      return { ok: false, message: 'pairing failed' };
    }
  },

  async phonePairCancel(): Promise<void> {
    try {
      await invoke('phone:pair:cancel');
    } catch {
      /* ignore */
    }
  },

  onPhoneStatus(cb: (status: { state: string; code?: string; reason?: string }) => void): () => void {
    try {
      const off = (window as any).defenxia?.onPhoneStatus?.((payload: any) => cb(payload));
      return typeof off === 'function' ? off : () => {};
    } catch {
      return () => {};
    }
  },

  async hasPin(): Promise<boolean> {
    try {
      const res = await invoke<{ has?: boolean }>('auth:pin:has');
      return res?.has === true;
    } catch (e) {
      console.warn('desktop hasPin error:', e);
      return false;
    }
  },

  async setPin(pin: string): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('auth:pin:set', { pin });
      return res?.success === true;
    } catch (e) {
      console.warn('desktop setPin error:', e);
      return false;
    }
  },

  /* ---- RFID kit tags ---- */
  async getRfidTags(): Promise<{ uid: string; uidMasked: string; label: string }[]> {
    try {
      const res = await invoke<{ tags?: { uid: string; uidMasked: string; label: string }[] }>('rfid:tags:get');
      return res?.tags || [];
    } catch {
      return [];
    }
  },
  async addRfidTag(uid: string, label?: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await invoke<{ success?: boolean; message?: string }>('rfid:tag:add', { uid, label });
      return { ok: res?.success === true, message: res?.message };
    } catch {
      return { ok: false };
    }
  },
  async removeRfidTag(uid: string): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('rfid:tag:remove', { uid });
      return res?.success === true;
    } catch {
      return false;
    }
  },
  async unlockWithRfid(uid: string): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('rfid:unlock', { uid });
      return res?.success === true;
    } catch {
      return false;
    }
  },

  /* ---- Fingerprint unlock (Mantra MFS100, desktop only) ---- */
  async getFingerprintStatus(): Promise<{ enrolled: boolean; deviceReady: boolean; message?: string }> {
    try {
      const res = await invoke<{ enrolled?: boolean; deviceReady?: boolean; message?: string }>('fingerprint:status');
      return { enrolled: !!res?.enrolled, deviceReady: !!res?.deviceReady, message: res?.message };
    } catch (e) {
      console.warn('desktop getFingerprintStatus error:', e);
      return { enrolled: false, deviceReady: false };
    }
  },
  async enrollFingerprint(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('fingerprint:enroll');
      return res?.success === true
        ? { ok: true }
        : { ok: false, error: res?.error || 'fingerprint enroll failed' };
    } catch (e) {
      console.warn('desktop enrollFingerprint error:', e);
      return { ok: false, error: 'unavailable' };
    }
  },
  async verifyFingerprint(): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('fingerprint:verify');
      return res?.success === true;
    } catch (e) {
      console.warn('desktop verifyFingerprint error:', e);
      return false;
    }
  },
  async removeFingerprint(): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('fingerprint:remove');
      return res?.success === true;
    } catch (e) {
      console.warn('desktop removeFingerprint error:', e);
      return false;
    }
  },

  /* App version (from the packaged app) for the on-screen version badge. */
  async getAppVersion(): Promise<string> {
    try {
      const v = await invoke<string>('app:version');
      return typeof v === 'string' ? v : '';
    } catch {
      return '';
    }
  },

  /* Fired by main every time the lock overlay is (re)shown — the overlay
     window is reused, so the renderer must reset its per-lock state. */
  onOverlayShow(cb: (target: any) => void): () => void {
    try {
      const off = (window as any).defenxia?.onOverlayShow?.((payload: any) => cb(payload));
      return typeof off === 'function' ? off : () => {};
    } catch {
      return () => {};
    }
  },

  /* Raw card-tap events from any reader (serial / PC-SC). */
  onCardDetected(cb: (evt: { uid?: string }) => void): () => void {
    try {
      const off = (window as any).defenxia?.onCardDetected?.((payload: any) => cb(payload || {}));
      return typeof off === 'function' ? off : () => {};
    } catch {
      return () => {};
    }
  },

  /* USB-serial RFID (Arduino) diagnostics. */
  async getSerialStatus(): Promise<{
    ports: string[]; opened: { port: string; baud: number; silentSec: number; hasData: boolean }[];
    lastError: string; lastRawLine: string; lastUid: string; lastLineAgeSec: number;
  }> {
    try {
      const res = await invoke<any>('serial:status:get');
      return {
        ports: res?.ports || [], opened: res?.opened || [],
        lastError: res?.lastError || '', lastRawLine: res?.lastRawLine || '',
        lastUid: res?.lastUid || '', lastLineAgeSec: res?.lastLineAgeSec ?? -1,
      };
    } catch {
      return { ports: [], opened: [], lastError: '', lastRawLine: '', lastUid: '', lastLineAgeSec: -1 };
    }
  },
  async refreshSerialStatus(): Promise<void> {
    try { await invoke('serial:status:refresh'); } catch { /* ignore */ }
  },
  onSerialStatus(cb: (s: any) => void): () => void {
    try {
      const off = (window as any).defenxia?.onSerialStatus?.((payload: any) => cb(payload || {}));
      return typeof off === 'function' ? off : () => {};
    } catch {
      return () => {};
    }
  },

  async getEnhancedProtection(): Promise<boolean> {
    try {
      const res = await invoke<{ enabled?: boolean }>('protect:enhanced:get');
      return res?.enabled === true;
    } catch (e) {
      console.warn('desktop getEnhancedProtection error:', e);
      return false;
    }
  },

  async setEnhancedProtection(enabled: boolean): Promise<boolean> {
    try {
      const res = await invoke<{ success?: boolean }>('protect:enhanced:set', { enabled });
      return res?.success === true;
    } catch (e) {
      console.warn('desktop setEnhancedProtection error:', e);
      return false;
    }
  },

  /* ---- Bridge query helpers (DefenxiaBridge request/response) ---- */

  async getNfcReaders(): Promise<NfcReaderInfo[]> {
    try {
      const res = await invoke<any>('nfc:status');
      const raw = res?.readers;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((r: any): NfcReaderInfo | null => {
          if (typeof r === 'string') {
            return {
              name: r,
              kind: /arduino|\(COM\d+\)/i.test(r) ? 'serial' : 'pcsc',
            };
          }
          const name = String(r?.name ?? '').trim();
          if (!name) return null;
          return { name, kind: r?.kind === 'serial' ? 'serial' : 'pcsc' };
        })
        .filter((r: NfcReaderInfo | null): r is NfcReaderInfo => r !== null);
    } catch (e) {
      console.warn('desktop getNfcReaders error:', e);
      return [];
    }
  },

  async getWifi(): Promise<WifiQueryResult> {
    try {
      const res = await invoke<any>('wifi:get');
      if (!res || res.ok === false) {
        return { ok: false, connected: null, networks: [], error: res?.error || 'unavailable' };
      }
      return {
        ok: true,
        connected: res.connected ?? null,
        networks: Array.isArray(res.networks) ? res.networks : [],
      };
    } catch (e) {
      console.warn('desktop getWifi error:', e);
      return { ok: false, connected: null, networks: [], error: 'unavailable' };
    }
  },

  async getSysinfo(): Promise<SysinfoResult> {
    try {
      const res = await invoke<any>('sysinfo:get');
      if (!res || res.ok === false) {
        return { ok: false, error: res?.error || 'unavailable' };
      }
      return {
        ok: true,
        os: res.os,
        cpu: res.cpu,
        ramGB: typeof res.ramGB === 'number' ? res.ramGB : undefined,
        diskFreeGB: typeof res.diskFreeGB === 'number' ? res.diskFreeGB : undefined,
      };
    } catch (e) {
      console.warn('desktop getSysinfo error:', e);
      return { ok: false, error: 'unavailable' };
    }
  },

  async getFirewall(): Promise<FirewallResult> {
    try {
      const res = await invoke<any>('firewall:get');
      if (!res || res.ok === false) {
        return { ok: false, error: res?.error || 'unavailable' };
      }
      return {
        ok: true,
        domain: !!res.domain,
        private: !!res.private,
        public: !!res.public,
      };
    } catch (e) {
      console.warn('desktop getFirewall error:', e);
      return { ok: false, error: 'unavailable' };
    }
  },

  async getStartup(): Promise<StartupResult> {
    try {
      const res = await invoke<any>('startup:get');
      if (!res || res.ok === false) {
        return { ok: false, items: [], error: res?.error || 'unavailable' };
      }
      const items = Array.isArray(res.items) ? res.items : [];
      return {
        ok: true,
        items: items
          .map((it: any) => ({ name: String(it?.name ?? ''), command: String(it?.command ?? '') }))
          .filter((it: StartupItemInfo) => it.name),
      };
    } catch (e) {
      console.warn('desktop getStartup error:', e);
      return { ok: false, items: [], error: 'unavailable' };
    }
  },
};
