import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import { verifySystemAuth, verifyPatternLock } from "../lib/tauri-api";
import { useTheme } from "../hooks/useTheme";
import { PatternLock } from "./PatternLock";
import type { AuthMethod } from "../App";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const { t } = useTranslation();
  const { actualTheme } = useTheme();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  
  const authMethod: AuthMethod = (localStorage.getItem("magpie_auth_method") as AuthMethod) || "system";

  const handleSystemUnlock = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      const result = await verifySystemAuth();
      if (result) {
        setUnlocked(true);
        setTimeout(onUnlock, 600);
      } else {
        setError("Authentication denied");
      }
    } catch (e) {
      setError("Authentication failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePatternComplete = async (pattern: number[]) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      const result = await verifyPatternLock(JSON.stringify(pattern));
      if (result) {
        setUnlocked(true);
        setTimeout(onUnlock, 400);
      } else {
        setError(t("lockScreen.wrongPattern"));
      }
    } catch (e: any) {
      if (e.includes("No pattern set")) {
        setError(t("lockScreen.noPatternFallback"));
      } else {
        setError(t("lockScreen.authFailed"));
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence>
      {!unlocked && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-[40px]"
        >
          {/* Subtle gradient circles in background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-[0.03] top-[20%] left-[30%] bg-[radial-gradient(circle,#ffffff_0%,transparent_70%)]"
            />
            <div
              className="absolute w-[400px] h-[400px] rounded-full opacity-[0.02] bottom-[10%] right-[20%] bg-[radial-gradient(circle,#ffffff_0%,transparent_70%)]"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col items-center gap-8 relative z-10"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center overflow-hidden">
                <img src={actualTheme === "dark" ? "/MPAW.png" : "/MPA.png"} alt="MagpieAuth Logo" className="w-16 h-16 object-contain" />
              </div>
              <div
                className="absolute -inset-1 rounded-2xl opacity-20 bg-gradient-to-br from-white/10 to-transparent"
              />
            </motion.div>

            {/* App Name */}
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-primary">
                {t("app.title")}
              </h1>
              <p className="text-sm text-muted mt-1.5 font-light">
                {t("lockScreen.welcome")}
              </p>
            </div>

            {authMethod === "pattern" ? (
              <div className="bg-surface-sunken rounded-2xl p-4 border border-border-subtle relative mb-2">
                <PatternLock 
                  onComplete={handlePatternComplete} 
                  error={error} 
                  size={240} 
                  gridSize={4} 
                />
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSystemUnlock}
                disabled={isVerifying}
                className="flex items-center gap-3 px-8 py-3.5 rounded-xl glass-strong
                           text-primary text-sm font-medium cursor-pointer
                           transition-all duration-300 hover:bg-white/[0.08]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Fingerprint className="w-5 h-5 opacity-70" strokeWidth={1.5} />
                {isVerifying ? t("lockScreen.unlocking") : t("lockScreen.unlock")}
              </motion.button>
            )}

            {/* Hint / Error */}
            <AnimatePresence>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-danger-text text-xs"
                >
                  {error}
                </motion.p>
              ) : (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-muted-dark text-xs mt-2"
                >
                  {authMethod === "pattern" ? t("lockScreen.enterPattern") : t("lockScreen.enterPin")}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
