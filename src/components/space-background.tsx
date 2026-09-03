"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient background for the landing page: a slow drifting, faintly twinkling
 * starfield on canvas plus a large planet outline. Pauses when the tab is
 * hidden, and holds still (no drift, gentle twinkle only) under
 * `prefers-reduced-motion`.
 */
export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    type Star = { x: number; y: number; z: number; r: number; phase: number };
    let stars: Star[] = [];

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.round((width * height) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 0.7 + 0.3,
        r: Math.random() * 1 + 0.3,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let running = true;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        if (!reduced) {
          s.y += s.z * 0.14;
          if (s.y > height + 2) {
            s.y = -2;
            s.x = Math.random() * width;
          }
        }
        const twinkle = reduced ? 0.55 : 0.4 + 0.45 * Math.sin(s.phase + t * 0.002 * s.z);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.z + 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 235, 244, ${(twinkle * s.z).toFixed(3)})`;
        ctx.fill();
      }
      if (running) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-80" />

      {/* planet outline, rising from the bottom */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className="absolute -bottom-[46vh] left-1/2 h-[120vh] w-[120vh] -translate-x-1/2 opacity-[0.14]"
      >
        <circle cx="50" cy="50" r="48" stroke="var(--primary)" strokeWidth="0.25" />
        <circle
          cx="50"
          cy="50"
          r="41"
          stroke="var(--primary)"
          strokeWidth="0.12"
          strokeDasharray="0.8 2.2"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="63"
          ry="9"
          stroke="var(--primary)"
          strokeWidth="0.18"
          transform="rotate(-18 50 50)"
        />
      </svg>

      {/* soft horizon glow */}
      <div className="absolute -bottom-[32vh] left-1/2 size-[64vh] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
    </div>
  );
}
