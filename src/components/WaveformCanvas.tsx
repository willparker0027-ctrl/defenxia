import { useEffect, useRef } from "react";

/**
 * Animated waveform canvas — DEFENXIA palette (magenta → violet → blue).
 * Amplitude follows the active audio level:
 *  - AI speaking → speakerLevel drives the waves
 *  - user speaking → micLevel drives the waves
 *  - idle → gentle ambient drift
 */
export default function WaveformCanvas({
  micLevel,
  speakerLevel,
  speaking,
  listening,
}: {
  micLevel: number;
  speakerLevel: number;
  speaking: boolean;
  listening: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ micLevel, speakerLevel, speaking, listening });
  stateRef.current = { micLevel, speakerLevel, speaking, listening };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    // smoothed amplitude so waves don't jump
    let amp = 0.08;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
    };
    resize();
    window.addEventListener("resize", resize);

    // DEFENXIA gradient stops: magenta → violet → blue
    const LAYERS = [
      { color: "232,53,123", width: 2.2, speed: 1.0, yOff: 0.0, alpha: 0.95 }, // magenta
      { color: "139,61,240", width: 1.8, speed: 1.35, yOff: 0.6, alpha: 0.8 }, // violet
      { color: "96,120,255", width: 1.5, speed: 0.75, yOff: 1.2, alpha: 0.7 }, // blue
      { color: "232,53,123", width: 1.1, speed: 1.7, yOff: 2.1, alpha: 0.45 }, // magenta echo
    ];

    const draw = () => {
      const s = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      // target amplitude from live audio
      const live = s.speaking ? s.speakerLevel : s.listening ? s.micLevel : 0;
      const target = 0.06 + Math.min(1, live) * 0.9;
      amp += (target - amp) * 0.12; // smooth
      t += 0.028 + amp * 0.05;

      ctx.clearRect(0, 0, w, h);

      for (const L of LAYERS) {
        ctx.beginPath();
        const steps = Math.floor(w / 3);
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * w;
          const nx = i / steps; // 0..1
          // envelope: louder in the middle, fades at edges
          const env = Math.sin(nx * Math.PI);
          const y =
            midY +
            Math.sin(nx * 6.5 + t * L.speed * 2 + L.yOff) * amp * h * 0.42 * env +
            Math.sin(nx * 13.0 - t * L.speed * 1.3 + L.yOff * 2) * amp * h * 0.16 * env;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // glow
        ctx.shadowColor = `rgba(${L.color},0.8)`;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = `rgba(${L.color},${L.alpha})`;
        ctx.lineWidth = L.width * (window.devicePixelRatio || 1);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // soft center glow when active
      if (amp > 0.12) {
        const g = ctx.createRadialGradient(w / 2, midY, 0, w / 2, midY, w * 0.4);
        g.addColorStop(0, `rgba(139,61,240,${Math.min(0.25, amp * 0.3)})`);
        g.addColorStop(1, "rgba(139,61,240,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden
    />
  );
}
