'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LiquidGlass } from '@/components/glass/LiquidGlass';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* SegmentedControl — iOS 27 style control.                             */
/* LiquidGlass capsule container; the selected segment is an inner      */
/* lighter glass capsule that morphs between positions (framer-motion   */
/* layoutId + a brief scaleX stretch mid-travel).                       */
/*                                                                     */
/* A single tinted accent is reserved for the app's primary action —    */
/* selection here stays in the glass family (lighter inner capsule).    */
/* ================================================================== */

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  'aria-label': string;
  className?: string;
  /** Shared morph key (defaults to the aria-label). */
  layoutKey?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  layoutKey,
  ...aria
}: SegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const morphKey = layoutKey ?? aria['aria-label'];

  return (
    <LiquidGlass
      role="group"
      aria-label={aria['aria-label']}
      className={cn('flex h-8 items-center rounded-full p-0.5', className)}
      press={false}
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={active ? undefined : () => onChange(option.id)}
            className={cn(
              'focus-ring relative z-10 h-7 rounded-full px-3 text-[12px] font-semibold transition-colors duration-200',
              active ? 'text-white' : 'text-white/70 hover:text-white',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segment-${morphKey}`}
                /* brief scaleX stretch mid-travel (gel flex) — keyframes on
                   animate compose with the layout morph */
                initial={false}
                animate={reduced ? undefined : { scaleX: [1.12, 1] }}
                transition={{
                  ...springs.snappy,
                  scaleX: { duration: 0.26, ease: 'easeOut' },
                }}
                className="lg-selected absolute inset-0 -z-10 rounded-full"
                aria-hidden="true"
              />
            )}
            {option.label}
          </button>
        );
      })}
    </LiquidGlass>
  );
}
