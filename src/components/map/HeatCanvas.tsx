'use client';

import { useEffect, useRef } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { MapGridResponse } from '@/lib/map-grid';
import { PRECIP_RAMP, TEMP_RAMP, sampleRamp } from './map-styles';

/* ================================================================== */
/* HeatCanvas — precipitation / temperature mosaic above the map.       */
/*                                                                     */
/* Grid cells are drawn as projected quads through a large canvas      */
/* blur, reading like a soft radar mosaic. Redraws on moveend /        */
/* resize / grid (hour) changes; fades out while the map is moving.    */
/* ================================================================== */

interface HeatCanvasProps {
  map: MLMap;
  grid: MapGridResponse | null;
  metric: 'precip' | 'temp';
}

const PRECIP_MAX_MM = 8;
const TEMP_MIN_C = -15;
const TEMP_MAX_C = 35;

export function HeatCanvas({ map, grid, metric }: HeatCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!grid) return;

      const lats = grid.lats;
      const lons = grid.lons;
      const rows = lats.length;
      const cols = lons.length;
      const latStep = (lats[rows - 1] - lats[0]) / Math.max(1, rows - 1);
      const lonStep = (lons[cols - 1] - lons[0]) / Math.max(1, cols - 1);

      const latEdge = (i: number) => {
        if (i === 0) return lats[0] - latStep / 2;
        return (lats[i - 1] + lats[i]) / 2;
      };
      const lonEdge = (j: number) => {
        if (j === 0) return lons[0] - lonStep / 2;
        return (lons[j - 1] + lons[j]) / 2;
      };

      // Screen size of the middle cell drives the blur radius.
      const midLat = lats[Math.floor(rows / 2)];
      const midLon = lons[Math.floor(cols / 2)];
      const p1 = map.project({ lon: midLon - lonStep / 2, lat: midLat });
      const p2 = map.project({ lon: midLon + lonStep / 2, lat: midLat });
      const cellPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const blur = Math.min(80, Math.max(12, cellPx * 0.55));
      ctx.filter = `blur(${blur.toFixed(1)}px)`;

      for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
          const value = grid.values[i][j];
          let color: string;
          if (metric === 'precip') {
            if (value <= 0.03) continue;
            color = sampleRamp(PRECIP_RAMP, Math.min(1, value / PRECIP_MAX_MM));
          } else {
            color = sampleRamp(
              TEMP_RAMP,
              Math.min(1, Math.max(0, (value - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C))),
            );
          }
          const loLat = latEdge(i);
          const hiLat =
            i === rows - 1 ? lats[rows - 1] + latStep / 2 : (lats[i] + lats[i + 1]) / 2;
          const loLon = lonEdge(j);
          const hiLon =
            j === cols - 1 ? lons[cols - 1] + lonStep / 2 : (lons[j] + lons[j + 1]) / 2;

          const tl = map.project({ lon: loLon, lat: hiLat });
          const tr = map.project({ lon: hiLon, lat: hiLat });
          const br = map.project({ lon: hiLon, lat: loLat });
          const bl = map.project({ lon: loLon, lat: loLat });

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(tl.x, tl.y);
          ctx.lineTo(tr.x, tr.y);
          ctx.lineTo(br.x, br.y);
          ctx.lineTo(bl.x, bl.y);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.filter = 'none';
    };

    const onMove = () => canvas.setAttribute('data-stale', 'true');
    const onMoveEnd = () => {
      canvas.removeAttribute('data-stale');
      draw();
    };

    draw();
    map.on('move', onMove);
    map.on('moveend', onMoveEnd);
    map.on('resize', onMoveEnd);
    return () => {
      map.off('move', onMove);
      map.off('moveend', onMoveEnd);
      map.off('resize', onMoveEnd);
      ctx.clearRect(0, 0, w, h);
    };
  }, [map, grid, metric]);

  return <canvas ref={canvasRef} className="aether-map-canvas" aria-hidden="true" />;
}
