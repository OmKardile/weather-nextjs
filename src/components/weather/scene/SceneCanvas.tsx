'use client';

import { useEffect, useRef } from 'react';

export interface SceneCanvasProps {
  kind: 'rain' | 'snow';
  /** Rain only — particle budget. Snow always uses its own fixed count. */
  intensity?: 'light' | 'heavy';
}

const RAIN_COLOR = '#EAF4F1';
const SNOW_COLOR = '#F4FAF8';
const RAIN_COUNT = { light: 110, heavy: 260 } as const;
const SNOW_COUNT = 150;
/** Delta clamp (seconds) — guards against huge jumps after tab switches. */
const MAX_DT = 0.05;
const TAU = Math.PI * 2;

interface RainDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  /** Streak length in px, proportional to fall speed (10–18). */
  len: number;
}

interface SnowFlake {
  /** Base x — the drawn x swings sinusoidally around it. */
  x: number;
  y: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  amp: number;
  sway: number;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

function makeRainDrop(width: number, height: number, initial: boolean): RainDrop {
  const vy = rand(900, 1400);
  return {
    x: rand(-60, width + 60),
    y: initial ? rand(-height, height) : rand(-140, -20),
    vx: rand(-80, -20),
    vy,
    alpha: rand(0.1, 0.28),
    len: 10 + ((vy - 900) / 500) * 8,
  };
}

function makeSnowFlake(width: number, height: number, initial: boolean): SnowFlake {
  return {
    x: rand(0, Math.max(1, width)),
    y: initial ? rand(-height, height) : rand(-40, -8),
    vy: rand(28, 70),
    radius: rand(1.5, 4.2),
    alpha: rand(0.55, 0.95),
    phase: rand(0, TAU),
    amp: rand(12, 44),
    sway: rand(0.4, 1.4),
  };
}

/**
 * Single-canvas precipitation engine. One rAF loop, delta-time based,
 * paused when the tab is hidden, DPR-aware (capped at 2) and reduced to a
 * single static frame under prefers-reduced-motion.
 */
export function SceneCanvas({ kind, intensity = 'light' }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!ctx || !parent) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;
    let raf: number | null = null;
    let last = 0;
    let elapsed = 0;
    let width = 0;
    let height = 0;
    let drops: RainDrop[] = [];
    let flakes: SnowFlake[] = [];

    const targetCount = (): number => {
      if (kind === 'snow') return SNOW_COUNT;
      const base = intensity === 'heavy' ? RAIN_COUNT.heavy : RAIN_COUNT.light;
      // Gentle density scaling on narrow viewports so phones aren't overstreaked.
      const scale = Math.min(1, Math.max(0.55, width / 1200));
      return Math.max(40, Math.round(base * scale));
    };

    const spawn = (): void => {
      const count = targetCount();
      if (kind === 'rain') {
        drops = Array.from({ length: count }, () => makeRainDrop(width, height, true));
        flakes = [];
      } else {
        drops = [];
        flakes = Array.from({ length: count }, () => makeSnowFlake(width, height, true));
      }
    };

    const step = (dt: number): void => {
      if (kind === 'rain') {
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.y - d.len > height + 24 || d.x < -90) {
            drops[i] = makeRainDrop(width, height, false);
          }
        }
      } else {
        for (let i = 0; i < flakes.length; i++) {
          const f = flakes[i];
          f.y += f.vy * dt;
          if (f.y > height + 8) {
            flakes[i] = makeSnowFlake(width, height, false);
          }
        }
      }
    };

    const draw = (): void => {
      ctx.clearRect(0, 0, width, height);
      if (kind === 'rain') {
        ctx.strokeStyle = RAIN_COLOR;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        for (const d of drops) {
          const speed = Math.hypot(d.vx, d.vy);
          const ux = d.vx / speed;
          const uy = d.vy / speed;
          ctx.globalAlpha = d.alpha;
          ctx.beginPath();
          ctx.moveTo(d.x - ux * d.len, d.y - uy * d.len);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = SNOW_COLOR;
        for (const f of flakes) {
          const swayX = f.x + Math.sin(elapsed * f.sway + f.phase) * f.amp;
          ctx.globalAlpha = f.alpha;
          ctx.beginPath();
          ctx.arc(swayX, f.y, f.radius, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number): void => {
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      elapsed += dt;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = (): void => {
      if (raf === null) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const stop = (): void => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    /** Reduced-motion mode: one calm, scattered frame — no loop. */
    const renderStatic = (): void => {
      stop();
      draw();
    };

    const resize = (): void => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if ((kind === 'rain' ? drops.length : flakes.length) === 0) spawn();
      if (reduced) renderStatic();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();

    const onVisibility = (): void => {
      if (document.hidden) stop();
      else if (!reduced) start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onMotionChange = (): void => {
      reduced = motionQuery.matches;
      if (reduced) renderStatic();
      else if (!document.hidden) start();
    };
    motionQuery.addEventListener('change', onMotionChange);

    if (!reduced && !document.hidden) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, [kind, intensity]);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
  );
}
