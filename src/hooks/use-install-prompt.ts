'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/* Minimal shape of the Chromium beforeinstallprompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const emptySubscribe = () => () => {};

/** True when running as an installed app (PWA standalone display mode). */
function useIsStandalone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(display-mode: standalone)');
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

/** True on iPhone/iPad — those never fire beforeinstallprompt. */
function useIsIOS(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () =>
      /iPad|iPhone|iPod/.test(navigator.platform) ||
      (navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform)),
    () => false,
  );
}

export interface InstallPromptState {
  /** Chromium captured the deferred prompt — an Install button can run. */
  canInstall: boolean;
  /** Running as an installed app already (standalone display mode). */
  isStandalone: boolean;
  /** iPhone/iPad — no beforeinstallprompt; needs the manual Share flow. */
  isIOS: boolean;
  /** Install flow finished successfully (appinstalled or accepted choice). */
  installed: boolean;
  /** Trigger the browser install dialog (no-op when canInstall is false). */
  install: () => void;
}

/**
 * PWA install plumbing. Chromium fires beforeinstallprompt with a deferrable
 * event; iOS Safari never does (manual Share → Add to Home Screen). Every
 * environment-derived flag goes through useSyncExternalStore so the server
 * render and the first client render agree (no hydration mismatch).
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isStandalone = useIsStandalone();
  const isIOS = useIsIOS();

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep the browser's own mini-banner out of the UI
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;
    void deferred
      .prompt()
      .then(() => deferred.userChoice)
      .then((choice) => {
        if (choice.outcome === 'accepted') setInstalled(true);
        setDeferred(null); // the event is single-use either way
      })
      .catch(() => setDeferred(null));
  }, [deferred]);

  return {
    canInstall: deferred != null && !installed,
    isStandalone,
    isIOS,
    installed,
    install,
  };
}
