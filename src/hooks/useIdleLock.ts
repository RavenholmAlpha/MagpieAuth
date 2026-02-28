import { useEffect, useRef, useCallback } from "react";

/**
 * Hook that locks the app after `timeoutMs` of user inactivity.
 * Tracks mouse move, keydown, click, and scroll events.
 */
export function useIdleLock(onLock: () => void, timeoutMs: number = 5 * 60 * 1000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(onLock, timeoutMs);
  }, [onLock, timeoutMs]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "mousedown",
      "scroll",
      "touchstart"
    ];

    // Start the timer
    resetTimer();

    // Reset on any user activity
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]);
}
