import { registerPlugin, Capacitor } from '@capacitor/core';
import { desktopBridge, isDesktopApp } from './desktopBridge';

export interface NfcStatus {
  available: boolean;
  enabled: boolean;
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  icon?: string;
  isProtected: boolean;
}

export interface CardSlotInfo {
  slot: 'blue' | 'white';
  label: string;
  uidMasked: string;
  rawUid?: string;
  registered: boolean;
}

export interface AuthorizedCardsResponse {
  blueCard: CardSlotInfo;
  whiteCard: CardSlotInfo;
}

export interface CardDetectionEvent {
  uid: string;
  technologies: string[];
  authorized: boolean;
  cardName: string;
}

export interface PermissionsStatus {
  accessibilityGranted?: boolean;
  usageStatsGranted: boolean;
  overlayGranted: boolean;
  batteryOptimizationIgnored?: boolean;
  nfcAvailable?: boolean;
  nfcEnabled?: boolean;
  monitorServiceRunning?: boolean;
}

export interface LockDiagnostics {
  serviceRunning: boolean;
  usageStatsGranted: boolean;
  overlayGranted: boolean;
  protectedPackages: string[];
  lastDetectedPackage: string;
  lastLaunchAttemptAt: number;
  lastLaunchResult: string;
  lastCrashLog: string;
  sdkInt: number;
}

