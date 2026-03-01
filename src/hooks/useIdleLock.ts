import { useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { LockMode } from "../App";

/**
 * Hook that locks the app according to the specified LockMode and timeout.
 */
export function useIdleLock(onLock: () => void, mode: LockMode, timeoutMs: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Only schedule auto-lock if we are in normal or strict mode
    if (mode !== "relaxed") {
      timerRef.current = setTimeout(onLock, timeoutMs);
    }
  }, [onLock, timeoutMs, mode]);

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
    if (mode !== "relaxed") {
      events.forEach((event) => {
        window.addEventListener(event, resetTimer, { passive: true });
      });
    }

    // Native Window Blur Listener (Alt+Tab / clicking away)
    // Only active in "strict" mode
    let unlistenBlur: (() => void) | null = null;
    let unlistenFocus: (() => void) | null = null;
    let blurTimeout: ReturnType<typeof setTimeout> | null = null;

    if (mode === "strict") {
      const win = getCurrentWindow();

      win.listen("tauri://blur", () => {
        blurTimeout = setTimeout(() => {
          onLock();
        }, 200); // 200ms grace period for drag operations
      }).then(unlisten => {
        unlistenBlur = unlisten;
      }).catch(console.error);

      win.listen("tauri://focus", () => {
        if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
        }
      }).then(unlisten => {
        unlistenFocus = unlisten;
      }).catch(console.error);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (blurTimeout) {
        clearTimeout(blurTimeout);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      if (unlistenBlur) unlistenBlur();
      if (unlistenFocus) unlistenFocus();
    };
  }, [resetTimer, onLock]);
}
