import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, LogOut, MinusSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CloseConfirmDialogProps {
  isOpen: boolean;
  onExit: () => void;
  onMinimizeToTray: () => void;
  onCancel: () => void;
}

export function CloseConfirmDialog({ isOpen, onExit, onMinimizeToTray, onCancel }: CloseConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-[320px] bg-background/90 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-border-subtle shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 pb-5 flex flex-col items-center text-center relative">
              <button
                onClick={onCancel}
                className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 cursor-pointer text-muted hover:text-primary"
                title="Cancel"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>

              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
                <AlertCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-[17px] font-semibold text-primary mb-2">
                {t("closeConfirm.title", "Close Application")}
              </h3>
              <p className="text-[13px] text-muted leading-relaxed">
                {t("closeConfirm.desc", "Do you want to exit the application completely or run in the background?")}
              </p>
            </div>
            <div className="flex border-t border-border-subtle bg-black/5 dark:bg-black/20">
              <button
                onClick={onMinimizeToTray}
                className="flex-1 py-4 flex flex-col items-center justify-center gap-1.5 text-[13px] font-medium text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 text-center"
              >
                <MinusSquare className="w-4 h-4" />
                {t("closeConfirm.minimize", "Minimize to Tray")}
              </button>
              <div className="w-[1px] bg-border-subtle" />
              <button
                onClick={onExit}
                className="flex-1 py-4 flex flex-col items-center justify-center gap-1.5 text-[13px] font-semibold text-danger-text hover:bg-danger-text/10 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                {t("closeConfirm.exit", "Exit completely")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
