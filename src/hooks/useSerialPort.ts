import { useState, useCallback, useRef, useEffect } from 'react';

export interface SerialMessage {
  text: string;
  type: 'incoming' | 'outgoing' | 'system';
  timestamp: string;
}

interface SerialPortHook {
  isConnected: boolean;
  isSimulating: boolean;
  portInfo: string | null;
  lastMessage: string | null;
  baudRate: number;
  bytesReceived: number;
  logs: SerialMessage[];
  connect: (baud?: number) => Promise<boolean>;
  disconnect: () => Promise<void>;
  startListening: (onMessage: (msg: string) => void) => void;
  stopListening: () => void;
  sendData: (data: string) => Promise<boolean>;
  simulateRFID: (uid?: string, authorized?: boolean) => void;
  toggleSimulation: () => void;
  clearLogs: () => void;
  setBaudRate: (baud: number) => void;
}

export function useSerialPort(): SerialPortHook {
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [portInfo, setPortInfo] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [bytesReceived, setBytesReceived] = useState<number>(0);
  const [logs, setLogs] = useState<SerialMessage[]>([]);
  
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const readingFlagRef = useRef<boolean>(false);
  const listenersRef = useRef<Set<(msg: string) => void>>(new Set());

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
      addLog(`Hardware simulation mode ${next ? 'ENABLED' : 'DISABLED'}`);
      return next;
    });
  }, [addLog]);

  const stopListening = useCallback(() => {
    listenersRef.current.clear();
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    readingFlagRef.current = false;
    
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (err) {}
      try {
        readerRef.current.releaseLock();
      } catch (err) {}
      readerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (err) {}
      portRef.current = null;
    }
    
    setIsConnected(false);
    setPortInfo(null);
    setBytesReceived(0);
    listenersRef.current.clear();
    addLog('USB Serial port disconnected.');
  }, [addLog]);

  // Robust internal read loop that starts IMMEDIATELY upon port opening
  const runReadLoop = useCallback(async (port: any) => {
    readingFlagRef.current = true;
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (readingFlagRef.current && port && port.readable) {
      let reader: any;
      try {
        reader = port.readable.getReader();
        readerRef.current = reader;
      } catch (e: any) {
        console.warn('Cannot acquire serial reader:', e?.message);
        break;
      }

      try {
        while (readingFlagRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            setBytesReceived(prev => prev + value.length);

            const textChunk = decoder.decode(value, { stream: true });
            lineBuffer += textChunk;

            // Broadcast raw text chunk immediately so listeners can catch it
            const trimmedChunk = textChunk.trim();
            if (trimmedChunk) {
              setLastMessage(trimmedChunk);
              listenersRef.current.forEach(fn => {
                try { fn(trimmedChunk); } catch (err) {}
              });
            }

            // Split complete lines
            if (lineBuffer.includes('\n') || lineBuffer.includes('\r')) {
              const lines = lineBuffer.split(/[\r\n]+/);
              lineBuffer = lines.pop() || '';

              for (let line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.length > 0) {
                  setLastMessage(trimmedLine);
                  addLog(trimmedLine, 'incoming');
                  listenersRef.current.forEach(fn => {
                    try { fn(trimmedLine); } catch (err) {}
                  });
                }
              }
            } else if (lineBuffer.length >= 8) {
              // Unbuffered raw hex UID without trailing newline (e.g. 97B4E900)
              const trimmedBuf = lineBuffer.trim();
              setLastMessage(trimmedBuf);
              listenersRef.current.forEach(fn => {
                try { fn(trimmedBuf); } catch (err) {}
              });
            }
          }
        }
      } catch (readErr: any) {
        console.error('Serial read loop error:', readErr);
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {}
        readerRef.current = null;
      }
    }

    readingFlagRef.current = false;
  }, [addLog]);

  const startListening = useCallback((onMessage: (msg: string) => void) => {
    listenersRef.current.add(onMessage);
  }, []);

  const connect = useCallback(async (customBaud?: number): Promise<boolean> => {
    const targetBaud = customBaud || baudRate || 9600;

    if (!('serial' in navigator)) {
      console.warn('Web Serial API not supported in this browser. Simulation mode enabled.');
      setIsSimulating(true);
      setIsConnected(true);
      setPortInfo('Virtual Serial Bridge (Simulation)');
      addLog('Web Serial not supported in this browser. Using Virtual Simulation Bridge.');
      return true;
    }

    try {
      if (isSimulating) {
        setIsConnected(true);
        setPortInfo('Virtual Arduino UNO (Simulated)');
        addLog(`Connected to Virtual Arduino UNO simulator (${targetBaud} baud).`);
        return true;
      }

      addLog(`Requesting USB Serial port for Arduino UNO at ${targetBaud} baud...`);
      const port = await (navigator as any).serial.requestPort();
      
      await port.open({ baudRate: targetBaud, bufferSize: 1024 });
      portRef.current = port;

      // Assert DTR and RTS signals for USB-to-UART bridge
      try {
        if (port.setSignals) {
          await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        }
      } catch (sigErr) {
        console.warn('Could not set DTR/RTS signals:', sigErr);
      }

      setIsConnected(true);
      setBytesReceived(0);

      const info = port.getInfo ? port.getInfo() : {};
      const desc = info.usbVendorId ? `Arduino UNO (VID: 0x${info.usbVendorId.toString(16)})` : 'Arduino UNO USB Serial (COM Port)';
      setPortInfo(desc);
      addLog(`Connected successfully: ${desc} at ${targetBaud} baud.`);

      // IMMEDIATELY launch background read loop so no data is missed
      runReadLoop(port);

      return true;
    } catch (error: any) {
      console.error('Error connecting to serial port:', error);
      addLog(`Serial connection failed: ${error?.message || 'User cancelled or port in use'}`);
      return false;
    }
  }, [baudRate, isSimulating, addLog, runReadLoop]);

  const sendData = useCallback(async (data: string): Promise<boolean> => {
    if (isSimulating) {
      addLog(data, 'outgoing');
      return true;
    }

    if (!portRef.current || !portRef.current.writable) {
      addLog('Cannot send: USB port is not writable.', 'system');
      return false;
    }

    try {
      const textEncoder = new TextEncoder();
      const writer = portRef.current.writable.getWriter();
      await writer.write(textEncoder.encode(data + '\n'));
      writer.releaseLock();
      addLog(data, 'outgoing');
      return true;
    } catch (err: any) {
      console.error('Send error:', err);
      addLog(`Send failed: ${err.message}`, 'system');
      return false;
    }
  }, [isSimulating, addLog]);

  const simulateRFID = useCallback((uid: string = '97:B4:E9:00', authorized: boolean = true) => {
    const cleanUid = uid.trim().toUpperCase();
    const msg = `CARD_UID:${cleanUid}`;
    setLastMessage(msg);
    addLog(`[SIMULATED TAP] -> ${msg}`, 'incoming');
    listenersRef.current.forEach(fn => {
      try { fn(msg); } catch (e) {}
    });
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
    portInfo,
    lastMessage,
    baudRate,
    bytesReceived,
    logs,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendData,
    simulateRFID,
    toggleSimulation,
    clearLogs,
    setBaudRate
  };
}
