import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PatternLock } from "./PatternLock";
import { setPatternLock } from "../lib/tauri-api";

interface PatternSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSetSuccess: () => void;
}

type Step = "draw" | "confirm";

export function PatternSetupDialog({ isOpen, onClose, onSetSuccess }: PatternSetupDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("draw");
  const [firstPattern, setFirstPattern] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep("draw");
      setFirstPattern([]);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const handlePatternComplete = async (pattern: number[]) => {
    if (step === "draw") {
      if (pattern.length < 4) {
        setErrorMsg(t("patternSetup.tooShort"));
        setTimeout(() => setErrorMsg(null), 2000);
        return;
      }
      setFirstPattern(pattern);
      setStep("confirm");
      setErrorMsg(null);
    } else {
      // Confirm step
      if (pattern.join(",") === firstPattern.join(",")) {
        // Match! Save it
        try {
          await setPatternLock(JSON.stringify(pattern));
          onSetSuccess();
        } catch (e: any) {
          setErrorMsg(e.toString());
        }
      } else {
        // Mismatch
        setErrorMsg(t("patternSetup.mismatch"));
        setTimeout(() => setErrorMsg(null), 2000);
        setStep("draw");
        setFirstPattern([]);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-[90%] max-w-[340px] glass-strong rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col items-center"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <ShieldCheck className="w-10 h-10 text-primary/80 mb-4" strokeWidth={1.5} />
            
            <h3 className="text-sm font-medium text-primary mb-1 text-center">
              {step === "draw" ? t("patternSetup.drawTitle") : t("patternSetup.confirmTitle")}
            </h3>
            
            <p className="text-xs text-muted-dark text-center mb-6 h-4">
              {errorMsg ? (
                <span className="text-danger flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errorMsg}
                </span>
              ) : step === "draw" ? (
                t("patternSetup.drawDesc")
              ) : (
                t("patternSetup.confirmDesc")
              )}
            </p>

            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 relative">
              <PatternLock 
                onComplete={handlePatternComplete} 
                error={errorMsg}
                size={240} 
                gridSize={4} 
              />
            </div>
            
            <div className="flex justify-center gap-1 mt-6">
                <div className={`w-2 h-2 rounded-full transition-colors ${step === "draw" ? "bg-primary" : "bg-white/20"}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === "confirm" ? "bg-primary" : "bg-white/20"}`} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
