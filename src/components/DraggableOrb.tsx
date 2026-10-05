import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThreeOrb from "@/components/ThreeOrb";

/**
 * Draggable voice orb with an "AI" label above it.
 * - Drag anywhere on the orb/label to move it (touch + mouse)
 * - Tap (no drag) opens the voice assistant
 * - Position is remembered in localStorage
 */

const ORB_SIZE = 59; // 30% smaller (was 84)
const LABEL_H = 30;
const TOTAL_H = LABEL_H + ORB_SIZE;
const MARGIN = 10;
const STORAGE_KEY = "defenxia-orb-pos-v2";

function clampPos(x: number, y: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.min(Math.max(x, MARGIN), Math.max(MARGIN, w - ORB_SIZE - MARGIN)),
    y: Math.min(
      Math.max(y, MARGIN + 40),
      Math.max(MARGIN + 40, h - TOTAL_H - 92) // keep clear of bottom nav
    ),
  };
}

export default function DraggableOrb() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
  });

  // initial position: saved one, else bottom-right
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved) as { x: number; y: number };
        if (typeof p.x === "number" && typeof p.y === "number") {
          setPos(clampPos(p.x, p.y));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setPos(
      clampPos(
        window.innerWidth - ORB_SIZE - 22,
        // default: right side, slightly above middle (like the reference)
        Math.round(window.innerHeight * 0.62 - TOTAL_H / 2)
      )
    );
  }, []);

  // re-clamp on resize / rotation
  useEffect(() => {
    const onResize = () =>
      setPos((p) => (p ? clampPos(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.active || pos == null) return;
    drag.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.x,
      oy: pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 8) d.moved = true;
    if (d.moved) setPos(clampPos(d.ox + dx, d.oy + dy));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    drag.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d.moved) {
      navigate("/voice-assistant");
    } else if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    }
  };

  if (pos == null) return null;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        touchAction: "none",
        cursor: "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          height: LABEL_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "0.32em",
          paddingLeft: "0.32em",
          color: "#ffffff",
          textShadow:
            "0 0 10px rgba(232,53,123,0.95), 0 0 26px rgba(232,53,123,0.6), 0 2px 6px rgba(0,0,0,0.7)",
          pointerEvents: "none",
        }}
      >
        AI
      </div>
      <ThreeOrb size={ORB_SIZE} />
    </div>
  );
}
