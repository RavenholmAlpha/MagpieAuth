import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Upload, Info, Shield, Clock, Globe, Sun, Moon, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";
import { checkSystemAuthAvailable } from "../lib/tauri-api";
import { AlertCircle } from "lucide-react";
import type { LockMode, AuthMethod } from "../App";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  lockMode: LockMode;
  onLockModeChange: (mode: LockMode) => void;
  lockTimeoutMs: number;
  onLockTimeoutChange: (ms: number) => void;
  authMethod: AuthMethod;
  onAuthMethodChange: (method: AuthMethod) => void;
  onOpenPatternSetup: () => void;
  globalShortcut: string;
  onGlobalShortcutChange: (shortcut: string) => void;
  closeBehavior: "close" | "tray" | "ask";
  onCloseBehaviorChange: (behavior: "close" | "tray" | "ask") => void;
  onManageLabels?: () => void;
}

export function SettingsPanel({ 
  isOpen, 
  onClose, 
  onExport, 
  onImport,
  lockMode,
  onLockModeChange,
  lockTimeoutMs,
  onLockTimeoutChange,
  authMethod,
  onAuthMethodChange,
  onOpenPatternSetup,
  globalShortcut,
  onGlobalShortcutChange,
  closeBehavior,
  onCloseBehaviorChange
}: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("magpie_language", lang);
  };

  const [systemAuthAvailable, setSystemAuthAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkSystemAuthAvailable()
      .then((avail) => setSystemAuthAvailable(avail))
      .catch(() => setSystemAuthAvailable(false));
  }, []);

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
              <h2 className="text-[17px] font-semibold text-primary mt-1">{t("settings.title")}</h2>
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
              
              {/* Language */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  {t("settings.language")}
                </h3>
                <div className="rounded-2xl glass-surface border-white/5 shadow-inner p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-xs text-primary/80">{t("settings.chooseLanguage")}</span>
                  </div>
                  <div className="flex bg-surface-sunken p-1 rounded-xl border border-border-subtle">
                    <button
                      onClick={() => handleLanguageChange("en")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${i18n.language === "en" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted"}`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => handleLanguageChange("zh")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${i18n.language === "zh" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted"}`}
                    >
                      中文
                    </button>
                  </div>
                </div>
              </section>

              {/* Appearance / Theme */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  {t("settings.appearance", "Appearance")}
                </h3>
                <div className="rounded-2xl glass-surface border-white/5 shadow-inner p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Monitor className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-xs text-primary/80">{t("settings.theme", "Theme")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-surface-sunken p-1 rounded-xl border border-border-subtle">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 capitalize ${theme === "light" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted hover:bg-white/5"}`}
                    >
                      <Sun className="w-3.5 h-3.5" /> {t("settings.light", "Light")}
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 capitalize ${theme === "dark" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted hover:bg-white/5"}`}
                    >
                      <Moon className="w-3.5 h-3.5" /> {t("settings.dark", "Dark")}
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 capitalize ${theme === "system" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted hover:bg-white/5"}`}
                    >
                      <Monitor className="w-3.5 h-3.5" /> {t("settings.system", "System")}
                    </button>
                  </div>
                </div>
              </section>

              {/* Data Management */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  {t("settings.dataManagement")}
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
                      <p className="text-sm text-primary/90">{t("settings.exportVault")}</p>
                      <p className="text-[10px] text-muted-dark mt-0.5">{t("settings.exportDesc")}</p>
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
                      <p className="text-sm text-primary/90">{t("settings.importVault")}</p>
                      <p className="text-[10px] text-muted-dark mt-0.5">{t("settings.importDesc")}</p>
                    </div>
                  </button>
                </div>
              </section>

              {/* Security & Auto-Lock */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  {t("settings.securityAutoLock")}
                </h3>
                <div className="space-y-4 rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-muted" strokeWidth={1.5} />
                      <span className="text-xs text-primary/80">{t("settings.authMethod")}</span>
                    </div>

                    <div className="flex bg-surface-sunken p-1 rounded-xl border border-border-subtle mb-2">
                       <button
                         onClick={() => onAuthMethodChange("system")}
                         disabled={systemAuthAvailable === false}
                         className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 
                           ${authMethod === "system" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted"}
                           ${systemAuthAvailable === false ? "opacity-40 cursor-not-allowed" : ""}`}
                         title={systemAuthAvailable === false ? "System Authentication is not available on this device" : ""}
                       >
                         {t("settings.systemAuth")}
                         {systemAuthAvailable === false && <AlertCircle className="inline-block w-3 h-3 ml-1 text-danger-text/70" />}
                       </button>
                       <button
                         onClick={() => onAuthMethodChange("pattern")}
                         className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${authMethod === "pattern" ? "bg-white/10 text-primary shadow-sm" : "text-muted-dark hover:text-muted"}`}
                       >
                         {t("settings.patternAuth")}
                       </button>
                    </div>
                    
                    <AnimatePresence>
                      {authMethod === "pattern" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                           <button onClick={onOpenPatternSetup} className="w-full py-2 bg-white/[0.05] hover:bg-white/[0.08] active:bg-white/[0.04] transition-colors border border-white/[0.05] shadow-sm rounded-lg text-xs font-medium text-primary cursor-pointer mb-2">
                             {t("settings.setPattern")}
                           </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="text-[10px] text-muted-dark leading-relaxed mb-4">
                      {authMethod === "system" ? t("settings.systemAuthDesc") : t("settings.patternAuthDesc")}
                    </p>

                    <div className="h-px w-full bg-white/5 my-3" />

                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-muted" strokeWidth={1.5} />
                      <span className="text-xs text-primary/80">{t("settings.autoLockBehavior")}</span>
                    </div>
                    
                    {/* Mode Selector */}
                    <div className="grid grid-cols-3 gap-2 bg-surface-sunken p-1 rounded-xl border border-border-subtle">
                      {(["strict", "normal", "relaxed"] as LockMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => onLockModeChange(mode)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 capitalize
                            ${lockMode === mode 
                              ? "bg-white/10 text-primary shadow-sm" 
                              : "text-muted-dark hover:text-muted hover:bg-white/5"}`}
                        >
                          {t(`settings.${mode}`)}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-dark leading-relaxed">
                      {lockMode === "strict" && t("settings.strictDesc")}
                      {lockMode === "normal" && t("settings.normalDesc")}
                      {lockMode === "relaxed" && t("settings.relaxedDesc")}
                    </p>

                    {/* Timeout Slider (Hidden in Relaxed mode) */}
                    <AnimatePresence>
                      {lockMode !== "relaxed" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-2 overflow-hidden"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] text-muted">{t("settings.idleTimeout")}</span>
                            <span className="text-[11px] text-primary/80 font-mono">
                              {lockTimeoutMs / 1000}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min="15"
                            max="300"
                            step="15"
                            value={lockTimeoutMs / 1000}
                            onChange={(e) => onLockTimeoutChange(parseInt(e.target.value) * 1000)}
                            className="w-full h-1.5 bg-surface-sunken rounded-lg appearance-none cursor-pointer
                                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                                     [&::-webkit-slider-thumb]:bg-white/80 [&::-webkit-slider-thumb]:shadow-md"
                          />
                          <div className="flex justify-between mt-1 px-1">
                            <span className="text-[9px] text-muted-dark">15s</span>
                            <span className="text-[9px] text-muted-dark">5m</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </section>

              {/* General / Advanced Settings */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  {t("settings.advanced")}
                </h3>
                <div className="rounded-2xl glass-surface border-white/5 shadow-inner p-5 space-y-6">
                  {/* Close Behavior */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-primary/80">{t("settings.closeBehavior", "Close Button Behavior")}</span>
                    <div className="grid grid-cols-3 gap-2 bg-surface-sunken p-1 rounded-xl border border-border-subtle">
                      {(["close", "tray", "ask"] as const).map((behavior) => (
                        <button
                          key={behavior}
                          onClick={() => onCloseBehaviorChange(behavior)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 capitalize
                            ${closeBehavior === behavior 
                              ? "bg-white/10 text-primary shadow-sm" 
                              : "text-muted-dark hover:text-muted hover:bg-white/5"}`}
                        >
                          {t(`settings.closeBehavior_${behavior}`, behavior === "tray" ? "Minimize to Tray" : behavior)}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-dark mt-1 leading-relaxed">
                      {t("settings.closeBehaviorDesc", "Choose what happens when you click the window close (X) button.")}
                    </p>
                  </div>

                  {/* Global Shortcut */}
                  <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
                    <span className="text-xs text-primary/80">{t("settings.globalShortcut", "Global Shortcut")}</span>
                    <input
                      type="text"
                      className="w-full bg-surface-sunken border border-border-subtle rounded-lg px-3 py-2 text-xs text-primary/90 font-mono tracking-wide placeholder:text-muted-dark focus:outline-none focus:border-primary transition-colors cursor-pointer select-text"
                      value={globalShortcut}
                      readOnly
                      onKeyDown={(e) => {
                        e.preventDefault();
                        if (e.key === "Escape") {
                          e.currentTarget.blur();
                          return;
                        }
                        if (e.key === "Backspace" || e.key === "Delete") {
                          onGlobalShortcutChange("");
                          return;
                        }
                        const modifiers = [];
                        if (e.ctrlKey || e.metaKey) modifiers.push("CommandOrControl");
                        if (e.shiftKey) modifiers.push("Shift");
                        if (e.altKey) modifiers.push("Alt");
                        if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
                        
                        let key = e.key.toUpperCase();
                        if (key === " ") key = "Space";
                        
                        // Mapping some common symbols
                        if (key === "+" || key === "=") key = "Plus";
                        if (key === "-") key = "Minus";
                        
                        const shortcut = [...modifiers, key].join("+");
                        onGlobalShortcutChange(shortcut);
                        e.currentTarget.blur();
                      }}
                      placeholder={t("settings.shortcutPlaceholder", "Click and press keys to set shortcut (Backspace to clear)")}
                      title={t("settings.globalShortcutDesc", "Set a global shortcut to quickly show or hide the application window.")}
                    />
                    <p className="text-[10px] text-muted-dark mt-1 leading-relaxed">
                      {t("settings.globalShortcutDesc", "Set a global shortcut to quickly show or hide the application window.")}
                    </p>
                  </div>
                </div>
              </section>

              {/* About */}
              <section>
                <h3 className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1 mb-3">
                  {t("settings.about")}
                </h3>
                <div className="rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-xs text-primary/80">{t("app.title")} v0.1.0</span>
                  </div>
                  <p className="text-[10px] text-muted-dark leading-relaxed">
                    {t("settings.aboutDesc")}
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
