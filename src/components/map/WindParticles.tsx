'use client';

import { useEffect, useRef } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { MapGridResponse } from '@/lib/map-grid';
import { WIND_RAMP, sampleRamp } from './map-styles';

/* ================================================================== */
/* WindParticles — canvas particle field above the map.                 */
/*                                                                     */
/* Particles drift along the bilinear-interpolated u/v grid, leaving   */
/* short trails via a per-frame destination-out fade (works on a       */
/* transparent canvas OVER the basemap). Speed → aurora teal→white.    */
/* prefers-reduced-motion renders a static arrow/barb grid instead.    */
/* ================================================================== */

interface WindParticlesProps {
  map: MLMap;
  grid: MapGridResponse | null;
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  age: number;
  maxAge: number;
}

/** Simulated drift per frame (~3.3 h of wind per second at 60 fps). */
const HOURS_PER_FRAME = 0.055;
const MAX_SPEED_KMH = 60;
const TRAIL_FADE = 0.09;
const BUCKETS = 6;

export function WindParticles({ map, grid }: WindParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowPower =
      (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    const count = reduced ? 0 : lowPower ? 800 : 1800;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let lonW = 0;
    let lonE = 0;
    let mercY0 = 0;
    let mercY1 = 0;
    let pxPerDegLon = 1;
    let pxPerDegLat = 1;
    let raf = 0;

    const mercN = (latDeg: number) =>
      Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));

    const computeView = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const b = map.getBounds();
      lonW = b.getWest();
      lonE = b.getEast();
      const latS = b.getSouth();
      const latN = b.getNorth();
      mercY0 = mercN(latS);
      mercY1 = mercN(latN);
      pxPerDegLon = w / Math.max(1e-6, lonE - lonW);
      pxPerDegLat = h / Math.max(1e-6, latN - latS);
    };

    // --- grid sampling -------------------------------------------------
    const lats = grid?.lats ?? [0];
    const lons = grid?.lons ?? [0];
    const U = grid?.values ?? [[0]];
    const V = grid?.values2 ?? U.map((row) => row.map(() => 0));
    const rows = lats.length;
    const cols = lons.length;
    const latSpan = Math.max(1e-6, lats[rows - 1] - lats[0]);
    const lonSpan = Math.max(1e-6, lons[cols - 1] - lons[0]);

    const sample = (lon: number, lat: number): [number, number] => {
      const gx =
        Math.min(1, Math.max(0, (lon - lons[0]) / lonSpan)) * (cols - 1);
      const gy =
        Math.min(1, Math.max(0, (lat - lats[0]) / latSpan)) * (rows - 1);
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(cols - 1, x0 + 1);
      const y1 = Math.min(rows - 1, y0 + 1);
      const fx = gx - x0;
      const fy = gy - y0;
      const uTop = U[y0][x0] * (1 - fx) + U[y0][x1] * fx;
      const uBot = U[y1][x0] * (1 - fx) + U[y1][x1] * fx;
      const vTop = V[y0][x0] * (1 - fx) + V[y0][x1] * fx;
      const vBot = V[y1][x0] * (1 - fx) + V[y1][x1] * fx;
      return [uTop * (1 - fy) + uBot * fy, vTop * (1 - fy) + vBot * fy];
    };

    const lonOf = (px: number) => lonW + (px / w) * (lonE - lonW);
    const latOf = (py: number) => {
      const my = mercY1 - (py / h) * (mercY1 - mercY0);
      return ((2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180) / Math.PI;
    };

    // --- particles ------------------------------------------------------
    if (particlesRef.current.length !== count) {
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        px: 0,
        py: 0,
        age: Math.floor(Math.random() * 120),
        maxAge: 90 + Math.floor(Math.random() * 120),
      }));
      for (const p of particlesRef.current) {
        p.px = p.x;
        p.py = p.y;
      }
    }
    const particles = particlesRef.current;

    const bucketColors = Array.from(
      { length: BUCKETS },
      (_, i) => sampleRamp(WIND_RAMP, (i + 0.5) / BUCKETS),
    );

    const respawn = (p: Particle) => {
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.px = p.x;
      p.py = p.y;
      p.age = 0;
      p.maxAge = 90 + Math.floor(Math.random() * 120);
    };

    const frame = () => {
      // Fade existing trails toward transparent (canvas floats over map).
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${TRAIL_FADE})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';

      const segments: number[][] = bucketColors.map(() => []);
      for (const p of particles) {
        p.age += 1;
        const lon = lonOf(p.x);
        const lat = latOf(p.y);
        const [u, v] = sample(lon, lat);
        const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
        p.x += ((u * HOURS_PER_FRAME) / (111.32 * cosLat)) * pxPerDegLon;
        p.y -= ((v * HOURS_PER_FRAME) / 111.32) * pxPerDegLat;
        const outside =
          p.x < -8 || p.x > w + 8 || p.y < -8 || p.y > h + 8 || p.age > p.maxAge;
        if (outside) {
          respawn(p);
          continue;
        }
        const speed = Math.hypot(u, v);
        const bucket = Math.min(
          BUCKETS - 1,
          Math.floor((speed / MAX_SPEED_KMH) * BUCKETS),
        );
        const seg = segments[bucket];
        seg.push(p.px, p.py, p.x, p.y);
        p.px = p.x;
        p.py = p.y;
      }

      for (let b = 0; b < BUCKETS; b += 1) {
        const seg = segments[b];
        if (seg.length === 0) continue;
        ctx.strokeStyle = bucketColors[b];
        ctx.beginPath();
        for (let i = 0; i < seg.length; i += 4) {
          ctx.moveTo(seg[i], seg[i + 1]);
          ctx.lineTo(seg[i + 2], seg[i + 3]);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && !reduced && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // --- static barbs (reduced motion) ----------------------------------
    const drawStatic = () => {
      computeView();
      ctx.clearRect(0, 0, w, h);
      if (!grid) return;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
          const u = U[i][j];
          const v = V[i][j];
          const speed = Math.hypot(u, v);
          const pt = map.project({ lon: lons[j], lat: lats[i] });
          if (pt.x < -20 || pt.x > w + 20 || pt.y < -20 || pt.y > h + 20) continue;
          const cosLat = Math.max(0.15, Math.cos((lats[i] * Math.PI) / 180));
          let dx = (u / (111.32 * cosLat)) * pxPerDegLon;
          let dy = (-v / 111.32) * pxPerDegLat;
          const norm = Math.hypot(dx, dy) || 1;
          dx /= norm;
          dy /= norm;
          const len = 9 + (speed / MAX_SPEED_KMH) * 16;
          const cx = pt.x - (dx * len) / 2;
          const cy = pt.y - (dy * len) / 2;
          const tx = pt.x + (dx * len) / 2;
          const ty = pt.y + (dy * len) / 2;
          ctx.strokeStyle = sampleRamp(WIND_RAMP, speed / MAX_SPEED_KMH);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(tx, ty);
          // arrowhead
          const head = 5;
          const ang = Math.atan2(dy, dx);
          ctx.moveTo(tx, ty);
          ctx.lineTo(
            tx - head * Math.cos(ang - Math.PI / 6),
            ty - head * Math.sin(ang - Math.PI / 6),
          );
          ctx.moveTo(tx, ty);
          ctx.lineTo(
            tx - head * Math.cos(ang + Math.PI / 6),
            ty - head * Math.sin(ang + Math.PI / 6),
          );
          ctx.stroke();
        }
      }
    };

    // --- events ---------------------------------------------------------
    const onMove = () => canvas.setAttribute('data-stale', 'true');
    const onMoveEnd = () => {
      computeView();
      canvas.removeAttribute('data-stale');
      if (reduced) drawStatic();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    computeView();
    map.on('move', onMove);
    map.on('moveend', onMoveEnd);
    map.on('resize', onMoveEnd);
    document.addEventListener('visibilitychange', onVisibility);
    if (reduced) drawStatic();
    else start();

    return () => {
      stop();
      map.off('move', onMove);
      map.off('moveend', onMoveEnd);
      map.off('resize', onMoveEnd);
      document.removeEventListener('visibilitychange', onVisibility);
      ctx.clearRect(0, 0, w, h);
    };
  }, [map, grid]);

  return <canvas ref={canvasRef} className="aether-map-canvas" aria-hidden="true" />;
}
