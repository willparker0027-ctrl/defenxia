import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * TypeScript interface for the native FingerprintAuth Capacitor plugin
 * (FingerprintAuthPlugin.java, registered in MainActivity).
 */
export interface FingerprintAuthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  authenticate(): Promise<{ success: boolean }>;
}

const FingerprintAuth = registerPlugin<FingerprintAuthPlugin>('FingerprintAuth');

/** True when running inside the native Android/iOS shell (not the web). */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** True when the device has strong biometric hardware enrolled and ready. Web always returns false. */
export async function isFingerprintAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await FingerprintAuth.isAvailable();
    return res?.available === true;
  } catch {
    return false;
  }
}

/**
 * Prompts for fingerprint authentication ("Unlock Windows").
 * Returns { ok: true } on success, { ok: false, message } on web or any failure.
 */
export async function authenticateFingerprint(): Promise<{ ok: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, message: 'Fingerprint is only available in the Android app' };
  }
  try {
    const res = await FingerprintAuth.authenticate();
    return res?.success === true
      ? { ok: true }
      : { ok: false, message: 'Fingerprint authentication was not successful' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