export interface DefenxiaNfcPluginInterface {
  getNfcStatus(): Promise<NfcStatus>;
  getInstalledApps(options?: { forceRefresh?: boolean }): Promise<{ apps: InstalledApp[] }>;
  getProtectedApps(): Promise<{ protectedPackages: string[]; lockTimeoutSeconds?: number }>;
  setProtectedApps(options: { packages: string[] }): Promise<{ success: boolean }>;
  getAuthorizedCards(): Promise<AuthorizedCardsResponse>;
  registerCard(options: { slot: string; uid: string }): Promise<{ success: boolean; slot: string; uidMasked: string }>;
  startCardTester(): Promise<{ listening: boolean }>;
  stopCardTester(): Promise<{ listening: boolean }>;
  getAppLockPermissions(): Promise<PermissionsStatus>;
  getLockDiagnostics(): Promise<LockDiagnostics>;
  openUsageStatsSettings(): Promise<{ opened: boolean }>;
  openAccessibilitySettings(): Promise<{ opened: boolean }>;
  openOverlaySettings(): Promise<{ opened: boolean }>;
  openBatteryOptimizationSettings(): Promise<{ opened: boolean }>;
  openNfcSettings(): Promise<{ opened: boolean }>;
  startAppLockMonitor(): Promise<{ started: boolean }>;
  stopAppLockMonitor(): Promise<{ stopped: boolean }>;
  clearCrashLog(): Promise<{ cleared: boolean }>;
  exitApp(): Promise<{ success: boolean }>;
  checkCameraPermission(): Promise<{ granted: boolean }>;
  requestCameraPermission(): Promise<{ requested: boolean }>;
  checkWifiPermissions(): Promise<{ granted: boolean; locationGranted: boolean; wifiStateGranted: boolean }>;
  requestWifiPermissions(): Promise<{ requested: boolean }>;
  getConnectedWifiSecurity(): Promise<ConnectedWifiSecurityResponse>;
  scanInstalledAppsPermissions(): Promise<{ apps: InstalledAppPermission[] }>;
  addListener(eventName: 'cardDetected', listenerFunc: (data: CardDetectionEvent) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

export interface InstalledAppPermission {
  packageName: string;
  appName: string;
  icon: string | null;
  permissions: string[];
  suspiciousPermissions: string[];
  riskLevel: 'high' | 'medium' | 'low';
  suspicionReason: string;
}

export interface ConnectedWifiSecurityResponse {
  connected: boolean;
  ssid: string;
  bssid: string;
  rssi: number;
  signalLevel: number;
  linkSpeedMbps: number;
  frequencyMhz: number;
  band: string;
  ipAddress: string;
  securityType: string;
  isSafe: boolean;
  threatLevel: 'safe' | 'warning' | 'critical';
  message: string;
  vulnerabilities: string[];
  locationPermissionGranted: boolean;
}

const DefenxiaNfc = registerPlugin<DefenxiaNfcPluginInterface>('DefenxiaNfc');

export const isNativeAndroid = (): boolean => {
  return typeof window !== 'undefined' && 
         Capacitor.isNativePlatform() && 
         Capacitor.getPlatform() === 'android';
};

const capacitorNfcService = {
  isAvailable: isNativeAndroid,

  async getNfcStatus(): Promise<NfcStatus> {
    if (!isNativeAndroid()) {
      return { available: false, enabled: false };
    }
    try {
      return await DefenxiaNfc.getNfcStatus();
    } catch (e) {
      console.warn('getNfcStatus error:', e);
      return { available: false, enabled: false };
    }
  },

  async getInstalledApps(forceRefresh = false): Promise<InstalledApp[]> {
    if (!isNativeAndroid()) {
      return [];
    }
    try {
      const res = await DefenxiaNfc.getInstalledApps({ forceRefresh });
      return res.apps || [];
    } catch (e) {
      console.warn('getInstalledApps error:', e);
      return [];
    }
  },

  async getProtectedApps(): Promise<string[]> {
    if (!isNativeAndroid()) {
      return [];
    }
    try {
      const res = await DefenxiaNfc.getProtectedApps();
      return res.protectedPackages || [];
    } catch (e) {
      console.warn('getProtectedApps error:', e);
      return [];
    }
  },

  async setProtectedApps(packages: string[]): Promise<boolean> {
    if (!isNativeAndroid()) {
      return false;
    }
    try {
      const res = await DefenxiaNfc.setProtectedApps({ packages });
      return res.success;
    } catch (e) {
      console.warn('setProtectedApps error:', e);
      return false;
    }
  },

  async getAuthorizedCards(): Promise<AuthorizedCardsResponse | null> {
    if (!isNativeAndroid()) {
      return null;
    }
    try {
      return await DefenxiaNfc.getAuthorizedCards();
    } catch (e) {
      console.warn('getAuthorizedCards error:', e);
      return null;
    }
  },

  /**
   * Safety gate: true when at least one working unlock method exists —
   * a registered NFC card (blue/white slot) or, on desktop, a backup PIN,
   * an RFID kit tag, or an enrolled fingerprint. Lock toggles must refuse
   * to arm while this is false, otherwise the user can lock themselves out
   * with no way back in. Never throws.
   */
  async hasUnlockMethod(): Promise<boolean> {
    try {
      if (isDesktopApp()) {
        const [cards, pin, rfids, fp] = await Promise.all([
          desktopBridge.getAuthorizedCards().catch(() => null),
          desktopBridge.hasPin().catch(() => false),
          desktopBridge.getRfidTags().catch(() => []),
          desktopBridge.getFingerprintStatus().catch(() => ({ enrolled: false, deviceReady: false })),
        ]);
        const cardOk =
          !!cards &&
          (cards.blueCard?.registered === true || cards.whiteCard?.registered === true);
        return cardOk || pin === true || rfids.length > 0 || fp.enrolled === true;
      }
      if (!isNativeAndroid()) {
        return false;
      }
      const cards = await DefenxiaNfc.getAuthorizedCards().catch(() => null);
      return (
        !!cards &&
        (cards.blueCard?.registered === true || cards.whiteCard?.registered === true)
      );
    } catch (e) {
      console.warn('hasUnlockMethod error:', e);
      return false;
    }
  },

  async registerCard(slot: 'blue' | 'white', uid: string): Promise<boolean> {
    if (!isNativeAndroid()) {
      return false;
    }
    try {
      const res = await DefenxiaNfc.registerCard({ slot, uid });
      return res.success;
    } catch (e) {
      console.warn('registerCard error:', e);
      return false;
    }
  },

  async startCardTester(onCardDetected: (event: CardDetectionEvent) => void): Promise<() => void> {
    if (!isNativeAndroid()) {
      return () => {};
    }
    try {
      await DefenxiaNfc.removeAllListeners();
      const handle = await DefenxiaNfc.addListener('cardDetected', onCardDetected);
      await DefenxiaNfc.startCardTester();

      return async () => {
        try {
          await DefenxiaNfc.stopCardTester();
          if (handle && handle.remove) {
            handle.remove();
          }
        } catch (e) {
          console.warn('stopCardTester error:', e);
        }
      };
    } catch (e) {
      console.warn('startCardTester error:', e);
      return () => {};
    }
  },

  async stopCardTester(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.stopCardTester();
    } catch (e) {
      console.warn('stopCardTester error:', e);
    }
  },

  async checkPermissions(): Promise<PermissionsStatus> {
    if (!isNativeAndroid()) {
      return { usageStatsGranted: false, overlayGranted: false };
    }
    try {
      return await DefenxiaNfc.getAppLockPermissions();
    } catch (e) {
      console.warn('checkPermissions error:', e);
      return { usageStatsGranted: false, overlayGranted: false };
    }
  },

  async getLockDiagnostics(): Promise<LockDiagnostics | null> {
    if (!isNativeAndroid()) return null;
    try {
      return await DefenxiaNfc.getLockDiagnostics();
    } catch (e) {
      console.warn('getLockDiagnostics error:', e);
      return null;
    }
  },

  async clearCrashLog(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.clearCrashLog();
    } catch (e) {
      console.warn('clearCrashLog error:', e);
    }
  },

