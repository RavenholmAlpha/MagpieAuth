import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Grid, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { checkSystemAuthAvailable } from "../lib/tauri-api";
import { useTheme } from "../hooks/useTheme";
import { PatternSetupDialog } from "./PatternSetupDialog";
import type { AuthMethod } from "../App";

interface SetupWizardProps {
  onComplete: (method: AuthMethod) => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation();
  const { actualTheme } = useTheme();
  const [systemAuthAvailable, setSystemAuthAvailable] = useState<boolean | null>(null);
  const [showPatternSetup, setShowPatternSetup] = useState(false);

  useEffect(() => {
    checkSystemAuthAvailable()
      .then((available) => setSystemAuthAvailable(available))
      .catch(() => setSystemAuthAvailable(false));
  }, []);

  const handleSystemSelect = () => {
    if (systemAuthAvailable) {
      onComplete("system");
    }
  };

  const handlePatternSelect = () => {
    setShowPatternSetup(true);
  };

  const handlePatternSetupSuccess = () => {
    setShowPatternSetup(false);
    onComplete("pattern");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-3xl overflow-hidden"
      >
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03] -top-[10%] -right-[10%] bg-[radial-gradient(circle,#ffffff_0%,transparent_70%)]" />
          <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.02] bottom-[0%] -left-[10%] bg-[radial-gradient(circle,#ffffff_0%,transparent_70%)]" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 max-w-sm mx-auto w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col items-center text-center mb-10"
          >
            <div className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center mb-6 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
              <img
                src={actualTheme === "dark" ? "/MPAW.png" : "/MPA.png"}
                alt="MagpieAuth Logo"
                className="w-14 h-14 object-contain relative z-10"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-primary mb-2">
              Welcome to MagpieAuth
            </h1>
            <p className="text-sm text-muted">
              Secure your vault. Choose how you want to unlock your data.
            </p>
          </motion.div>

          {/* Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full space-y-4"
          >
            {/* System Auth Option */}
            <button
              onClick={handleSystemSelect}
              disabled={systemAuthAvailable === false}
              className={`w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all duration-300
                ${
                  systemAuthAvailable === false
                    ? "bg-surface/30 border-border-subtle/50 opacity-60 cursor-not-allowed"
                    : "glass-panel hover:bg-white/[0.04] cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
                }
              `}
            >
              <div
                className={`p-3 rounded-xl flex-shrink-0 ${
                  systemAuthAvailable === false ? "bg-surface" : "bg-primary/10 text-primary"
                }`}
              >
                <Fingerprint className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-primary text-sm mb-1 flex items-center gap-2">
                  System Authentication
                  {systemAuthAvailable === false && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-danger-text bg-danger/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> Unsupported
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-dark leading-relaxed">
                  Use Windows Hello, PIN, or Biometrics. Recommended for max convenience.
                </p>
              </div>
            </button>

            {/* Pattern Lock Option */}
            <button
              onClick={handlePatternSelect}
              className="w-full flex items-start gap-4 p-5 rounded-2xl border glass-panel text-left transition-all duration-300 hover:bg-white/[0.04] cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="p-3 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                <Grid className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-primary text-sm mb-1">
                  Pattern Lock
                </h3>
                <p className="text-xs text-muted-dark leading-relaxed">
                  Draw a secure 3x3 pattern. Works across all devices independently.
                </p>
              </div>
            </button>
          </motion.div>

          {/* Footer Security Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-auto pt-8 pb-4 flex items-center justify-center gap-2 text-muted-dark/60 text-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Encrypted locally with military-grade AES-GCM</span>
          </motion.div>
        </div>
      </motion.div>

      {/* Embedded Pattern Setup */}
      {showPatternSetup && (
        <PatternSetupDialog
          isOpen={showPatternSetup}
          onClose={() => setShowPatternSetup(false)}
          onSetSuccess={handlePatternSetupSuccess}
        />
      )}
    </>
  );
}
