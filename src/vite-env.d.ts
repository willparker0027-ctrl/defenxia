/// <reference types="vite/client" />

/**
 * Preload API exposed by the DEFENXIA Electron shell on Windows.
 * Only present when the web app runs inside the desktop app
 * (`window.defenxia.isDesktop === true`). The Capacitor/Android path
 * never sees this object.
 */
interface DefenxiaDesktopWindowApi {
  isDesktop: boolean;
  window: {
    minimize(): void;
    maximize(): void;
    close(): void;
    isMaxed(): Promise<boolean>;
  };
  /** Generic IPC invoke exposed by the preload script. */
  invoke(channel: string, args?: any): Promise<any>;
  /** NFC card-tap events forwarded from the main process. Returns an unsubscribe fn. */
  onCardDetected(cb: (event: { uid: string; reader: string }) => void): () => void;
  /** Fired when the lock overlay should hide (card/PIN unlock succeeded). */
  onOverlayHide(cb: () => void): () => void;
  /** Start phone-tap pairing; resolves with the 6-digit code shown on the overlay. */
  phonePairStart(): Promise<any>;
  /** Cancel an in-progress phone pairing. */
  phonePairCancel(): Promise<any>;
  /** Pairing status events from the main process. Returns an unsubscribe fn. */
  onPhoneStatus(cb: (status: { state: string; code?: string; reason?: string }) => void): () => void;
}

interface Window {
  defenxia?: DefenxiaDesktopWindowApi;
}
