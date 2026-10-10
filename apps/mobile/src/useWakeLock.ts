import { useEffect } from 'react';

/** Keeps the phone screen on while `active` (Wake Lock API; silently does nothing where unsupported). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        // Refused by the browser (battery saver, …): the game still works.
        .catch(() => {});
    };
    acquire();
    // The browser drops the lock when the tab is hidden: take it again when the player comes back.
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [active]);
}
