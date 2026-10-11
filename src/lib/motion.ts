import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion language for Aether — spring presets + section variants.
 * All spring presets respect prefers-reduced-motion via the components that
 * consume them (framer-motion's useReducedMotion is checked where motion is
 * non-essential; critical UI states always remain reachable without motion).
 */

export const springs = {
  /** Gentle settle — large surfaces, page-level transitions. */
  soft: { type: 'spring', stiffness: 120, damping: 20, mass: 0.9 } satisfies Transition,
  /** Quick snap — toggles, chips, small controls. */
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } satisfies Transition,
  /** Playful pop — dock magnification, palette items, saves. */
  bouncy: { type: 'spring', stiffness: 320, damping: 16, mass: 0.7 } satisfies Transition,
} as const;

export const durations = {
  fast: 0.18,
  base: 0.32,
  slow: 0.56,
} as const;

export const fades = {
  /** Content entering as it scrolls into view. */
  section: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: springs.soft },
  } satisfies Variants,
  /** Parent orchestrator for staggered children. */
  stagger: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
  } satisfies Variants,
  child: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: springs.snappy },
  } satisfies Variants,
  /** Overlays: palette, sheets, drawers. */
  overlay: {
    hidden: { opacity: 0, scale: 0.97, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0, transition: springs.snappy },
    exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: durations.fast } },
  } satisfies Variants,
} as const;