  async openUsageStatsSettings(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.openUsageStatsSettings();
    } catch (e) {
      console.warn('openUsageStatsSettings error:', e);
    }
  },

  async openAccessibilitySettings(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.openAccessibilitySettings();
    } catch (e) {
      console.warn('openAccessibilitySettings error:', e);
    }
  },

  async startAppLockMonitor(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.startAppLockMonitor();
    } catch (e) {
      console.warn('startAppLockMonitor error:', e);
    }
  },

  async stopAppLockMonitor(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.stopAppLockMonitor();
    } catch (e) {
      console.warn('stopAppLockMonitor error:', e);
    }
  },

  async openOverlaySettings(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.openOverlaySettings();
    } catch (e) {
      console.warn('openOverlaySettings error:', e);
    }
  },

  async openBatteryOptimizationSettings(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.openBatteryOptimizationSettings();
    } catch (e) {
      console.warn('openBatteryOptimizationSettings error:', e);
    }
  },

  async openNfcSettings(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.openNfcSettings();
    } catch (e) {
      console.warn('openNfcSettings error:', e);
    }
  },

  async exitApp(): Promise<void> {
    if (!isNativeAndroid()) return;
    try {
      await DefenxiaNfc.exitApp();
    } catch (e) {
      console.warn('exitApp error:', e);
    }
  },

  async checkCameraPermission(): Promise<{ granted: boolean }> {
    if (!isNativeAndroid()) {
      return { granted: true }; // Standard web browser handles it via getUserMedia prompt
    }
    try {
      return await DefenxiaNfc.checkCameraPermission();
    } catch (e) {
      console.warn('checkCameraPermission error:', e);
      return { granted: false };
    }
  },

  async requestCameraPermission(): Promise<{ requested: boolean }> {
    if (!isNativeAndroid()) return { requested: true };
    try {
      return await DefenxiaNfc.requestCameraPermission();
    } catch (e) {
      console.warn('requestCameraPermission error:', e);
      return { requested: false };
    }
  },

  async checkWifiPermissions(): Promise<{ granted: boolean; locationGranted: boolean; wifiStateGranted: boolean }> {
    if (!isNativeAndroid()) {
      return { granted: true, locationGranted: true, wifiStateGranted: true };
    }
    try {
      return await DefenxiaNfc.checkWifiPermissions();
    } catch (e) {
      console.warn('checkWifiPermissions error:', e);
      return { granted: false, locationGranted: false, wifiStateGranted: false };
    }
  },

  async requestWifiPermissions(): Promise<{ requested: boolean }> {
    if (!isNativeAndroid()) return { requested: true };
    try {
      return await DefenxiaNfc.requestWifiPermissions();
    } catch (e) {
      console.warn('requestWifiPermissions error:', e);
      return { requested: false };
    }
  },

  async getConnectedWifiSecurity(): Promise<ConnectedWifiSecurityResponse | null> {
    if (!isNativeAndroid()) {
      return null;
    }
    try {
      return await DefenxiaNfc.getConnectedWifiSecurity();
    } catch (e) {
      console.warn('getConnectedWifiSecurity error:', e);
      return null;
    }
  },

  async scanInstalledAppsPermissions(): Promise<InstalledAppPermission[]> {
    if (!isNativeAndroid()) {
      return [];
    }
    try {
      const res = await DefenxiaNfc.scanInstalledAppsPermissions();
      return res?.apps || [];
    } catch (e) {
      console.warn('scanInstalledAppsPermissions error:', e);
      return [];
    }
  }
};

// ---- Desktop (Electron/Windows) delegation shim ---------------------------
// When running inside the DEFENXIA desktop shell (window.defenxia.isDesktop
// === true), every capability above is served by desktopBridge (IPC to the
// Electron main process) instead of the Capacitor plugin. The mobile path is
// completely unchanged: isDesktopApp() is false on Android/web, so the proxy
// hands every property straight through to the Capacitor implementation.
export const nativeNfcService: typeof capacitorNfcService = new Proxy(capacitorNfcService, {
  get(target, prop, _receiver) {
    if (isDesktopApp() && prop in desktopBridge) {
      const value = (desktopBridge as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(desktopBridge) : value;
    }
    return (target as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { isDesktopApp };
