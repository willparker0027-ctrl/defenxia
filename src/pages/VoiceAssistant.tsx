import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Send, RotateCcw, Pause, X } from "lucide-react";
import WaveformCanvas from "@/components/WaveformCanvas";
import { GeminiVoiceSession, type VoiceConnState } from "@/lib/gemini-voice";
import { getGeminiApiKey, getGeminiKeyError, clearGeminiKeyCache } from "@/lib/voice-config";

type Msg = { role: "user" | "ai"; text: string };

const STATUS_TEXT: Record<VoiceConnState, string> = {
  idle: "Ready",
  connecting: "Connecting…",
  listening: "Listening… speak now",
  thinking: "Thinking…",
  speaking: "Speaking… tap pause to stop",
  error: "Something went wrong",
};

/**
 * Smart append for streaming transcription.
 * The Live API may send cumulative text (each chunk = full text so far)
 * or deltas (each chunk = new words only). Handle both so the paragraph
 * builds up smoothly instead of flickering word-by-word.
 */
function mergeTranscript(oldText: string, newChunk: string): string {
  if (!oldText) return newChunk;
  if (!newChunk) return oldText;
  if (newChunk.startsWith(oldText)) return newChunk; // cumulative
  if (oldText.endsWith(newChunk)) return oldText; // duplicate chunk
  // delta — append with a space if needed
  const needsSpace = !/\s$/.test(oldText) && !/^\s/.test(newChunk);
  return oldText + (needsSpace ? " " : "") + newChunk;
}

