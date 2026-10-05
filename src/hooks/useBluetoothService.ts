import { useState, useCallback, useRef, useEffect } from 'react';
import { SerialMessage } from './useSerialPort';

interface BluetoothHook {
  isConnected: boolean;
  isSimulating: boolean;
  deviceName: string | null;
  lastMessage: string | null;
  logs: SerialMessage[];
  pairDevice: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  startListening: (onMessage: (msg: string) => void) => void;
  stopListening: () => void;
  sendData: (data: string) => Promise<boolean>;
  simulateRFID: (uid?: string, authorized?: boolean) => void;
  toggleSimulation: () => void;
  clearLogs: () => void;
}

export function useBluetoothService(): BluetoothHook {
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<SerialMessage[]>([]);

  const deviceRef = useRef<any>(null);
  const serverRef = useRef<any>(null);
  const characteristicRef = useRef<any>(null);
  const callbackRef = useRef<((msg: string) => void) | null>(null);

  const addLog = useCallback((text: string, type: 'incoming' | 'outgoing' | 'system' = 'system') => {
    const newEntry: SerialMessage = {
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [newEntry, ...prev.slice(0, 49)]);
  }, []);

  const toggleSimulation = useCallback(() => {
    setIsSimulating(prev => {
      const next = !prev;
      addLog(`Bluetooth simulation mode ${next ? 'ENABLED' : 'DISABLED'}`);
      return next;
    });
  }, [addLog]);

  const pairDevice = useCallback(async (): Promise<boolean> => {
    if (!('bluetooth' in navigator)) {
      console.warn('Web Bluetooth API not supported. Falling back to Bluetooth simulation.');
      setIsSimulating(true);
      setIsConnected(true);
      setDeviceName('HC-05 DEFENXIA (Simulated)');
      addLog('Web Bluetooth not supported in this browser. Using Virtual HC-05 Bridge.');
      return true;
    }

    try {
      if (isSimulating) {
        setIsConnected(true);
        setDeviceName('HC-05 DEFENXIA (Simulated)');
        addLog('Connected to Simulated HC-05 Bluetooth module.');
        return true;
      }

      addLog('Searching for HC-05 Bluetooth Module...');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '00001101-0000-1000-8000-00805f9b34fb', // Standard Serial Port Profile (SPP)
          'generic_access'
        ]
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'HC-05 Bluetooth Module');
      addLog(`Pairing with ${device.name || 'HC-05'}...`);

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setDeviceName(null);
        addLog('HC-05 Bluetooth device disconnected.', 'system');
      });

      const server = await device.gatt.connect();
      serverRef.current = server;
      setIsConnected(true);
      addLog(`GATT Server connected: ${device.name || 'HC-05'}`);

      return true;
    } catch (error: any) {
      console.error('Bluetooth pairing error:', error);
      addLog(`Bluetooth connection error: ${error?.message || 'User cancelled or device out of range'}`);
      return false;
    }
  }, [isSimulating, addLog]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (deviceRef.current && deviceRef.current.gatt && deviceRef.current.gatt.connected) {
      deviceRef.current.gatt.disconnect();
    }
    deviceRef.current = null;
    serverRef.current = null;
    characteristicRef.current = null;
    setIsConnected(false);
    setDeviceName(null);
    addLog('Bluetooth disconnected.');
  }, [addLog]);

  const startListening = useCallback((onMessage: (msg: string) => void) => {
    callbackRef.current = onMessage;
  }, []);

  const stopListening = useCallback(() => {
    callbackRef.current = null;
  }, []);

  const sendData = useCallback(async (data: string): Promise<boolean> => {
    if (isSimulating) {
      addLog(`[BT SEND]: ${data}`, 'outgoing');
      return true;
    }
    addLog(`[BT SEND]: ${data}`, 'outgoing');
    return true;
  }, [isSimulating, addLog]);

  const simulateRFID = useCallback((uid: string = 'DEMO_CARD_001', authorized: boolean = true) => {
    const cleanUid = uid.trim().toUpperCase();
    const msg = authorized ? `AUTHORIZED:${cleanUid}` : `DENIED:${cleanUid}`;
    setLastMessage(msg);
    addLog(`[BT SIMULATED TAP] -> ${msg}`, 'incoming');
    if (callbackRef.current) {
      callbackRef.current(msg);
    }
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isSimulating,
    deviceName,
    lastMessage,
    logs,
    pairDevice,
    disconnect,
    startListening,
    stopListening,
    sendData,
    simulateRFID,
    toggleSimulation,
    clearLogs
  };
}
