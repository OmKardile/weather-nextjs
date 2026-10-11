'use client';

import { LogoMark } from '@/components/brand/Logo';

export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div className="glass border-x-0 border-b-0">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center sm:px-6 md:flex-row md:justify-between md:text-left">
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
      </div>
    </footer>
  );
}
