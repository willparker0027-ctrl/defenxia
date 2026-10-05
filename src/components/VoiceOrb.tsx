import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceOrbProps {
  size?: number;
  state?: OrbState;
  micLevel?: number; // 0..1 — user voice loudness
  speakerLevel?: number; // 0..1 — AI voice loudness
  onTap?: () => void;
  float?: boolean;
}

/**
 * DEFENXIA voice orb — canvas-rendered cute 3D sphere.
 * Purple/violet neon theme, blinking eyes, floating idle motion,
 * wavy rings while listening, mouth animation while speaking.
 */
export default function VoiceOrb({
  size = 84,
  state = "idle",
  micLevel = 0,
  speakerLevel = 0,
  onTap,
  float = true,
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, micLevel, speakerLevel, float });
  live.current = { state, micLevel, speakerLevel, float };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = size;
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    canvas.style.width = `${S}px`;
    canvas.style.height = `${S}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const start = performance.now();
    let nextBlink = start + 2200 + Math.random() * 1500;
    let blinkUntil = 0;

    const sparkles = Array.from({ length: 5 }, (_, i) => ({
      angle: (i / 5) * Math.PI * 2,
      radiusJitter: Math.random() * 6,
      speed: 0.25 + Math.random() * 0.35,
      size: 1.2 + Math.random() * 1.6,
    }));

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const { state: st, micLevel: ml, speakerLevel: sl, float: fl } = live.current;
      const cx = S / 2;
      const cy = S / 2 + (fl ? Math.sin(t * 1.4) * S * 0.045 : 0);
      const R = S * 0.34;

      // blink timing
      if (now > nextBlink) {
        blinkUntil = now + 150;
        nextBlink = now + 2400 + Math.random() * 2200;
      }
      const blinking = now < blinkUntil;
      // smooth lid: quick close
      const lid = blinking ? 0.12 : 1;

      ctx.clearRect(0, 0, S, S);

      /* ---- outer glow ---- */
      const glowR = R * (st === "idle" ? 1.55 + Math.sin(t * 2) * 0.06 : 1.7 + ml * 0.25 + sl * 0.2);
      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, glowR);
      const glowColor = st === "speaking" ? "168,85,247" : st === "listening" ? "192,132,252" : "139,92,246";
      glow.addColorStop(0, `rgba(${glowColor},0.45)`);
      glow.addColorStop(1, `rgba(${glowColor},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      /* ---- wavy rings while listening ---- */
      if (st === "listening") {
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.75 + i / 3) % 1;
          const baseR = R * (1.18 + p * 1.0);
          const amp = 2.5 + ml * 11;
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
            const rr = baseR + Math.sin(a * 6 + t * 11 + i * 2.1) * amp;
            const x = cx + Math.cos(a) * rr;
            const y = cy + Math.sin(a) * rr;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(196,132,252,${(1 - p) * (0.28 + ml * 0.5)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      /* ---- speaking pulse ring ---- */
      if (st === "speaking") {
        const p = (t * 1.4) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.2 + p * 0.55 + sl * 0.25), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(216,180,254,${(1 - p) * 0.55})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      /* ---- sphere body (3D shading) ---- */
      const pulse = st === "listening" ? 1 + ml * 0.07 : st === "speaking" ? 1 + sl * 0.05 : 1;
      const r = R * pulse;
      const body = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.1, cx, cy, r);
      body.addColorStop(0, "#d9b8ff");
      body.addColorStop(0.35, "#a06bfa");
      body.addColorStop(0.7, "#6d28d9");
      body.addColorStop(1, "#2a1060");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // inner energy swirl
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgba(233,213,255,0.20)";
      ctx.lineWidth = r * 0.09;
      for (let i = 0; i < 2; i++) {
        const a0 = t * (0.9 + i * 0.4) + i * 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.55 + i * 0.2), a0, a0 + 2.1);
        ctx.stroke();
      }
      // specular highlight
      const hl = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.48, 0, cx - r * 0.42, cy - r * 0.48, r * 0.5);
      hl.addColorStop(0, "rgba(255,255,255,0.75)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.4, cy - r * 0.46, r * 0.42, r * 0.3, -0.6, 0, Math.PI * 2);
      ctx.fill();
      // bottom rim light
      ctx.strokeStyle = "rgba(216,180,254,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1.5, Math.PI * 0.25, Math.PI * 0.75);
      ctx.stroke();
      ctx.restore();

      /* ---- cute face ---- */
      const eyeDX = r * 0.36;
      const eyeY = cy - r * 0.08;
      const eyeRX = r * 0.20;
      const eyeRY = r * 0.25 * lid;

      for (const sx of [-1, 1]) {
        const ex = cx + sx * eyeDX;
        // sclera
        ctx.fillStyle = "#fdfaff";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeRX, Math.max(eyeRY, 0.6), 0, 0, Math.PI * 2);
        ctx.fill();
        if (!blinking) {
          // pupil
          ctx.fillStyle = "#1c1033";
          ctx.beginPath();
          ctx.arc(ex, eyeY + r * 0.02, r * 0.105, 0, Math.PI * 2);
          ctx.fill();
          // sparkle
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ex - r * 0.035, eyeY - r * 0.03, r * 0.038, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // blush cheeks
      for (const sx of [-1, 1]) {
        const bx = cx + sx * r * 0.62;
        const by = cy + r * 0.28;
        const bl = ctx.createRadialGradient(bx, by, 0, bx, by, r * 0.22);
        bl.addColorStop(0, "rgba(255,130,180,0.5)");
        bl.addColorStop(1, "rgba(255,130,180,0)");
        ctx.fillStyle = bl;
        ctx.beginPath();
        ctx.arc(bx, by, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }

      // mouth: smile idle / open "o" while speaking
      ctx.fillStyle = "#2a1245";
      if (st === "speaking") {
        const open = r * (0.10 + sl * 0.22);
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.42, r * 0.13, Math.max(open, 1.5), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#2a1245";
        ctx.lineWidth = Math.max(2, r * 0.055);
        ctx.lineCap = "round";
        ctx.beginPath();
        const mw = r * 0.20;
        const my = cy + r * 0.36;
        ctx.arc(cx, my - r * 0.06, mw, Math.PI * 0.25, Math.PI * 0.75);
        ctx.stroke();
      }

      /* ---- orbiting sparkles (thinking) ---- */
      if (st === "thinking") {
        for (const sp of sparkles) {
          const a = sp.angle + t * sp.speed * 2.2;
          const rr = r * 1.45 + sp.radiusJitter;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr * 0.8;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + sp.angle));
          ctx.fillStyle = `rgba(233,213,255,${tw})`;
          ctx.beginPath();
          ctx.arc(x, y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="Talk to DEFENXIA"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: onTap ? "pointer" : "default",
        lineHeight: 0,
      }}
    >
      <canvas ref={canvasRef} />
    </button>
  );
}
