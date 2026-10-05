import { Capacitor } from '@capacitor/core';

/**
 * Defenxia Centralized Backend & API Environment Configuration
 * 
 * Provides clean separation between Development and Production:
 * - Prevents Android mobile app from attempting to connect to localhost:3000
 * - Resolves production Vercel serverless functions when running inside native Android WebView
 * - Configures correct Google OAuth redirect URIs and deep links
 */

// Fallback production Vercel deployment URL (Aurora)
export const DEFAULT_PRODUCTION_BACKEND_URL = 'https://defenxia-aurora-three.vercel.app';

export const isNativeAndroid = (): boolean => {
  return typeof window !== 'undefined' && 
         Capacitor.isNativePlatform() && 
         Capacitor.getPlatform() === 'android';
};

/**
 * Resolves the backend base URL for API requests (e.g. /api/breach-check, /api/virustotal-scan)
 *
 * CRITICAL RULE (learned 2026-10-01): in a web browser, API calls MUST be
 * same-origin. A build-time baked URL (VITE_BACKEND_URL / VITE_VERCEL_URL) can
 * point at a stale preview deployment — the page loads from production but the
 * API calls go to a dead preview URL, and every module fails with "Failed to
 * fetch" / CORS errors. The env override is therefore honored ONLY inside the
 * native Android WebView, where relative URLs would resolve to localhost.
 */
export const getBackendBaseUrl = (): string => {
  // Native Android Capacitor app: relative paths resolve to http://localhost/
  // inside the WebView, so an absolute production URL is required here.
  if (isNativeAndroid()) {
    const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
    if (envBackendUrl && typeof envBackendUrl === 'string' && envBackendUrl.trim() !== '') {
      const trimmed = envBackendUrl.trim();
      return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    }
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  // Web browser (Vercel production, preview, or custom domain):
  // always talk to the same origin that served this page.
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '') {
      return window.location.origin;
    }
  }

  // Local development fallback (routes through Vite dev proxy)
  return '';
};

/**
 * Resolves the OAuth Redirect URL for Google Sign-In
 * Never points to localhost:3000 in mobile production.
 */
export const getOAuthRedirectUrl = (): string => {
  const customRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (customRedirect && typeof customRedirect === 'string' && customRedirect.trim() !== '') {
    return customRedirect.trim();
  }

  // In Native Android mobile app:
  if (isNativeAndroid()) {
    // Registered Android custom scheme in AndroidManifest.xml
    return 'defenxia://auth/callback';
  }

  // In Web browser (Vercel deployment):
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return window.location.origin;
    }
  }

  // Local dev web fallback:
  return typeof window !== 'undefined' ? window.location.origin : '';
};

/**
 * Builds an absolute API endpoint URL that works reliably across both Web and Android
 */
export const buildApiUrl = (endpointPath: string): string => {
  const base = getBackendBaseUrl();
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
};
