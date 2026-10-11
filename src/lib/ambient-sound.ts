/* ================================================================== */
/* Ambient sound engine — 100% synthesized, zero audio files.          */
/* Client-only: the engine is created lazily from a user gesture       */
/* (the sound toggle IS the gesture). Uses one module singleton so     */
/* MenuBar / Settings / AetherApp all drive the same instance.         */
/*                                                                    */
/* Scene map (deriveAmbientScene): rain · drizzle · thunder · night    */
/* (crickets + wind bed) · snow (muffled hush) · wind (brown bed with  */
/* slow LFO + gusts) · fog (low warm pad) · breeze (gentle day bed).   */
/* All layers keep conservative gain — this is ambience, not a demo.   */
/* ================================================================== */

import type { AmbientSceneId } from '@/lib/sections';

const CROSSFADE_S = 0.8;
const MASTER_CEILING = 0.5;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function audioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext ?? null;
}

/* ------------------------------------------------------------------ */
/* Noise buffer generation (2 s loops, generated once per context)     */
/* ------------------------------------------------------------------ */

function makeWhiteBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makePinkBuffer(ctx: AudioContext): AudioBuffer {
  // Paul Kellet's refined pink noise filter (economy version).
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    data[i] = pink;
  }
  return buffer;
}

function makeBrownBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

/* ------------------------------------------------------------------ */
/* Voice — one continuous layer of the current scene                   */
/* ------------------------------------------------------------------ */

interface Voice {
  /** Terminal gain of this voice (pre-master). */
  level: number;
  /** Fade the voice out and tear it down. */
  fadeOutAndStop: () => void;
  /** Stop immediately (engine teardown). */
  stopNow: () => void;
}

