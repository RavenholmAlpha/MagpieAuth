import { motion, AnimatePresence } from "framer-motion";
import { Copy, Key, Clock, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, getInitial, stringToColorClass, formatDate, copyToClipboard } from "../lib/utils";
import { getPasswordPlaintext } from "../lib/tauri-api";
import { useState } from "react";
import type { VaultItemBase } from "../types";

interface VaultListProps {
  items: VaultItemBase[];
  selectedId: string | null;
  onSelect: (item: VaultItemBase) => void;
}

export function VaultList({ items, selectedId, onSelect }: VaultListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
              >
                <VaultItem
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => onSelect(item)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function VaultItem({
  item,
  isSelected,
  onSelect,
}: {
  item: VaultItemBase;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await getPasswordPlaintext(item.id);
      if (result.success && result.plaintext) {
        await copyToClipboard(result.plaintext);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-4 px-4 py-3.5 mb-2.5 rounded-2xl cursor-pointer transition-all duration-300",
        "glass-surface hover:bg-white/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.1)]",
        isSelected && "bg-white/[0.08] border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)] ring-1 ring-white/10"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-11 h-11 rounded-[14px] flex items-center justify-center text-[18px] font-semibold shrink-0 shadow-inner",
          !item.labelColor && stringToColorClass(item.title)
        )}
        style={item.labelColor ? { color: item.labelColor, backgroundColor: `${item.labelColor}1A` } : undefined}
      >
        {getInitial(item.title)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 px-1">
        <p className="text-[16px] font-medium text-primary truncate tracking-tight">{item.title}</p>
        <p className="text-[13px] text-muted-dark truncate mt-0.5 font-light">
          {item.account || "No account"}
        </p>
      </div>

      {/* Badges / Quick Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.hasTotp && (
          <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center border border-white/5 shadow-inner" title={t("vaultList.totp")}>
            <Clock className="w-3.5 h-3.5 text-muted-dark group-hover:text-primary/70 transition-colors" strokeWidth={2} />
          </span>
        )}
        {item.hasPassword && (
          <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center border border-white/5 shadow-inner" title={t("vaultList.password")}>
            <Key className="w-3.5 h-3.5 text-muted-dark group-hover:text-primary/70 transition-colors" strokeWidth={2} />
          </span>
        )}
      </div>

      {/* Quick copy (hover reveal) */}
      {item.hasPassword && (
        <motion.button
          initial={{ opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleCopyPassword}
          className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200
                     w-8 h-8 rounded-lg flex items-center justify-center
                     bg-white/[0.08] hover:bg-white/[0.12] cursor-pointer shrink-0 ml-1"
          title="Copy password"
        >
          {copied ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-success-text text-sm"
            >
              ✓
            </motion.span>
          ) : (
            <Copy className="w-4 h-4 text-muted" strokeWidth={1.5} />
          )}
        </motion.button>
      )}
    </motion.div>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full opacity-60 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl glass-surface flex items-center justify-center mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <Key className="w-8 h-8 text-primary/40" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-medium text-primary">{t("vaultList.empty")}</p>
      <p className="text-[13px] text-muted-dark mt-2 leading-relaxed">
        {t("vaultList.clickAdd")}
      </p>
    </div>
  );
}
