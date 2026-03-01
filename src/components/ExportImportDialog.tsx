import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Upload, FileKey } from "lucide-react";
import { useTranslation } from "react-i18next";
import { exportVault, importVault } from "../lib/tauri-api";

interface ExportImportDialogProps {
  isOpen: boolean;
  mode: "export" | "import";
  onClose: () => void;
  onComplete: (message: string) => void;
}

export function ExportImportDialog({ isOpen, mode, onClose, onComplete }: ExportImportDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [filePath, setFilePath] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Use dialog to pick save location
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: "magpieauth_backup.magpie",
        filters: [{ name: "MagpieAuth Backup", extensions: ["magpie"] }],
      });
      
      if (path) {
        await exportVault(password, path);
        onComplete(t("exportImport.exportSuccess"));
        onClose();
      }
    } catch (e: any) {
      setError(e?.toString() || "Export failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!password) {
      setError("Please enter the backup password");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        filters: [{ name: "MagpieAuth Backup", extensions: ["magpie"] }],
        multiple: false,
      });

      if (path) {
        const count = await importVault(path as string, password);
        onComplete(`${count} ${t("exportImport.importSuccess")}`);
        onClose();
      }
    } catch (e: any) {
      setError(e?.toString() || "Import failed. Wrong password?");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50 glass-strong rounded-t-3xl
                       border-t border-x border-border-subtle shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="relative flex items-center justify-center px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-white/10" />
              <div className="flex items-center gap-2 mt-1">
                {mode === "export" ? (
                  <Download className="w-4 h-4 text-muted" strokeWidth={1.5} />
                ) : (
                  <Upload className="w-4 h-4 text-muted" strokeWidth={1.5} />
                )}
                <h2 className="text-[17px] font-semibold text-primary">
                  {mode === "export" ? t("exportImport.exportTitle") : t("exportImport.importTitle")}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="absolute right-6 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] transition-colors duration-200 cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4 text-muted" strokeWidth={2} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-2xl glass-surface border-white/5 shadow-inner">
                <FileKey className="w-5 h-5 text-muted shrink-0" strokeWidth={1.5} />
                <p className="text-xs text-muted leading-relaxed">
                  {mode === "export" ? t("exportImport.exportDesc") : t("exportImport.importDesc")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1">
                  {t("exportImport.passwordLabel")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("exportImport.passwordPlaceholder")}
                  className="w-full px-4 py-3.5 rounded-xl text-[15px]
                             glass-surface border-white/5 shadow-inner text-primary
                             placeholder:text-muted-dark/50
                             focus:border-white/20 focus:bg-white/[0.05]
                             transition-all duration-300 outline-none"
                />
              </div>

              {mode === "export" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3.5 rounded-xl text-[15px]
                               glass-surface border-white/5 shadow-inner text-primary
                               placeholder:text-muted-dark/50
                               focus:border-white/20 focus:bg-white/[0.05]
                               transition-all duration-300 outline-none"
                  />
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-danger-text"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-border-subtle flex gap-3 pb-8 shrink-0 bg-background/50 backdrop-blur-md">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-dark
                           bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle
                           transition-colors duration-200 cursor-pointer"
              >
                {t("exportImport.cancel")}
              </button>
              <button
                onClick={mode === "export" ? handleExport : handleImport}
                disabled={processing || !password}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-background
                           bg-primary/90 hover:bg-primary
                           shadow-[0_0_15px_rgba(255,255,255,0.15)]
                           transition-all duration-200 cursor-pointer
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processing
                  ? "..."
                  : mode === "export"
                  ? t("exportImport.exportBtn")
                  : t("exportImport.importBtn")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
