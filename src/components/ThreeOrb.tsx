import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Three.js voice orb — matches the reference artwork exactly:
 *  - Base gradient: coral-red (left) → pink/magenta (center) → purple (right)
 *  - Flowing luminous wave-lines wrapping the sphere (like the reference video)
 *  - Soft top-light highlight + fresnel rim for a glossy 3D look
 *  - No eyes, no face — pure orb.
 * Tap opens the voice assistant.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform float uTime;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);

    // ---- base gradient: coral-red (left) -> magenta (mid) -> purple (right)
    // view-space so it stays fixed on screen like the reference image
    float gx = clamp(n.x * 0.5 + 0.5, 0.0, 1.0);
    vec3 coral   = vec3(1.00, 0.38, 0.36); // #ff615c coral-red
    vec3 magenta = vec3(0.91, 0.21, 0.48); // #e8357b defenxia magenta
    vec3 purple  = vec3(0.55, 0.24, 0.94); // #8b3df0 defenxia violet
    vec3 base = mix(coral, magenta, smoothstep(0.05, 0.55, gx));
    base = mix(base, purple, smoothstep(0.55, 0.95, gx));

    // ---- soft top light
    float topLight = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
    base += vec3(1.0, 0.85, 0.9) * pow(topLight, 3.0) * 0.28;

    // ---- flowing wave lines (reference video style)
    // wavy latitude bands drifting over time
    float wobble = sin(vUv.x * 12.566 + uTime * 0.55) * 1.6
                 + sin(vUv.x * 25.133 - uTime * 0.35) * 0.7;
    float bands = sin(vUv.y * 34.0 + wobble + uTime * 1.1);
    float line = smoothstep(0.90, 1.0, bands);
    // a second, finer set flowing the other way
    float bands2 = sin(vUv.y * 57.0 - wobble * 1.4 - uTime * 0.8 + 2.0);
    float line2 = smoothstep(0.94, 1.0, bands2) * 0.6;
    float lines = clamp(line + line2, 0.0, 1.0);

    // fade lines near silhouette so the edge stays clean
    float edge = clamp(dot(n, v), 0.0, 1.0);
    lines *= smoothstep(0.05, 0.45, edge);

    vec3 col = mix(base, vec3(1.0, 0.98, 1.0), lines * 0.55);

    // ---- fresnel rim: soft luminous edge
    float fresnel = pow(1.0 - edge, 2.2);
    col += vec3(1.0, 0.75, 0.9) * fresnel * 0.35;

    // ---- circular alpha: clean round silhouette, feathered edge
    float alpha = smoothstep(0.0, 0.12, edge);

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function ThreeOrb({
  size = 76,
  onTap,
}: {
  size?: number;
  onTap?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 10);
    camera.position.set(0, 0, 4.4);

    const uniforms = { uTime: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), material);
    scene.add(sphere);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      sphere.rotation.y = t * 0.25; // slow spin so waves travel
      sphere.rotation.z = Math.sin(t * 0.18) * 0.12;
      // gentle float
      sphere.position.y = Math.sin(t * 1.1) * 0.05;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleTap = () => onTapRef.current?.();
    mount.addEventListener("click", handleTap);

    return () => {
      cancelAnimationFrame(raf);
      mount.removeEventListener("click", handleTap);
      sphere.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      role="button"
      aria-label="Open voice assistant"
      style={{
        width: size,
        height: size,
        cursor: "pointer",
        borderRadius: "50%",
        // thin bright outline so the orb never blends into the background
        boxShadow:
          "0 0 0 2px rgba(255,255,255,0.55), 0 0 18px rgba(232,53,123,0.75), 0 6px 22px rgba(232,53,123,0.45)",
      }}
    />
  );
}
