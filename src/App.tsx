import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Upload } from "lucide-react";
import { LockScreen } from "./components/LockScreen";
import { Header } from "./components/Header";
import { VaultList } from "./components/VaultList";
import { DetailDrawer } from "./components/DetailDrawer";
import { AddEditDialog } from "./components/AddEditDialog";
import { ExportImportDialog } from "./components/ExportImportDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { useIdleLock } from "./hooks/useIdleLock";
import { getVaultItems, searchItems } from "./lib/tauri-api";
import type { VaultItemBase } from "./types";

function App() {
  // ======== State ========
  const [isLocked, setIsLocked] = useState(true);
  const [items, setItems] = useState<VaultItemBase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<VaultItemBase | null>(null);

  // Dialog states
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItemBase | null>(null);
  const [showExportImport, setShowExportImport] = useState(false);
  const [exportImportMode, setExportImportMode] = useState<"export" | "import">("export");
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ======== Data Loading ========
  const loadItems = useCallback(async () => {
    try {
      const data = await getVaultItems();
      setItems(data);
    } catch (e) {
      console.error("Failed to load items:", e);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    try {
      if (query.trim()) {
        const data = await searchItems(query);
        setItems(data);
      } else {
        loadItems();
      }
    } catch {
      // ignore
    }
  }, [loadItems]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchItems(searchQuery).then(setItems).catch(() => {});
      } else if (!isLocked) {
        loadItems();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, isLocked, loadItems]);

  useEffect(() => {
    if (!isLocked) {
      loadItems();
    }
  }, [isLocked, loadItems]);

  // ======== Auto-Lock on Idle (5 minutes) ========
  const handleLock = useCallback(() => {
    setIsLocked(true);
    setSelectedItem(null);
    setShowAddEdit(false);
    setShowSettings(false);
    setShowExportImport(false);
  }, []);

  useIdleLock(handleLock, 5 * 60 * 1000); // 5 minutes

  // ======== Handlers ========
  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setShowAddEdit(true);
  };

  const handleEdit = (item: VaultItemBase) => {
    setEditingItem(item);
    setShowAddEdit(true);
    setSelectedItem(null);
  };

  const handleItemDeleted = () => {
    setSelectedItem(null);
    loadItems();
  };

  const handleSaved = () => {
    loadItems();
    setEditingItem(null);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportImportComplete = (msg: string) => {
    showToast(msg);
    loadItems();
  };

  const handleOpenExport = () => {
    setShowSettings(false);
    setExportImportMode("export");
    setShowExportImport(true);
  };

  const handleOpenImport = () => {
    setShowSettings(false);
    setExportImportMode("import");
    setShowExportImport(true);
  };

  // ======== Render ========
  return (
    <div className="h-screen w-screen flex justify-center bg-background overflow-hidden select-none">
      <div className="w-full max-w-[420px] h-full relative flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-background border-x border-white/5">
        {/* Lock Screen */}
        <AnimatePresence>
          {isLocked && <LockScreen onUnlock={handleUnlock} />}
        </AnimatePresence>

        {/* Main Layout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLocked ? 0 : 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col w-full h-full absolute inset-0"
        >
        {/* Header (Top Navigation & Search) */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddNew={handleAddNew}
          onOpenSettings={() => setShowSettings(!showSettings)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Vault List */}
          <VaultList
            items={items}
            selectedId={selectedItem?.id ?? null}
            onSelect={(item) => setSelectedItem(item)}
          />
        </div>
      </motion.div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onExport={handleOpenExport}
        onImport={handleOpenImport}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onEdit={handleEdit}
        onDeleted={handleItemDeleted}
      />

      {/* Add/Edit Dialog */}
      <AddEditDialog
        isOpen={showAddEdit}
        editingItem={editingItem}
        onClose={() => { setShowAddEdit(false); setEditingItem(null); }}
        onSaved={handleSaved}
      />

      {/* Export/Import Dialog */}
      <ExportImportDialog
        isOpen={showExportImport}
        mode={exportImportMode}
        onClose={() => setShowExportImport(false)}
        onComplete={handleExportImportComplete}
      />

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100]
                       px-5 py-3 rounded-xl glass-strong text-xs text-primary
                       border border-border-subtle shadow-2xl backdrop-blur-md"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
