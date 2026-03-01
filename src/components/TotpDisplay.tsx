import { useEffect, useState, useCallback } from "react";
import { getRemainingSeconds } from "../lib/tauri-api";

interface TotpDisplayProps {
  itemId: string;
  getTotpCode: (id: string) => Promise<{ success: boolean; code?: string | null; validUntil?: number | null; step?: number | null; error?: string | null }>;
}

export function TotpDisplay({ itemId, getTotpCode }: TotpDisplayProps) {
  const [code, setCode] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [period, setPeriod] = useState(30);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const fetchCode = useCallback(async () => {
    try {
      const result = await getTotpCode(itemId);
      if (result.success && result.code) {
        setIsTransitioning(true);
        setTimeout(() => {
          setCode(result.code!);
          setIsTransitioning(false);
        }, 150);

        setTimeout(() => {
          setCode(result.code!);
          setIsTransitioning(false);
        }, 150);

        if (result.step) {
          setPeriod(result.step);
        }

        if (result.validUntil) {
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((result.validUntil - now) / 1000));
          setRemainingSeconds(remaining);
        }
      }
    } catch {
      // ignore
    }
  }, [itemId, getTotpCode]);

  // Initial fetch
  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          fetchCode();
          return period;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchCode, period]);

  const progress = remainingSeconds / period;
  const circumference = 2 * Math.PI * 34; // r=34
  const dashoffset = circumference * (1 - progress);

  const formatCode = (c: string) => {
    if (c.length === 6) return `${c.slice(0, 3)} ${c.slice(3)}`;
    return c;
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      {/* Circular countdown */}
      <div className="relative w-[76px] h-[76px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50" cy="50" r="34"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="5"
          />
          {/* Progress circle */}
          <circle
            cx="50" cy="50" r="34"
            fill="none"
            stroke={remainingSeconds <= 5 ? "rgba(252,165,165,0.8)" : "rgba(255,255,255,0.6)"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* Seconds in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[15px] font-medium tracking-tight ${remainingSeconds <= 5 ? "text-danger-text" : "text-primary/90"}`}>
            {remainingSeconds}s
          </span>
        </div>
      </div>

      {/* TOTP Code Display */}
      <div
        className={`flex gap-3 text-[32px] font-semibold tracking-widest text-primary
                     transition-opacity duration-150 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
      >
        {code ? (
          <>
            <span>{code.slice(0, 3)}</span>
            <span>{code.slice(3)}</span>
          </>
        ) : (
          <span>--- ---</span>
        )}
      </div>
    </div>
  );
}
