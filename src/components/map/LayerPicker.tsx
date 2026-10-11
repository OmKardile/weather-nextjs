'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { Switch } from '@/components/ui/switch';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { BasemapKind } from './map-styles';

/* ================================================================== */
/* LayerPicker — glass sheet listing the six map layers + basemap      */
/* control. Desktop: floating panel on the right. Mobile: bottom sheet */
/* (sits above the time scrubber).                                     */
/* ================================================================== */

export type MapLayerKey = 'wind' | 'precip' | 'temp' | 'radar' | 'satellite' | 'quakes';

export interface LayerPickerProps {
  open: boolean;
  onClose: () => void;
  layers: Record<MapLayerKey, boolean>;
  onToggleLayer: (key: MapLayerKey) => void;
  basemap: BasemapKind;
  onBasemap: (basemap: BasemapKind) => void;
}

const LAYER_META: Array<{
  key: MapLayerKey;
  name: string;
  icon: Parameters<typeof Icon>[0]['name'];
  desc: string;
}> = [
  { key: 'wind', name: 'Wind', icon: 'wind', desc: 'Live particle flow + speed' },
  { key: 'precip', name: 'Precipitation', icon: 'droplet', desc: 'Hourly rain mosaic · scrub hours' },
  { key: 'temp', name: 'Temperature', icon: 'thermometer', desc: '2 m temperature mosaic · scrub hours' },
  { key: 'radar', name: 'Radar', icon: 'radar', desc: 'RainViewer past frames (≤ z7)' },
  { key: 'satellite', name: 'Satellite', icon: 'satellite', desc: 'NASA MODIS true color · yesterday' },
  { key: 'quakes', name: 'Earthquakes', icon: 'alert', desc: 'USGS M2.5+ · past 24 h' },
];

export function LayerPicker({
  open,
  onClose,
  layers,
  onToggleLayer,
  basemap,
  onBasemap,
}: LayerPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={springs.snappy}
          className="absolute inset-x-3 bottom-[6.25rem] z-20 lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-4 lg:w-80"
        >
          <Glass
            level="overlay"
            role="group"
            aria-label="Map layers"
            className="rounded-3xl p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface">
                <Icon name="layers" size={16} className="text-aurora-400" />
                Layers
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close layers"
                className="glass-subtle focus-ring flex h-7 w-7 items-center justify-center rounded-full text-surface-muted transition-colors duration-200 hover:text-surface"
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <ul className="flex flex-col gap-1">
              {LAYER_META.map((layer) => (
                <li key={layer.key}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors duration-150 hover:bg-[rgb(255_255_255/0.06)]">
                    <Icon
                      name={layer.icon}
                      size={20}
                      className={cn(
                        'shrink-0 transition-colors duration-200',
                        layers[layer.key] ? 'text-aurora-400' : 'text-surface-faint',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-[13px] font-semibold leading-tight transition-colors duration-200',
                          layers[layer.key] ? 'text-surface' : 'text-surface-muted',
                        )}
                      >
                        {layer.name}
                      </span>
                      <span className="block text-[11px] leading-snug text-surface-faint">
                        {layer.desc}
                      </span>
                    </span>
                    <Switch
                      checked={layers[layer.key]}
                      onCheckedChange={() => onToggleLayer(layer.key)}
                      aria-label={`Toggle ${layer.name} layer`}
                      className="focus-ring data-[state=checked]:bg-aurora-500"
                    />
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-3 border-t border-[var(--surface-border)] pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
                Basemap
              </p>
              <div
                role="group"
                aria-label="Basemap style"
                className="glass-subtle flex h-8 items-center rounded-full p-0.5"
              >
                {(['dark', 'light'] as const).map((kind) => {
                  const active = basemap === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onBasemap(kind)}
                      className={cn(
                        'focus-ring h-7 flex-1 rounded-full text-xs font-semibold capitalize transition-all duration-200',
                        active
                          ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
                          : 'text-surface-muted hover:text-surface',
                      )}
                    >
                      {kind}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-surface-faint">
                Basemap © Esri, HERE, Garmin, FAO, NOAA, USGS · Radar RainViewer ·
                Satellite NASA GIBS · Quakes USGS · Grid Open-Meteo
              </p>
            </div>
          </Glass>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
