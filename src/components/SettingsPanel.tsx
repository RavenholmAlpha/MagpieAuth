import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Upload, Info, Shield } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function SettingsPanel({ isOpen, onClose, onExport, onImport }: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Panel (Bottom Sheet) */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50 h-[80vh] glass-strong rounded-t-3xl
                       border-t border-x border-border-subtle flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative flex items-center justify-center px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-white/10" />
              <h2 className="text-[17px] font-semibold text-primary mt-1">Settings</h2>
              <button
                onClick={onClose}
                className="absolute right-6 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] transition-colors duration-200 cursor-pointer shrink-0"
                title="Close settings"
              >
                <X className="w-4 h-4 text-muted" strokeWidth={2} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Data Management */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  Data Management
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={onExport}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl
                               glass-surface border-white/5 shadow-inner
                               hover:bg-white/[0.06] hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  >
                    <Download className="w-4 h-4 text-muted group-hover:text-primary transition-colors" strokeWidth={1.5} />
                    <div className="text-left">
                      <p className="text-sm text-primary/90">Export Vault</p>
                      <p className="text-[10px] text-muted-dark mt-0.5">Create encrypted .magpie backup</p>
                    </div>
                  </button>
                  <button
                    onClick={onImport}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl
                               glass-surface border-white/5 shadow-inner
                               hover:bg-white/[0.06] hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  >
                    <Upload className="w-4 h-4 text-muted group-hover:text-primary transition-colors" strokeWidth={1.5} />
                    <div className="text-left">
                      <p className="text-sm text-primary/90">Import Vault</p>
                      <p className="text-[10px] text-muted-dark mt-0.5">Restore from .magpie backup</p>
                    </div>
                  </button>
                </div>
              </section>

              {/* Security */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  Security
                </h3>
                <div className="rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-xs text-primary/80">System Authentication</span>
                  </div>
                  <p className="text-[10px] text-muted-dark leading-relaxed">
                    MagpieAuth uses your system's PIN / Windows Hello for identity verification.
                    Passwords are encrypted with AES-256-GCM and the master key is protected
                    by your OS credential manager.
                  </p>
                </div>
              </section>

              {/* About */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  About
                </h3>
                <div className="rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-xs text-primary/80">MagpieAuth v0.1.0</span>
                  </div>
                  <p className="text-[10px] text-muted-dark leading-relaxed">
                    A lightweight, local-first password & 2FA manager. All data stays on your device.
                    No cloud. No telemetry. Just security.
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
