import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Edit2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLabels, addLabel, updateLabel, deleteLabel } from "../lib/tauri-api";
import type { Label } from "../types";

// A small subset of modern curated colors for labels
const LABEL_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow
  "#84CC16", // Lime
  "#22C55E", // Green
  "#10B981", // Emerald
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#0EA5E9", // Light Blue
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#A855F7", // Purple
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#64748B", // Slate
  "#E2E8F0"  // Light Gray
];

interface LabelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLabelsChange: (labels: Label[]) => void;
}

export function LabelManager({ isOpen, onClose, onLabelsChange }: LabelManagerProps) {
  const { t } = useTranslation();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(LABEL_COLORS[6]); // default Emerald
  
  const loadLabels = async () => {
    try {
      setLoading(true);
      const data = await getLabels();
      setLabels(data);
      onLabelsChange(data);
    } catch (e) {
      console.error("Failed to load labels:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLabels();
      setEditingId(null);
      setDraftName("");
    }
  }, [isOpen]);

  const handleStartAdd = () => {
    setEditingId("new");
    setDraftName("");
    setDraftColor(LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]);
  };

  const handleStartEdit = (label: Label) => {
    setEditingId(label.id);
    setDraftName(label.name);
    setDraftColor(label.color);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!draftName.trim()) return;
    
    try {
      if (editingId === "new") {
        await addLabel({ name: draftName.trim(), color: draftColor });
      } else if (editingId) {
        await updateLabel(editingId, { name: draftName.trim(), color: draftColor });
      }
      setEditingId(null);
      await loadLabels();
    } catch (e) {
      console.error("Failed to save label:", e);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("labels.confirmDelete", "Are you sure you want to delete this label? Items using it will retain their data but lose the label association."))) {
      try {
        await deleteLabel(id);
        await loadLabels();
      } catch (err) {
        console.error("Failed to delete label:", err);
      }
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
            className="absolute inset-0 z-[60] bg-black/30 dark:bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-[60] h-[75vh] glass-strong
                       rounded-t-3xl border-t border-x border-border-subtle shadow-2xl
                       flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="relative flex items-center justify-center px-6 pt-5 pb-4 border-b border-border-subtle shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-white/10" />
              <h2 className="text-[17px] font-semibold text-primary mt-1">
                {t("labels.manageTitle", "Manage Labels")}
              </h2>
              <button
                onClick={onClose}
                className="absolute right-6 top-1/2 -translate-y-1/2 mt-1 w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/[0.04] hover:bg-black/10 dark:hover:bg-white/[0.1] transition-colors duration-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 text-muted" strokeWidth={2} />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {!editingId && (
                <button
                  onClick={handleStartAdd}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-white/20 text-primary/80 hover:bg-white/[0.05] hover:text-primary transition-colors duration-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">{t("labels.addNew", "Add New Label")}</span>
                </button>
              )}

              {loading ? (
                <div className="flex justify-center p-4">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {/* The "New" row form */}
                    {editingId === "new" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-4"
                      >
                        <LabelEditorRow 
                          name={draftName} 
                          color={draftColor}
                          onNameChange={setDraftName}
                          onColorChange={setDraftColor}
                          onSave={handleSave}
                          onCancel={handleCancelEdit}
                        />
                      </motion.div>
                    )}

                    {labels.map(label => (
                      <motion.div
                        key={label.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full"
                      >
                        {editingId === label.id ? (
                          <LabelEditorRow 
                            name={draftName} 
                            color={draftColor}
                            onNameChange={setDraftName}
                            onColorChange={setDraftColor}
                            onSave={handleSave}
                            onCancel={handleCancelEdit}
                          />
                        ) : (
                          <div className="group flex items-center gap-3 p-3.5 glass-surface rounded-xl border border-border-subtle transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06]">
                            <div 
                              className="w-4 h-4 rounded-full shrink-0 shadow-inner border border-white/10"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="flex-1 text-[15px] font-medium text-primary truncate">
                              {label.name}
                            </span>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(label)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.1] text-muted-dark hover:text-primary transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(label.id, e)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-danger-bg text-muted-dark hover:text-danger-text transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Inline Label Editor Sub-component
function LabelEditorRow({ 
  name, 
  color, 
  onNameChange, 
  onColorChange,
  onSave,
  onCancel
}: {
  name: string;
  color: string;
  onNameChange: (val: string) => void;
  onColorChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="glass-surface p-4 rounded-xl border border-white/20 shadow-lg space-y-4">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("labels.namePlaceholder", "Label name")}
          className="flex-1 px-3 py-2 text-sm glass-surface rounded-lg border-border-subtle text-primary placeholder:text-muted-dark/50 focus:border-border outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </div>
      
      <div className="flex flex-wrap gap-2">
        {LABEL_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            className={`w-6 h-6 rounded-full border transition-all duration-200 flex items-center justify-center cursor-pointer ${
              color === c ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
          >
            {color === c && <Check className="w-3.5 h-3.5 text-white/90 drop-shadow-md" strokeWidth={3} />}
          </button>
        ))}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          {t("common.cancel", "Cancel")}
        </button>
        <button
          onClick={onSave}
          disabled={!name.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-background bg-primary/90 hover:bg-primary disabled:opacity-50 transition-colors cursor-pointer shadow-md"
        >
          {t("common.save", "Save")}
        </button>
      </div>
    </div>
  );
}
