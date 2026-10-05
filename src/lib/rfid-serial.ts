// USB Serial (Web Serial API) bridge to the Arduino UNO + RC522 RFID reader.
// NO Bluetooth is used — the laptop talks to the Arduino over the USB cable.
//
// Expected Arduino sketch output (one line per event):
//   AUTHORIZED:A1B2C3D4
//   DENIED:99887766
// A bare "AUTHORIZED" / "DENIED" line is also accepted.

export type RfidVerdict = "AUTHORIZED" | "DENIED";

export interface RfidEvent {
  verdict: RfidVerdict;
  uid?: string;
}

export const isSerialSupported = () =>
  typeof navigator !== "undefined" && "serial" in navigator;

export class RfidSerialReader {
  private port: any = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private buffer = "";
  private stopped = false;

  async connect(baudRate = 9600): Promise<void> {
    if (!isSerialSupported()) {
      throw new Error(
        "Web Serial is not supported in this browser. Use Chrome or Edge on desktop to connect the Arduino."
      );
    }
    // @ts-ignore - Web Serial types are not in the default lib
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate });
    this.stopped = false;
  }

  /** Streams RFID verdicts from the Arduino until stop() is called. */
  async listen(onEvent: (event: RfidEvent) => void): Promise<void> {
    if (!this.port) throw new Error("Serial port not connected");

    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable).catch(() => {});
    this.reader = decoder.readable.getReader();

    while (!this.stopped) {
      const { value, done } = await this.reader.read();
      if (done) break;
      if (!value) continue;
      this.buffer += value;

      let newlineIndex: number;
      while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);
        const parsed = parseRfidLine(line);
        if (parsed) onEvent(parsed);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.reader = null;
    this.port = null;
  }
}

export function parseRfidLine(line: string): RfidEvent | null {
  const upper = line.toUpperCase();
  if (upper.startsWith("AUTHORIZED")) {
    return { verdict: "AUTHORIZED", uid: line.split(":")[1]?.trim() };
  }
  if (upper.startsWith("DENIED")) {
    return { verdict: "DENIED", uid: line.split(":")[1]?.trim() };
  }
  return null;
}
