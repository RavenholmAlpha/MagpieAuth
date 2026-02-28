import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, RefreshCw, QrCode } from "lucide-react";
import { addItem, updateItem, parseOtpauthUri } from "../lib/tauri-api";
import { generatePassword } from "../lib/utils";
import { evaluatePasswordStrength } from "../lib/passwordStrength";
import { QrScannerDialog } from "./QrScannerDialog";
import type { VaultItemBase, ItemPayload } from "../types";

interface AddEditDialogProps {
  isOpen: boolean;
  editingItem: VaultItemBase | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}

export function AddEditDialog({ isOpen, editingItem, onClose, onSaved }: AddEditDialogProps) {
  const isEditing = editingItem !== null;

  const [title, setTitle] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or editing item changes
  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setTitle(editingItem.title);
        setAccount(editingItem.account || "");
      } else {
        setTitle("");
        setAccount("");
      }
      setPassword("");
      setTotpSecret("");
      setShowPassword(false);
      setShowQrScanner(false);
      setError(null);
      setSaving(false);
    }
  }, [isOpen, editingItem]);

  const handleGeneratePassword = () => {
    const pw = generatePassword(20);
    setPassword(pw);
    setShowPassword(true);
  };

  const handleTotpChange = async (val: string) => {
    if (val.startsWith("otpauth://")) {
      try {
        const res = await parseOtpauthUri(val);
        if (res.success && res.secret) {
          setTotpSecret(res.secret);
          if (res.issuer && !title) setTitle(res.issuer);
          if (res.accountName && !account) setAccount(res.accountName);
          return;
        }
      } catch {
        // Fall back to setting it manually if parsing fails
      }
    }
    setTotpSecret(val.replace(/[^a-zA-Z2-7]/g, "").toUpperCase());
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: ItemPayload = {
      title: title.trim(),
      account: account.trim() || null,
      password: password || null,
      totpSecret: totpSecret.trim() || null,
    };

    try {
      if (isEditing) {
        await updateItem(editingItem.id, payload);
      } else {
        await addItem(payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.toString() || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog (Bottom Sheet Style) */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50 h-[90vh] glass-strong
                       rounded-t-3xl border-t border-x border-border-subtle shadow-2xl
                       flex flex-col overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="relative flex items-center justify-center px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-white/10" />
              <h2 className="text-[17px] font-semibold text-primary mt-1">
                {isEditing ? "Edit Item" : "New Item"}
              </h2>
              <button
                onClick={onClose}
                className="absolute right-6 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] transition-colors duration-200 cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4 text-muted" strokeWidth={2} />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {/* Title */}
              <FieldGroup label="Title *">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. GitHub, Google..."
                  autoFocus
                  className="w-full px-4 py-3.5 text-[15px]
                             glass-surface rounded-xl border-white/5 shadow-inner
                             text-primary placeholder:text-muted-dark/50
                             focus:border-white/20 focus:bg-white/[0.05]
                             transition-all duration-300 outline-none"
                />
              </FieldGroup>

              {/* Account */}
              <FieldGroup label="Account">
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="username or email"
                  className="w-full px-4 py-3.5 text-[15px]
                             glass-surface rounded-xl border-white/5 shadow-inner
                             text-primary placeholder:text-muted-dark/50
                             focus:border-white/20 focus:bg-white/[0.05]
                             transition-all duration-300 outline-none"
                />
              </FieldGroup>

              {/* Password */}
              <FieldGroup label="Password">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isEditing ? "(leave empty to keep current)" : "enter password"}
                      className="w-full px-4 py-3.5 pr-12 text-[15px] font-mono
                                 glass-surface rounded-xl border-white/5 shadow-inner
                                 text-primary placeholder:text-muted-dark/50
                                 focus:border-white/20 focus:bg-white/[0.05]
                                 transition-all duration-300 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2
                                 w-9 h-9 flex items-center justify-center rounded-lg
                                 hover:bg-white/[0.08] cursor-pointer transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="w-[52px] h-[52px] rounded-xl flex items-center justify-center
                               glass-surface border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                               hover:bg-white/[0.08] active:scale-95 transition-all duration-200 cursor-pointer"
                    title="Generate strong password"
                  >
                    <RefreshCw className="w-4 h-4 text-muted" strokeWidth={1.5} />
                  </button>
                </div>
                {/* Password strength indicator */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1">
                      {[0, 1, 2, 3].map((i) => {
                        const strength = evaluatePasswordStrength(password);
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              i <= strength.score - 1
                                ? strength.bgClass
                                : "bg-white/[0.06]"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p
                      className={`text-[10px] mt-1 transition-colors duration-200 ${evaluatePasswordStrength(password).textClass}`}
                    >
                      {evaluatePasswordStrength(password).label}
                    </p>
                  </div>
                )}
              </FieldGroup>

              {/* TOTP Secret */}
              <FieldGroup label="TOTP Secret (Base32)">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={totpSecret}
                    onChange={(e) => handleTotpChange(e.target.value)}
                    placeholder={isEditing ? "(leave empty to keep current)" : "JBSWY3DPEHPK3PXP or paste otpauth:// URI"}
                    className="w-full px-4 py-3.5 pr-12 text-[15px] font-mono
                               glass-surface rounded-xl border-white/5 shadow-inner text-primary 
                               placeholder:text-muted-dark/50 uppercase
                               focus:border-white/20 focus:bg-white/[0.05]
                               transition-all duration-300 outline-none"
                  />
                  {/* QR Scanner Button */}
                  <button
                    type="button"
                    onClick={() => setShowQrScanner(true)}
                    className="w-[52px] h-[52px] rounded-xl flex items-center justify-center
                               glass-surface border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                               hover:bg-white/[0.08] active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
                    title="Scan QR Code"
                  >
                    <QrCode className="w-4 h-4 text-muted" strokeWidth={1.5} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-dark mt-1">
                  Enter Base32 secret or paste an otpauth:// URI
                </p>
              </FieldGroup>

              {/* Error */}
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
            <div className="px-6 py-5 border-t border-border-subtle flex gap-3 shrink-0 bg-background/50 backdrop-blur-md">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-dark
                           bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle
                           transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-background
                           bg-primary/90 hover:bg-primary
                           shadow-[0_0_15px_rgba(255,255,255,0.15)]
                           transition-all duration-200 cursor-pointer
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : isEditing ? "Update" : "Save"}
              </button>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* QR Scanner Overlay must be OUTSIDE the main AnimatePresence to prevent unmount crashing */}
      <QrScannerDialog
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScanSuccess={handleTotpChange}
      />
    </>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1">{label}</label>
      {children}
    </div>
  );
}
