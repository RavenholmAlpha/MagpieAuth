import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Copy, Trash2, Edit3, Clock, Key, User } from "lucide-react";
import { cn, copyToClipboard, formatDate, getInitial, stringToColorClass } from "../lib/utils";
import { getPasswordPlaintext, getTotpCode, deleteItem } from "../lib/tauri-api";
import { TotpDisplay } from "./TotpDisplay";
import type { VaultItemBase } from "../types";

interface DetailDrawerProps {
  item: VaultItemBase | null;
  onClose: () => void;
  onEdit: (item: VaultItemBase) => void;
  onDeleted: () => void;
}

export function DetailDrawer({ item, onClose, onEdit, onDeleted }: DetailDrawerProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [totpCopied, setTotpCopied] = useState(false);
  const [accountCopied, setAccountCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleShowPassword = async () => {
    if (passwordVisible) {
      setPasswordVisible(false);
      setPassword(null);
      return;
    }
    try {
      const result = await getPasswordPlaintext(item!.id);
      if (result.success && result.plaintext) {
        setPassword(result.plaintext);
        setPasswordVisible(true);
      }
    } catch {
      // ignore
    }
  };

  const handleCopyPassword = async () => {
    if (!item) return;
    try {
      const result = await getPasswordPlaintext(item.id);
      if (result.success && result.plaintext) {
        await copyToClipboard(result.plaintext);
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 1500);
      }
    } catch {
      // ignore
    }
  };

  const handleCopyTotp = async (code: string) => {
    await copyToClipboard(code);
    setTotpCopied(true);
    setTimeout(() => setTotpCopied(false), 1500);
  };

  const handleDelete = async () => {
    if (!item) return;
    setIsDeleting(true);
    try {
      await deleteItem(item.id);
      onDeleted();
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    setPasswordVisible(false);
    setPassword(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer Panel (Bottom Sheet) */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50 h-[85vh] glass-strong
                       rounded-t-3xl border-t border-x border-border-subtle
                       flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative px-6 pt-5 pb-4 border-b border-white/5 shrink-0 flex items-center justify-between">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-white/10" />
              <div className="flex items-center gap-3 min-w-0 pr-4 mt-2">
                <div
                  className={`w-11 h-11 rounded-[14px] flex items-center justify-center text-[16px] font-semibold shrink-0 shadow-inner ${stringToColorClass(item.title)}`}
                >
                  {getInitial(item.title)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold text-primary truncate tracking-tight">{item.title}</h2>
                  <p className="text-[13px] text-muted-dark truncate leading-tight mt-0.5">{item.account || "No account"}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04]
                           hover:bg-white/[0.1] transition-colors duration-200 cursor-pointer shrink-0 mt-2"
                title="Close details"
              >
                <X className="w-4 h-4 text-muted" strokeWidth={2} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* TOTP Section */}
              {item.hasTotp && (
                <section className="rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1">
                      Two-Factor Code
                    </span>
                  </div>
                  <TotpDisplay itemId={item.id} getTotpCode={getTotpCode} />
                  <button
                    onClick={async () => {
                      const result = await getTotpCode(item.id);
                      if (result.success && result.code) {
                        handleCopyTotp(result.code);
                      }
                    }}
                    className="w-full mt-2 py-2 rounded-lg text-xs text-muted
                               hover:bg-white/[0.06] transition-all duration-200 cursor-pointer
                               flex items-center justify-center gap-2"
                  >
                    {totpCopied ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-success-text"
                      >
                        ✓ Copied
                      </motion.span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Copy Code
                      </>
                    )}
                  </button>
                </section>
              )}

              {/* Password Section */}
              {item.hasPassword && (
                <section className="rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1">
                      Password
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3.5 rounded-xl bg-black/20 border border-white/5 shadow-inner
                                    text-[15px] font-mono text-primary/90">
                      {passwordVisible && password ? password : "••••••••••••"}
                    </div>
                    <button
                      onClick={handleShowPassword}
                      className="w-9 h-9 rounded-lg flex items-center justify-center
                                 hover:bg-white/[0.06] transition-colors duration-200 cursor-pointer"
                      title={passwordVisible ? "Hide" : "Show"}
                    >
                      {passwordVisible ? (
                        <EyeOff className="w-4 h-4 text-muted" strokeWidth={1.5} />
                      ) : (
                        <Eye className="w-4 h-4 text-muted" strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      onClick={handleCopyPassword}
                      className="w-9 h-9 rounded-lg flex items-center justify-center
                                 hover:bg-white/[0.06] transition-colors duration-200 cursor-pointer"
                      title="Copy"
                    >
                      {passwordCopied ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-success-text text-xs"
                        >
                          ✓
                        </motion.span>
                      ) : (
                        <Copy className="w-4 h-4 text-muted" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </section>
              )}

              {/* Account Section */}
              {item.account && (
                <section className="rounded-2xl glass-surface border-white/5 shadow-inner p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-primary/70 uppercase tracking-[0.1em] ml-1">
                      Account
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3.5 rounded-xl bg-black/20 border border-white/5 shadow-inner
                                    text-[15px] text-primary/90 truncate">
                      {item.account}
                    </div>
                    <button
                      onClick={async () => {
                        await copyToClipboard(item.account!);
                        setAccountCopied(true);
                        setTimeout(() => setAccountCopied(false), 1500);
                      }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center
                                 hover:bg-white/[0.06] transition-colors duration-200 cursor-pointer shrink-0"
                      title="Copy account"
                    >
                      {accountCopied ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-success-text text-xs"
                        >
                          ✓
                        </motion.span>
                      ) : (
                        <Copy className="w-4 h-4 text-muted" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </section>
              )}

              {/* Metadata */}
              <section className="space-y-2 text-xs text-muted-dark">
                <p>Created: {formatDate(item.createdAt)}</p>
                <p>Updated: {formatDate(item.updatedAt)}</p>
              </section>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-4 border-t border-border-subtle flex items-center gap-2">
              <button
                onClick={() => onEdit(item)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                           text-xs text-primary/80 bg-white/[0.04] hover:bg-white/[0.08]
                           transition-all duration-200 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                Edit
              </button>

              {showDeleteConfirm ? (
                <div className="flex-1 flex gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-lg text-xs text-danger-text bg-danger/30
                               hover:bg-danger/50 transition-all duration-200 cursor-pointer
                               disabled:opacity-50"
                  >
                    {isDeleting ? "..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-lg text-xs text-muted-dark
                               hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                             text-xs text-danger-text/70 hover:text-danger-text
                             hover:bg-danger/20 transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Delete
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