export default function VoiceAssistant() {
  const navigate = useNavigate();
  const [conn, setConn] = useState<VoiceConnState>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<GeminiVoiceSession | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastLevelAt = useRef(0);
  // When the last user-transcription chunk arrived. Used to tell a *late chunk*
  // of the current question apart from a *new* question (new turn).
  const lastUserChunkAt = useRef(0);
  const LATE_CHUNK_WINDOW_MS = 3000;

  // AI text: accumulate into a single growing paragraph per turn.
  const pushAiText = useCallback((chunk: string) => {
    setMsgs((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "ai") {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", text: mergeTranscript(last.text, chunk) };
        return next;
      }
      return [...prev, { role: "ai", text: chunk }];
    });
  }, []);

  // User text: keep strict You -> AI -> You -> AI turn order.
  // A chunk that arrives within a few seconds of the previous user chunk is a
  // *late piece of the same question* — merge it into that question (even if
  // the AI already started replying). Anything later is a *new turn* and goes
  // after the AI's message. Typed questions always start a new turn.
  const pushUserText = useCallback((chunk: string, forceNewTurn = false) => {
    const now = Date.now();
    const isLateChunk =
      !forceNewTurn && now - lastUserChunkAt.current < LATE_CHUNK_WINDOW_MS;
    lastUserChunkAt.current = now;
    setMsgs((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "user") {
        // Still dictating the same question — keep building it.
        const next = [...prev];
        next[next.length - 1] = { role: "user", text: mergeTranscript(last.text, chunk) };
        return next;
      }
      if (last && last.role === "ai") {
        const prevMsg = prev[prev.length - 2];
        if (isLateChunk && prevMsg && prevMsg.role === "user") {
          // Late piece of the question the AI is answering — merge it there.
          const next = [...prev];
          next[next.length - 2] = {
            role: "user",
            text: mergeTranscript(prevMsg.text, chunk),
          };
          return next;
        }
        // New turn — the question goes after the AI's reply.
        return [...prev, { role: "user", text: chunk }];
      }
      return [...prev, { role: "user", text: chunk }];
    });
  }, []);

  const startSession = useCallback(async () => {
    setError(null);
    setConn("connecting");
    const key = await getGeminiApiKey();
    if (!key) {
      const detail = getGeminiKeyError();
      setError(
        "Voice key not found. Please check the app_config table in Supabase." +
          (detail ? ` (${detail})` : "")
      );
      setConn("error");
      return;
    }
    const session = new GeminiVoiceSession({
      onState: (s) => setConn(s),
      onUserText: (t) => pushUserText(t),
      onAssistantText: (t) => pushAiText(t),
      onMicLevel: (l) => {
        const now = performance.now();
        if (now - lastLevelAt.current > 66) {
          lastLevelAt.current = now;
          setMicLevel(l);
        }
      },
      onSpeakerLevel: (l) => {
        const now = performance.now();
        if (now - lastLevelAt.current > 66) {
          lastLevelAt.current = now;
          setSpeakerLevel(l);
        }
      },
      onError: (m) => {
        setError(m);
      },
    });
    sessionRef.current = session;
    try {
      await session.connect(key);
    } catch {
      /* onError already handled */
    }
  }, [pushUserText, pushAiText]);

  useEffect(() => {
    startSession();
    return () => {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, [startSession]);

  // Auto-scroll the transcript panel as the conversation grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const toggleMic = () => {
    const s = sessionRef.current;
    if (!s) return;
    s.resumeAudio(); // user gesture — make sure audio contexts are running
    const next = !micOn;
    s.setMicOn(next);
    setMicOn(next);
    if (!next) setMicLevel(0);
  };

  const stopAiSpeech = () => {
    sessionRef.current?.stopSpeaking();
  };

  const sendText = () => {
    const text = input.trim();
    const s = sessionRef.current;
    if (!text || !s) return;
    // Typed questions also go into the transcript panel (not a separate list).
    // They always start a new turn.
    pushUserText(text, true);
    s.sendText(text);
    setInput("");
  };

  const speaking = conn === "speaking";
  const listening = conn === "listening" || conn === "thinking";

  return (
    <div className="tpage animate-fade-in" style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <span className="eyebrow" style={{ marginBottom: 2 }}>DEFENXIA VOICE</span>
          <div style={{ fontWeight: 700, fontSize: 18 }}>AI Assistant</div>
        </div>
        <span
          className="chip"
          style={{
            color: conn === "error" ? "#ff6b6b" : conn === "listening" ? "#7ee2a8" : "var(--muted)",
            borderColor: "var(--edge-soft)",
          }}
        >
          <span
            className="dot"
            style={{
              background: conn === "error" ? "#ff6b6b" : conn === "listening" ? "#7ee2a8" : "#a06bfa",
              boxShadow: `0 0 10px currentColor`,
            }}
          />
          {conn === "listening" ? "LIVE" : conn.toUpperCase()}
        </span>
      </div>

      {/* voice card — transcript panel + waveform */}
      <div
        className="glass"
        style={{
          position: "relative",
          borderRadius: 28,
          padding: "20px 20px 24px",
          background:
            "linear-gradient(160deg, rgba(20,12,40,0.92) 0%, rgba(8,6,18,0.96) 55%, rgba(10,8,24,0.94) 100%)",
          border: "1px solid rgba(139,61,240,0.22)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.55), 0 0 44px rgba(139,61,240,0.10)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* close */}
        <button
          type="button"
          aria-label="Close voice assistant"
          onClick={() => navigate(-1)}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid var(--edge-soft)",
            background: "rgba(255,255,255,0.06)",
            color: "var(--muted)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>

        {/* transcript panel — single, scrollable, auto-scrolling conversation */}
        <div
          ref={transcriptRef}
          style={{
            minHeight: 170,
            maxHeight: 300,
            overflowY: "auto",
            paddingRight: 44,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            scrollbarWidth: "thin",
          }}
        >
          {msgs.length === 0 && (
            <div style={{ color: "var(--faint)", fontSize: 14.5, lineHeight: 1.6 }}>
              {conn === "connecting"
                ? "Connecting to DEFENXIA voice…"
                : "Tap the mic and just start talking — I am listening."}
            </div>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--ink)",
                overflowWrap: "break-word",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: m.role === "user" ? "var(--magenta)" : "var(--violet)",
                  marginRight: 8,
                }}
              >
                {m.role === "user" ? "You" : "AI"} ·
              </span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>

        {/* waveform */}
        <div style={{ height: 120, margin: "8px -6px 0" }}>
          <WaveformCanvas
            micLevel={micLevel}
            speakerLevel={speakerLevel}
            speaking={speaking}
            listening={listening}
          />
        </div>
        <div style={{ textAlign: "center", marginTop: 2, color: "var(--muted)", fontSize: 13, minHeight: 18 }}>
          {STATUS_TEXT[conn]}
        </div>

        {/* controls: mic + pause AI */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 12 }}>
          <button
            type="button"
            aria-label={micOn ? "Turn the mic off" : "Turn the mic on"}
            onClick={toggleMic}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              background: micOn
                ? "linear-gradient(135deg,#e8357b,#8b3df0)"
                : "rgba(255,255,255,0.08)",
              boxShadow: micOn
                ? "0 0 26px rgba(232,53,123,0.55), 0 0 44px rgba(139,61,240,0.30)"
                : "none",
              color: "#fff",
            }}
          >
            {micOn ? <Mic style={{ width: 26, height: 26 }} /> : <MicOff style={{ width: 26, height: 26 }} />}
          </button>

          {speaking && (
            <button
              type="button"
              aria-label="Pause the AI's speech"
              onClick={stopAiSpeech}
              className="glass"
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "var(--lav)",
                border: "1px solid rgba(139,61,240,0.35)",
              }}
            >
              <Pause style={{ width: 22, height: 22 }} />
            </button>
          )}
        </div>
      </div>

      {/* error card */}
      {error && (
        <div className="glass tcard danger" style={{ marginTop: 12, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, fontSize: 14 }}>{error}</div>
          <button
            type="button"
            className="cta"
            style={{ padding: "10px 16px", fontSize: 14 }}
            onClick={() => {
              sessionRef.current?.disconnect();
              clearGeminiKeyCache();
              setError(null);
              startSession();
            }}
          >
            <RotateCcw style={{ width: 16, height: 16 }} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* input bar — typed questions go to the transcript panel above */}
      <div
        className="glass"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 28,
          marginTop: 12,
          marginBottom: 24,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendText();
          }}
          placeholder="You can also type your question…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--ink)",
            fontSize: 15,
            paddingLeft: 8,
          }}
        />
        <button
          type="button"
          aria-label="Send"
          onClick={sendText}
          className="cta"
          style={{ width: 48, height: 48, borderRadius: "50%", padding: 0, display: "grid", placeItems: "center", flexShrink: 0 }}
        >
          <Send style={{ width: 20, height: 20 }} />
        </button>
      </div>
    </div>
  );
}
