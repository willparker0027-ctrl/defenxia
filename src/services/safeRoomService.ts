import { registerPlugin, Capacitor } from '@capacitor/core';

export interface SafeRoomStatus {
  provisioned: boolean;
  canProvision: boolean;
}

export interface SafeRoomPluginInterface {
  getStatus(): Promise<SafeRoomStatus>;
  checkProvision(): Promise<{ allowed: boolean; reason: string }>;
  provision(): Promise<{ provisioned: boolean }>;
  openSafeRoom(): Promise<{ opened: boolean }>;
  wipe(): Promise<{ wiped: boolean }>;
}

const SafeRoom = registerPlugin<SafeRoomPluginInterface>('SafeRoom');

export const isSafeRoomNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const safeRoomService = {
  isAvailable: isSafeRoomNative,

  async getStatus(): Promise<SafeRoomStatus> {
    if (!isSafeRoomNative()) return { provisioned: false, canProvision: false };
    try {
      return await SafeRoom.getStatus();
    } catch {
      return { provisioned: false, canProvision: false };
    }
  },

  async checkProvision(): Promise<{ allowed: boolean; reason: string }> {
    if (!isSafeRoomNative()) return { allowed: false, reason: "not_android" };
    try {
      return await SafeRoom.checkProvision();
    } catch {
      return { allowed: false, reason: "unknown" };
    }
  },

  async provision(): Promise<boolean> {
    if (!isSafeRoomNative()) return false;
    const r = await SafeRoom.provision();
    return !!r.provisioned;
  },

  async open(): Promise<boolean> {
    if (!isSafeRoomNative()) return false;
    try {
      const r = await SafeRoom.openSafeRoom();
      return !!r.opened;
    } catch {
      return false;
    }
  },

  async wipe(): Promise<boolean> {
    if (!isSafeRoomNative()) return false;
    try {
      const r = await SafeRoom.wipe();
      return !!r.wiped;
    } catch {
      return false;
    }
  },
};
