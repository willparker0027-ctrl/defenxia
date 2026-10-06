/**
 * Gemini Live API realtime voice client using the official @google/genai SDK.
 *
 * Why SDK instead of raw WebSocket: the raw WebSocket was silently hanging
 * (server never responded to setup). The SDK handles all wire details.
 * Based on Google Cloud's official "Build a real-time voice AI agent" video
 * and the live-dj reference implementation.
 *
 * Model: gemini-3.8-live (Stable, Google's recommended Live model since Sept 2026;
 * gemini-3.1-flash-live-preview is now legacy preview with more restrictive limits)
 * Voice: Aoede (feminine prebuilt voice)
 */

import { GoogleGenAI } from "@google/genai";

export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const GEMINI_VOICE = "Aoede";

export type VoiceConnState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceCallbacks {
  onState: (s: VoiceConnState) => void;
  onUserText: (text: string) => void;
  onAssistantText: (text: string) => void;
  onMicLevel: (level: number) => void;
  onSpeakerLevel: (level: number) => void;
  onError: (message: string) => void;
}

/* ---------------- audio helpers ---------------- */

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const v = Math.max(-1, Math.min(1, float32[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

function downsampleTo16k(input: Float32Array, inRate: number): Float32Array {
  if (inRate === 16000) return input;
  const ratio = inRate / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = input[Math.floor(i * ratio)];
  }
  return out;
}

function rmsLevel(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, rms * 4);
}

/* ---------------- session ---------------- */

export class GeminiVoiceSession {
  private session: unknown = null;
  private cb: VoiceCallbacks;
  private state: VoiceConnState = "idle";
  private intentionalClose = false;

  private audioCtx: AudioContext | null = null;
  // Dedicated context for AI voice playback — independent from the mic, so the
  // AI can still be heard even if microphone init fails or is delayed.
  private playbackCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private micOn = true;
  private setupDone = false;

  private playQueue: AudioBuffer[] = [];
  private playing = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private speakerRaf = 0;
  private analyserData: Uint8Array | null = null;

  constructor(cb: VoiceCallbacks) {
    this.cb = cb;
  }

  private setState(s: VoiceConnState) {
    this.state = s;
    this.cb.onState(s);
  }

  getState(): VoiceConnState {
    return this.state;
  }

  async connect(apiKey: string): Promise<void> {
    this.intentionalClose = false;
    this.setState("connecting");
    // Prepare the AI-voice playback context early (independent of the mic).
    this.ensurePlaybackCtx();

    return new Promise((resolve, reject) => {
      let ai: GoogleGenAI;
      try {
        ai = new GoogleGenAI({ apiKey });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        this.fail(`Could not initialize voice client: ${detail}`);
        reject(e);
        return;
      }

      const openTimer = window.setTimeout(() => {
        if (!this.setupDone) {
          this.fail("No response from the server (timeout). Please tap Retry.");
          reject(new Error("timeout"));
        }
      }, 30000);

      const onSetupDone = () => {
        window.clearTimeout(openTimer);
        this.setupDone = true;
        this.setState("listening");
        this.startMic();
        resolve();
      };

      ai.live
        .connect({
          model: GEMINI_LIVE_MODEL,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: GEMINI_VOICE },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: "You are DEFENXIA Voice, the friendly voice assistant inside the DEFENXIA cyber-safety app.\n\nIDENTITY: You are DEFENXIA Voice — the voice assistant built into the DEFENXIA app. NEVER reveal, mention or hint that you are a Gemini model or made by Google. If asked who you are or what model you are, simply say you are DEFENXIA Voice, the assistant inside the DEFENXIA app. Never discuss your underlying AI model, training, or technology provider.\n\nPRONUNCIATION: Always say the word DEFENXIA as ONE smooth flowing word: \u2018deh-FENK-see-ah\u2019. Never split it into two parts like \u2018defe\u2019 + \u2018nexia\u2019. It must sound like a single word every time.\n\nPERSONA: You are female. In Hindi (and Hinglish), ALWAYS use feminine verb forms when referring to yourself — e.g. 'main jaa rahi thi', 'main kha rahi hoon', 'main kar rahi hoon', 'main samjha rahi hoon'. Never use masculine forms like 'raha tha / raha hoon' for yourself.\n\nWHAT DEFENXIA IS: DEFENXIA is a cyber-safety app that protects the user's phone and online life from scams, fraud, malware, data breaches and unsafe networks. Learn these protection modules and refer the user to the EXACT one for their problem:\n1. Secure Banking — open a safer banking session\n2. AI And SMS Shield — checks suspicious SMS and messages for scam signs\n3. Scan QR Code — inspects where a QR code leads before opening it\n4. WiFi Security — checks whether a WiFi network is safe\n5. Scan Website — inspects risky links and websites\n6. Data Breach — checks if the user's email or phone data was exposed in breaches\n7. App Permissions — reviews what access installed apps have\n8. Scan Files — detects malware in files\n9. IP Security Check — verifies the user's IP safety\n10. Cyber News — latest threat alerts\n11. Cyber Help — help guides for scam situations\n12. Anti Scam Kill Switch — blocks screen-sharing apps like AnyDesk during scam calls\n13. Cyber Sanchaar Shield — call protection, warns against sharing PIN or OTP on calls\n14. OTP Security — protects one-time passwords\n15. Safe Room — runs suspicious APKs in isolation\n16. Firewall — controls network traffic\n17. Antivirus — deep system scan\n18. Report & Analysis — AI threat report\n19. AI Analysis — AI security analysis\n\nYOUR JOB AS A GUIDE: When the user describes a problem (e.g. 'I got a strange SMS', 'someone is asking for my OTP on a call', 'is this WiFi safe?'), first help them understand the risk in simple words, then name the EXACT DEFENXIA module that solves it and tell them to open it from the home screen, e.g. 'That sounds like a phishing SMS — open AI And SMS Shield from the home screen and paste the message there.'\n\nIMPORTANT: always reply in the SAME language the user is speaking. You are fluent in every language — English, Hindi, Hinglish, and all others. If the user speaks Hindi, reply in Hindi; if English, reply in English; if a mix, reply in the same mix. Keep EVERY reply short (1 to 3 short sentences) because this is a voice conversation. Be warm, never lecture.\n\nPERSONAL KNOWLEDGE: If the user asks who is Thakur, Tanuj Thakur or Tanuj \u2014 answer that Tanuj Thakur is a friend of Sajjad, and they used to play Free Fire together every day. Keep it warm and brief. Also, if anyone asks who developed, made or created DEFENXIA \u2014 answer that Sajjad is the developer of DEFENXIA.",
                },
              ],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              // SDK connected — setup is sent automatically.
              // setupComplete will arrive via onmessage.
            },
            onmessage: (response: unknown) => {
              try {
                this.handleMessage(response as Record<string, unknown>, onSetupDone);
              } catch {
                /* ignore malformed */
              }
            },
            onerror: (e: unknown) => {
              window.clearTimeout(openTimer);
              if (!this.intentionalClose && !this.setupDone) {
                const detail = e instanceof Error ? e.message : String(e);
                this.fail(`Connection failed: ${detail}. Tap Retry.`);
                reject(new Error("sdk error"));
              }
            },
            onclose: (e: CloseEvent) => {
              window.clearTimeout(openTimer);
              this.stopMic();
              if (!this.intentionalClose && this.state !== "error") {
                // Surface the REAL close code/reason (e.g. 1011 "You exceeded
                // your current quota") instead of a generic message, so the
                // actual cause of the drop is visible for diagnosis.
                const code = typeof e?.code === "number" ? e.code : 0;
                const reason =
                  typeof e?.reason === "string" && e.reason ? e.reason : "";
                const detail = reason
                  ? ` (code ${code}): ${reason}`
                  : ` (code ${code})`;
                this.fail(`Connection lost${detail}. Tap Retry.`);
                reject(new Error(`sdk closed${detail}`));
              }
            },
          },
        })
        .then((sess) => {
          this.session = sess;
        })
        .catch((e) => {
          window.clearTimeout(openTimer);
          const detail = e instanceof Error ? e.message : String(e);
          this.fail(`Could not open the voice connection: ${detail}`);
          reject(e);
        });
    });
  }

  private handleMessage(msg: Record<string, unknown>, onSetupDone: () => void) {
    // SDK wraps raw frames; setupComplete may come as a top-level field
    // or inside the response. Check both.
    if ("setupComplete" in msg) {
      if (!this.setupDone) onSetupDone();
      return;
    }

    const sc = (msg["serverContent"] ?? msg["server_content"]) as
      | Record<string, unknown>
      | undefined;
    if (!sc) {
      // Some SDK versions emit setupComplete differently — treat any
      // first server message without error as a sign of life.
      return;
    }

    // --- transcripts ---
    const inT = (sc["inputTranscription"] ?? sc["input_transcription"]) as
      | { text?: string }
      | undefined;
    if (inT?.text) this.cb.onUserText(inT.text);
    const outT = (sc["outputTranscription"] ?? sc["output_transcription"]) as
      | { text?: string }
      | undefined;
    if (outT?.text) this.cb.onAssistantText(outT.text);

    // --- model audio ---
    const turn = (sc["modelTurn"] ?? sc["model_turn"]) as
      | { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] }
      | undefined;
    const parts = turn?.parts ?? [];
    let gotAudio = false;
    for (const p of parts) {
      const d = p?.inlineData?.data ?? p?.inline_data?.data;
      if (d) {
        gotAudio = true;
        this.enqueueAudio(d);
      }
    }
    if (gotAudio && this.state !== "speaking") this.setState("speaking");

    // --- turn signals ---
    if (sc["interrupted"] === true) {
      this.stopPlayback();
      if (this.state !== "error") this.setState("listening");
    } else if (sc["turnComplete"] === true || sc["turn_complete"] === true) {
      if (this.state !== "error") this.setState("listening");
    } else if (!gotAudio && parts.length > 0 && this.state === "listening") {
      this.setState("thinking");
    }
  }

  /* ---------------- mic ---------------- */

  private async startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.micStream = stream;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AC();
      const ctx = this.audioCtx;
      if (ctx.state === "suspended") await ctx.resume();

      this.micSource = ctx.createMediaStreamSource(stream);
      this.processor = ctx.createScriptProcessor(4096, 1, 1);
      const inRate = ctx.sampleRate;

      this.processor.onaudioprocess = (e) => {
        if (!this.micOn || !this.session || !this.setupDone) return;
        const input = e.inputBuffer.getChannelData(0);
        this.cb.onMicLevel(rmsLevel(input));
        const down = downsampleTo16k(input, inRate);
        const pcm = floatTo16BitPCM(down);
        const b64 = bytesToBase64(new Uint8Array(pcm.buffer));
        try {
          (this.session as {
            sendRealtimeInput: (arg: unknown) => void;
          }).sendRealtimeInput({
            audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
          });
        } catch {
          /* noop */
        }
      };

      this.micSource.connect(this.processor);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      this.processor.connect(sink);
      sink.connect(ctx.destination);
    } catch {
      this.fail("Microphone permission was denied");
    }
  }

  setMicOn(on: boolean) {
    this.micOn = on;
    if (!on) this.cb.onMicLevel(0);
  }

  isMicOn(): boolean {
    return this.micOn;
  }

  private stopMic() {
    try {
      this.processor?.disconnect();
    } catch {
      /* noop */
    }
    try {
      this.micSource?.disconnect();
    } catch {
      /* noop */
    }
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.processor = null;
    this.micSource = null;
    this.micStream = null;
  }

  /* ---------------- playback ---------------- */

  /** Ensure the AI-voice playback context exists and is running. */
  private ensurePlaybackCtx(): AudioContext | null {
    try {
      if (!this.playbackCtx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.playbackCtx = new AC();
      }
      if (this.playbackCtx.state === "suspended") {
        this.playbackCtx.resume().catch(() => {});
      }
      return this.playbackCtx;
    } catch {
      return null;
    }
  }

  /** Public: try to un-suspend audio (call from user-gesture handlers). */
  resumeAudio() {
    this.ensurePlaybackCtx();
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private enqueueAudio(b64: string) {
    const ctx = this.ensurePlaybackCtx();
    if (!ctx) return;
    try {
      const bytes = base64ToBytes(b64);
      const pcm = new Int16Array(bytes.buffer);
      const buf = ctx.createBuffer(1, pcm.length, 24000);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
      this.playQueue.push(buf);
      if (!this.playing) this.playNext();
    } catch {
      /* noop */
    }
  }

  private playNext() {
    const ctx = this.playbackCtx;
    const buf = this.playQueue.shift();
    if (!ctx || !buf) {
      this.playing = false;
      this.cb.onSpeakerLevel(0);
      return;
    }
    this.playing = true;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyserData = new Uint8Array(this.analyser.fftSize);
    src.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    this.currentSource = src;
    src.onended = () => {
      if (this.currentSource === src) {
        this.currentSource = null;
        this.playNext();
      }
    };
    src.start();
    this.pumpSpeakerLevel();
  }

  private pumpSpeakerLevel() {
    cancelAnimationFrame(this.speakerRaf);
    const tick = () => {
      if (!this.analyser || !this.analyserData || !this.playing) {
        this.cb.onSpeakerLevel(0);
        return;
      }
      this.analyser.getByteTimeDomainData(this.analyserData);
      let sum = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        const v = (this.analyserData[i] - 128) / 128;
        sum += v * v;
      }
      this.cb.onSpeakerLevel(Math.min(1, Math.sqrt(sum / this.analyserData.length) * 5));
      this.speakerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  private stopPlayback() {
    this.playQueue = [];
    try {
      this.currentSource?.stop();
    } catch {
      /* noop */
    }
    this.currentSource = null;
    this.playing = false;
    cancelAnimationFrame(this.speakerRaf);
    this.cb.onSpeakerLevel(0);
  }

  /* ---------------- text + teardown ---------------- */

  /** Stop the AI's current speech (pause button). Session stays connected. */
  stopSpeaking() {
    this.stopPlayback();
    if (this.state === "speaking") this.setState("listening");
  }

  sendText(text: string) {
    if (!this.session || !this.setupDone) return;
    this.setState("thinking");
    try {
      (this.session as {
        sendRealtimeInput: (arg: unknown) => void;
      }).sendRealtimeInput({ text });
    } catch {
      /* noop */
    }
  }

  private fail(message: string) {
    this.setState("error");
    this.cb.onError(message);
  }

  disconnect() {
    this.intentionalClose = true;
    this.stopPlayback();
    this.stopMic();
    try {
      (this.session as { close?: () => void })?.close?.();
    } catch {
      /* noop */
    }
    this.session = null;
    this.setupDone = false;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
    cancelAnimationFrame(this.speakerRaf);
    this.setState("idle");
  }
}