interface ScheduledLoop {
  minMs: number;
  maxMs: number;
  fire: () => void;
}

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private pink: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;

  private voices: Voice[] = [];
  private loops = new Map<number, ScheduledLoop>();
  private retryListeners: Array<() => void> = [];
  private visibilityBound = false;

  private running = false;
  private volume = 0.5;
  private scene: AmbientSceneId | null = null;

  /* ------------------------------ core ----------------------------- */

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = audioCtor();
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    if (!this.ctx) return null;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.white = makeWhiteBuffer(this.ctx);
    this.pink = makePinkBuffer(this.ctx);
    this.brown = makeBrownBuffer(this.ctx);
    this.bindVisibility();
    return this.ctx;
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx || !this.running) return;
      if (document.hidden) {
        void this.ctx.suspend().catch(() => undefined);
      } else {
        void this.ctx.resume().catch(() => undefined);
      }
    });
  }

  private masterValue(): number {
    // User volume (0–1) behind a conservative ceiling.
    return this.volume * MASTER_CEILING;
  }

  /* ------------------------------ public --------------------------- */

  /** Create/resume the graph. Safe to call from a click handler. */
  start(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    this.running = true;
    void ctx.resume().catch(() => undefined);
    // Autoplay policy: if the context is still suspended (page has had no
    // gesture since reload), retry on the first interaction anywhere.
    if (ctx.state === 'suspended') this.armResumeRetry();
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.masterValue(), ctx.currentTime, 0.25);
    if (this.scene && this.voices.length === 0) this.buildScene(this.scene);
  }

  /** Fade out and suspend (keeps the graph for a cheap restart). */
  stop(): void {
    this.running = false;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.clearLoops();
    for (const voice of this.voices) voice.fadeOutAndStop();
    this.voices = [];
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    window.setTimeout(() => {
      if (!this.running && this.ctx?.state === 'running') {
        void this.ctx.suspend().catch(() => undefined);
      }
    }, 600);
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.master && this.ctx && this.running) {
      this.master.gain.setTargetAtTime(this.masterValue(), this.ctx.currentTime, 0.1);
    }
  }

  /** Crossfade (0.8 s GainNode ramps) when the scene changes. */
  setScene(scene: AmbientSceneId | null): void {
    if (scene === this.scene) return;
    const ctx = this.ctx;
    this.scene = scene;
    if (!ctx || !this.running) return;
    this.clearLoops();
    const previous = this.voices;
    this.voices = [];
    for (const voice of previous) voice.fadeOutAndStop();
    if (scene) this.buildScene(scene);
  }

  dispose(): void {
    this.running = false;
    this.clearLoops();
    for (const voice of this.voices) voice.stopNow();
    this.voices = [];
    this.disarmResumeRetry();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.white = this.pink = this.brown = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  isRunning(): boolean {
    return this.running;
  }

  contextState(): string {
    return this.ctx?.state ?? 'closed';
  }

  /* ------------------------------ retry ---------------------------- */

  private armResumeRetry(): void {
    if (typeof window === 'undefined') return;
    const retry = () => {
      if (!this.ctx || !this.running) return this.disarmResumeRetry();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined);
        return; // keep listening — the policy may need a real gesture
      }
      this.disarmResumeRetry();
    };
    window.addEventListener('pointerdown', retry, { passive: true });
    window.addEventListener('keydown', retry);
    this.retryListeners = [() => window.removeEventListener('pointerdown', retry), () => window.removeEventListener('keydown', retry)];
  }

  private disarmResumeRetry(): void {
    this.retryListeners.forEach((off) => off());
    this.retryListeners = [];
  }

  /* --------------------------- scheduling -------------------------- */

  private scheduleLoop(loop: ScheduledLoop): void {
    const delay = loop.minMs + Math.random() * (loop.maxMs - loop.minMs);
    const id = window.setTimeout(() => {
      this.loops.delete(id);
      if (!this.running) return;
      loop.fire();
      if (this.running) this.scheduleLoop(loop);
    }, delay);
    this.loops.set(id, loop);
  }

  private clearLoops(): void {
    for (const id of this.loops.keys()) window.clearTimeout(id);
    this.loops.clear();
  }

  /* ----------------------------- voices ---------------------------- */

  private noiseBed(
    kind: 'white' | 'pink' | 'brown',
    target: number,
    filter: { type: BiquadFilterType; frequency: number; q?: number },
    lfo?: { hz: number; depth: number; frequency: number },
  ): Voice {
    const ctx = this.ctx as AudioContext;
    const master = this.master as GainNode;
    const buffer = kind === 'white' ? this.white : kind === 'pink' ? this.pink : this.brown;
    const src = ctx.createBufferSource();
    src.buffer = buffer as AudioBuffer;
    src.loop = true;

    const biquad = ctx.createBiquadFilter();
    biquad.type = filter.type;
    biquad.frequency.value = filter.frequency;
    if (filter.q !== undefined) biquad.Q.value = filter.q;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(biquad).connect(gain).connect(master);

    let lfoOsc: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (lfo) {
      lfoOsc = ctx.createOscillator();
      lfoOsc.frequency.value = lfo.hz;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = lfo.depth;
      lfoOsc.connect(lfoGain).connect(biquad.frequency);
      biquad.frequency.value = lfo.frequency;
      lfoOsc.start();
    }

    src.start();
    gain.gain.setTargetAtTime(target, ctx.currentTime, CROSSFADE_S / 3);

    return {
      level: target,
      fadeOutAndStop: () => {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setTargetAtTime(0, ctx.currentTime, CROSSFADE_S / 3);
        window.setTimeout(() => {
          try {
            src.stop();
            lfoOsc?.stop();
            src.disconnect();
            biquad.disconnect();
            gain.disconnect();
          } catch {
            // nodes already torn down — nothing to do
          }
        }, (CROSSFADE_S + 0.4) * 1000);
      },
      stopNow: () => {
        try {
          src.stop();
          lfoOsc?.stop();
          src.disconnect();
          biquad.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  /** One-shot sine blip (droplet plips, cricket pulses). */
  private blip(frequency: number, at: number, durationMs: number, level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    const startAt = ctx.currentTime + at;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(level, startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    osc.start(startAt);
    osc.stop(startAt + durationMs / 1000 + 0.05);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  /** Distant thunder — brown noise burst through a lowpass sweep + long decay. */
  private thunderBurst(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.brown) return;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(master);

    const t = ctx.currentTime + 0.05;
    // Sweep the lowpass down while the body decays (rumble afterglow).
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(70, t + 2.4);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 4.2);

    src.start(t);
    src.stop(t + 4.4);
    src.onended = () => {
      try {
        src.disconnect();
        lp.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  /** A swelling gust — temporary gain ride on a dedicated wind bed. */
  private gust(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.brown) return;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 480;
    lp.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(master);
    const t = ctx.currentTime + 0.05;
    const dur = 3 + Math.random() * 2.5;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + dur * 0.45);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    src.start(t);
    src.stop(t + dur + 0.1);
    src.onended = () => {
      try {
        src.disconnect();
        lp.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  /* ------------------------------ scenes --------------------------- */

  private buildScene(scene: AmbientSceneId): void {
    switch (scene) {
      case 'rain':
        this.buildRain(1, true);
        break;
      case 'drizzle':
        this.buildRain(0.45, false);
        break;
      case 'thunder':
        this.buildRain(0.8, false);
        // Distant thunder, loosely coupled to the scene's lightning layer
        // (SceneLayers strikes every 6–14 s; this runs 9–22 s — the two
        // randomized schedules drift in and out of phase on purpose).
        this.scheduleLoop({
          minMs: 9000,
          maxMs: 22000,
          fire: () => this.thunderBurst(),
        });
        break;
      case 'night':
        // Very soft night bed + sparse crickets (clear / partly nights).
        this.voices.push(
          this.noiseBed('brown', 0.05, { type: 'lowpass', frequency: 240 }, { hz: 0.045, depth: 70, frequency: 220 }),
        );
        this.scheduleLoop({
          minMs: 1600,
          maxMs: 4200,
          fire: () => {
            // 2–3 quick sine pulses around 4.2 kHz.
            const pulses = 2 + Math.floor(Math.random() * 2);
            const base = 4150 + Math.random() * 140;
            for (let p = 0; p < pulses; p += 1) {
              this.blip(base + p * 90, p * 0.034, 22, 0.022);
            }
          },
        });
        break;
      case 'snow':
        // Muffled hush — quiet wind bed, no crickets.
        this.voices.push(
          this.noiseBed('brown', 0.035, { type: 'lowpass', frequency: 170 }, { hz: 0.03, depth: 40, frequency: 160 }),
        );
        break;
      case 'wind':
        // Brown-noise bed with a slow LFO on the lowpass + gust swells.
        this.voices.push(
          this.noiseBed('brown', 0.07, { type: 'lowpass', frequency: 420 }, { hz: 0.07, depth: 180, frequency: 330 }),
        );
        this.scheduleLoop({ minMs: 12000, maxMs: 30000, fire: () => this.gust() });
        break;
      case 'fog':
        // Low warm pad, minimal.
        this.voices.push(this.noiseBed('pink', 0.03, { type: 'lowpass', frequency: 320, q: 0.5 }));
        break;
      case 'breeze':
        // Gentle breeze bed at low volume (day variants) — never annoying.
        this.voices.push(
          this.noiseBed('brown', 0.028, { type: 'lowpass', frequency: 330 }, { hz: 0.05, depth: 90, frequency: 300 }),
        );
        this.scheduleLoop({ minMs: 24000, maxMs: 55000, fire: () => this.gust() });
        break;
      default:
        break;
    }
  }

  private buildRain(strength: number, heavy: boolean): void {
    // Filtered noise bed (~1–4 kHz) + random droplet plips.
    this.voices.push(
      this.noiseBed('pink', 0.14 * strength, { type: 'bandpass', frequency: 1600, q: 0.4 }),
      this.noiseBed('white', 0.035 * strength, { type: 'bandpass', frequency: 4200, q: 0.9 }),
    );
    this.scheduleLoop({
      minMs: 260,
      maxMs: 850,
      fire: () => {
        const freq = 1900 + Math.random() * 2400;
        this.blip(freq, 0, 34 + Math.random() * 30, (0.02 + Math.random() * 0.028) * strength);
      },
    });
    if (heavy) {
      // Occasional soft rumble when precipitation is heavy.
      this.scheduleLoop({ minMs: 25000, maxMs: 48000, fire: () => this.thunderBurst() });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Module singleton + imperative helpers (client-only by construction) */
/* ------------------------------------------------------------------ */

let engine: AmbientEngine | null = null;

interface AmbientDebugHandle {
  state: () => string;
  running: () => boolean;
}

export function getAmbientEngine(): AmbientEngine {
  if (!engine) {
    engine = new AmbientEngine();
    // Debug/QA handle: lets the devtools console (and agent-browser) read
    // the engine state without importing the module. Read-only by convention.
    if (typeof window !== 'undefined') {
      try {
        (window as Window & { __aetherAmbient?: AmbientDebugHandle }).__aetherAmbient = {
          state: () => engine?.contextState() ?? 'closed',
          running: () => engine?.isRunning() ?? false,
        };
      } catch {
        // non-fatal — skip the debug handle
      }
    }
  }
  return engine;
}

/** Exposed for tests / debugging: current AudioContext state. */
export function ambientContextState(): string {
  return engine ? engine.contextState() : 'closed';
}
