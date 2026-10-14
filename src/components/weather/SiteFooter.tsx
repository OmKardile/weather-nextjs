'use client';

import { LogoMark } from '@/components/brand/Logo';

export function SiteFooter() {
  return (
    /* Flat on the scene — no panel (the old .glass slab here read as a
       milky bar at the page bottom). A whisper hairline separates it. */
    <footer className="footer-hairline mt-auto pt-5">
      <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center md:flex-row md:justify-between md:text-left">
          <p className="flex items-center gap-2 text-xs text-surface-muted">
            <LogoMark className="h-6 w-6" />
            <span className="font-display font-bold tracking-[0.2em] text-surface">AETHER</span>
            <span className="text-surface-faint">— weather, elevated.</span>
          </p>
          <p className="text-[11px] leading-relaxed text-surface-faint">
            Data by{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 transition-colors hover:text-surface"
            >
              Open-Meteo
            </a>{' '}
            · Air quality by CAMS · Geocoding by Open-Meteo &amp; OpenStreetMap
          </p>
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-surface-muted">
          Designed &amp; developed by{' '}
          <a
            href="https://omkardile.is-a.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm underline-offset-2 transition-colors hover:text-surface hover:underline focus-ring"
          >
            Omkar Kardile
          </a>
        </p>
      </div>
    </footer>
  );
}
