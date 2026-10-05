import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Atmosphere — DEFENXIA "Aurora" background.
 * A fixed three.js canvas behind everything (z-0, pointer-events none):
 * large soft additive glow blobs in ember #f9613f / magenta #e8357b /
 * violet #8b3df0 visibly floating left-to-right, right-to-left, up-down and
 * diagonal behind the UI, plus a field of tiny floating particles in the
 * same trio. Dark and ambient — the color lives in the light, not in a
 * full-screen wash.
 *
 * - prefers-reduced-motion: renders a single static frame
 * - pauses when the tab is hidden, DPR clamped for mobile perf
 * - pointer drift adds gentle parallax (fine pointers only)
 */

const TRIO = ["#f9613f", "#e8357b", "#8b3df0"];

function makeGlowTexture(color: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color + "cc");
  g.addColorStop(0.35, color + "66");
  g.addColorStop(0.7, color + "1a");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Marble ball texture — each ball mixes all three theme colors in one
 * diagonal gradient (orange → magenta → purple), exactly like the color
 * mixtures used across the website (buttons, edges, CTAs).
 */
function makeMarbleTexture(stops: [string, string, string]): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.5, stops[1]);
  g.addColorStop(1, stops[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Atmosphere = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 10;

    const textures = TRIO.map(makeGlowTexture);

    type BlobMode = "ltr" | "rtl" | "ud" | "diag";
    interface Blob {
      sprite: THREE.Sprite;
      baseX: number;
      baseY: number;
      mode: BlobMode;
      dir: number; // +1 = left→right, -1 = right→left (wrap modes)
      speed: number; // world units / second (wrap modes)
      amp: number; // sine amplitude (ud / diag + bob)
      freq: number; // sine frequency
      phase: number;
      baseScale: number;
      pulse: number;
      opacity: number;
    }

    // 4 glowing color chunks — the purple + pink + ember blend, floating
    // gently here and there. Fewer and more defined (not scattered blurry
    // clouds).
    const blobDefs: Array<{
      color: number; x: number; y: number; s: number; mode: BlobMode;
      speed: number; amp: number; freq: number; opacity: number;
    }> = [
      { color: 2, x: -4.0, y: 3.2, s: 6.0, mode: "ud", speed: 0.00, amp: 1.5, freq: 0.10, opacity: 0.55 },
      { color: 1, x: 4.2, y: 0.8, s: 6.5, mode: "ud", speed: 0.00, amp: 1.7, freq: 0.08, opacity: 0.55 },
      { color: 0, x: -0.5, y: -3.8, s: 7.0, mode: "ud", speed: 0.00, amp: 1.4, freq: 0.11, opacity: 0.55 },
      { color: 1, x: -3.8, y: -1.2, s: 5.0, mode: "ud", speed: 0.00, amp: 1.2, freq: 0.09, opacity: 0.50 },
    ];

    const blobs: Blob[] = blobDefs.map((d, i) => {
      const mat = new THREE.SpriteMaterial({
        map: textures[d.color],
        transparent: true,
        opacity: d.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(d.x, d.y, -2 - i * 0.3);
      sprite.scale.set(d.s, d.s, 1);
      scene.add(sprite);
      // ANIM = 0.1 — only 10% of the floating/bursting motion remains.
      return {
        sprite, baseX: d.x, baseY: d.y, mode: d.mode,
        dir: d.mode === "rtl" ? -1 : 1,
        speed: d.speed, amp: d.amp, freq: d.freq,
        phase: i * 1.7, baseScale: d.s, pulse: 0.03 + (i % 3) * 0.01, opacity: d.opacity,
      };
    });

    // ---- Static marble balls: FROZEN in place, no floating at all ----
    // Each ball mixes all three theme colors (orange → magenta → purple),
    // like the mixtures across the website.
    const marbleTexes = [
      makeMarbleTexture(["#f9613f", "#e8357b", "#8b3df0"]),
      makeMarbleTexture(["#e8357b", "#8b3df0", "#f9613f"]),
      makeMarbleTexture(["#8b3df0", "#f9613f", "#e8357b"]),
    ];
    interface Disc {
      sprite: THREE.Sprite;
    }
    const discs: Disc[] = [];
    // Visible half-extents at the balls' depth (small margin kept).
    // Camera: fov 60, z=10; balls sit near z≈-1.4; scene may be scaled on tall screens.
    // Stable size from the atmosphere box (CSS: 100lvh) — unlike window.innerHeight
    // it never changes when the mobile URL bar shows/hides mid-scroll,
    // so the balls can't jump on first scroll.
    const atmoBox = canvasRef.current?.parentElement as HTMLElement | null;
    const winW = atmoBox?.clientWidth || window.innerWidth;
    const winH = atmoBox?.clientHeight || window.innerHeight;
    const sceneScale = Math.max(1, winH / 900);
    const ballDist = 10 + 1.4;
    const MARGIN = 0.88;
    const vHalfH = (Math.tan(THREE.MathUtils.degToRad(30)) * ballDist * MARGIN) / sceneScale;
    const vHalfW = vHalfH * (winW / winH);
    // ---- Ball gloss texture: soft light reflection for the polished look ----
    const makeGlossTexture = () => {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 128;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(52, 48, 4, 64, 64, 62);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    };
    const glossTex = makeGlossTexture();
    // ---- Static marble balls — FROZEN in place, zero floating ----
    // Positions, sizes and colors match the reference screenshot exactly:
    // [x-frac, y-frac, radius-frac-of-width, texture]. +y = up.
    const BALLS: Array<[number, number, number, number]> = [
      [0.87, 0.03, 0.23, 1],  // top-right, pink
      [0.05, 0.21, 0.26, 0],  // left, pink-magenta
      [0.90, 0.83, 0.29, 0],  // bottom-right, orange-pink (large)
    ];
    for (const [fx, fy, rf, ti] of BALLS) {
      const mat = new THREE.SpriteMaterial({
        map: marbleTexes[ti],
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const s = 4 * rf * vHalfW; // world-unit diameter matching the screenshot size
      sprite.position.set((fx - 0.5) * 2 * vHalfW, (0.5 - fy) * 2 * vHalfH, -1.2);
      sprite.scale.set(s, s, 1);
      scene.add(sprite);
      // Polished shine: soft light reflection sitting upper-left on the ball
      const hl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glossTex,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const hs = s * 0.6;
      hl.scale.set(hs, hs, 1);
      hl.position.set(sprite.position.x - s * 0.20, sprite.position.y + s * 0.22, -1.1);
      scene.add(hl);
      discs.push({ sprite });
    }

    // Particle field — tiny motes in the trio colors, slow rise + sway
    const COUNT = 150;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT * 2);
    const tmpColor = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = -1 - Math.random() * 3;
      tmpColor.set(TRIO[i % 3]);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
      seeds[i * 2] = Math.random() * Math.PI * 2;
      seeds[i * 2 + 1] = 0.3 + Math.random() * 0.9;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // Pointer parallax (fine pointers only)
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (canHover) window.addEventListener("pointermove", onPointer, { passive: true });

    let lastW = 0;
    let lastH = 0;
    // Scene scale is set ONCE at startup and never on resize: on mobile,
    // scrolling shows/hides the URL bar which changes innerHeight — rescaling
    // the scene then would make the balls visibly grow/shrink (glitch).
    // (Uses the stable box height — see winH above.)
    scene.scale.setScalar(Math.max(1, winH / 900));
    const resize = () => {
      // Stable box size, NOT window.innerHeight: URL-bar toggles must not
      // reallocate the GL buffer or change the camera aspect mid-scroll.
      const w = atmoBox?.clientWidth || window.innerWidth;
      const h = atmoBox?.clientHeight || window.innerHeight;
      if (w === lastW && h === lastH) return; // no real change — skip GL buffer realloc
      lastW = w;
      lastH = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    // Debounced: on mobile, scroll shows/hides the URL bar which fires many
    // resize events mid-scroll — reallocating the GL buffer on each one
    // causes a visible "screen refresh" flicker. Wait for it to settle.
    let rsT = 0;
    const onResize = () => {
      window.clearTimeout(rsT);
      rsT = window.setTimeout(resize, 160);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    const WRAP = 13;
    const wrapX = (v: number) => ((((v + WRAP) % (2 * WRAP)) + 2 * WRAP) % (2 * WRAP)) - WRAP;

    const renderFrame = (t: number) => {
      const tt = t * 0.001;
      for (const b of blobs) {
        if (b.mode === "ltr" || b.mode === "rtl" || b.mode === "diag") {
          b.sprite.position.x = wrapX(b.baseX + b.dir * tt * b.speed);
        } else {
          b.sprite.position.x = b.baseX + Math.sin(tt * 0.35 + b.phase) * 0.35; // gentle side sway
        }
        if (b.mode === "ud" || b.mode === "diag") {
          b.sprite.position.y = b.baseY + Math.sin(tt * b.freq * 6.28 + b.phase) * b.amp;
        } else {
          b.sprite.position.y = b.baseY + Math.sin(tt * b.freq * 6.28 + b.phase * 1.3) * b.amp;
        }
        const s = b.baseScale * (1 + Math.sin(tt * 0.6 + b.phase) * b.pulse);
        b.sprite.scale.set(s, s, 1);
      }
      // Marble balls are frozen in place — no per-frame updates.
      const pos = pGeo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        const sp = seeds[i * 2 + 1];
        const ph = seeds[i * 2];
        arr[i * 3 + 1] += 0.004 * sp;
        if (arr[i * 3 + 1] > 15) arr[i * 3 + 1] = -15;
        arr[i * 3] += Math.sin(tt * 0.5 * sp + ph) * 0.0035;
      }
      pos.needsUpdate = true;

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      camera.position.x = pointer.x * 0.9;
      camera.position.y = -pointer.y * 0.7;
      camera.lookAt(0, 0, -2);

      renderer.render(scene, camera);
    };

    const startLoop = () => {
      const loop = () => {
        if (!running) return;
        renderFrame(clock.getElapsedTime() * 1000);
        raf = requestAnimationFrame(loop);
      };
      loop();
    };

    if (reduced) {
      renderFrame(1200); // one static frame
    } else {
      startLoop();
    }

    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        clock.getDelta();
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(rsT);
      window.removeEventListener("resize", onResize);
      if (canHover) window.removeEventListener("pointermove", onPointer);
      scene.remove(points);
      pGeo.dispose();
      pMat.dispose();
      textures.forEach((tx) => tx.dispose());
      marbleTexes.forEach((tx) => tx.dispose());
      discs.forEach((d) => {
        scene.remove(d.sprite);
        (d.sprite.material as THREE.Material).dispose();
      });
      blobs.forEach((b) => {
        scene.remove(b.sprite);
        (b.sprite.material as THREE.Material).dispose();
      });
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div className="atmosphere" aria-hidden="true" data-atmosphere>
        <canvas ref={canvasRef} />
      </div>
      <div className="vignette" aria-hidden="true" />
    </>
  );
};

/**
 * useGlassShine — scroll-reactive shine sweep for every `.glass` surface.
 * Proximity to the viewport center drives --shine (opacity), vertical
 * progress drives --shine-x (sweep position). The background atmosphere
 * layer is never moved — it stays perfectly fixed while scrolling.
 * Respects prefers-reduced-motion.
 *
 * Perf design (Worker C): the old implementation called
 * getBoundingClientRect() on EVERY .glass card on EVERY scroll frame — a
 * forced synchronous layout across dozens of elements, the main source of
 * scroll lag/jitter on mobile. This version:
 *  - tracks visible cards with an IntersectionObserver and only measures
 *    those (offscreen cards sit at --shine 0 anyway, so nothing visual
 *    is lost);
 *  - skips the frame entirely when scrollY hasn't changed since the last
 *    render (momentum settle / unrelated repaints);
 *  - prunes detached nodes so observers never leak.
 */
export const useGlassShine = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticking = false;
    let lastScrollY = -1;
    const observed = new Set<HTMLElement>();
    const visible = new Set<HTMLElement>();

    let io: IntersectionObserver | null = null;
    const ensureIO = () => {
      if (io || typeof IntersectionObserver === "undefined") return io;
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            if (entry.isIntersecting) visible.add(el);
            else visible.delete(el);
          }
        },
        // Start updating a card slightly before it enters the viewport so
        // its shine is already correct when it scrolls into view.
        { rootMargin: "25% 0px 25% 0px" }
      );
      return io;
    };

    const collect = () => {
      const observer = ensureIO();
      const cards = document.querySelectorAll<HTMLElement>(".glass");
      for (const card of cards) {
        if (!observed.has(card)) {
          observed.add(card);
          if (observer) observer.observe(card);
          else visible.add(card); // no IO support — fall back to measuring all
        }
      }
      // Prune detached nodes so we never leak observers or style dead elements
      for (const el of Array.from(observed)) {
        if (!el.isConnected) {
          observed.delete(el);
          visible.delete(el);
          if (observer) observer.unobserve(el);
        }
      }
    };

    const render = () => {
      const vh = window.innerHeight || 1;
      const scrollY = window.scrollY || 0;

      // Scroll position unchanged since the last frame — nothing visual
      // would change, so skip the forced layout entirely.
      if (scrollY === lastScrollY) {
        ticking = false;
        return;
      }
      lastScrollY = scrollY;

      let index = 0;
      for (const card of visible) {
        const rect = card.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - vh / 2);
        const proximity = Math.max(0, 1 - distance / (vh * 0.82));
        const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
        const shineX = -82 + progress * 164 + (index % 3) * 5;
        card.style.setProperty("--shine", (proximity * 0.78).toFixed(3));
        card.style.setProperty("--shine-x", `${shineX.toFixed(2)}%`);
        index++;
      }

      ticking = false;
    };

    const requestRender = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    };

    collect();
    render();

    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    const mo = new MutationObserver(() => {
      collect();
      requestRender();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      mo.disconnect();
      if (io) io.disconnect();
    };
  }, []);
};
