import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { LockScreen } from "./components/LockScreen";
import { TitleBar } from "./components/TitleBar";
import { Header } from "./components/Header";
import { VaultList } from "./components/VaultList";
import { DetailDrawer } from "./components/DetailDrawer";
import { AddEditDialog } from "./components/AddEditDialog";
import { ExportImportDialog } from "./components/ExportImportDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { useIdleLock } from "./hooks/useIdleLock";
import { getVaultItems, searchItems, getLabels, toggleWindowVisibility } from "./lib/tauri-api";
import type { VaultItemBase, Label } from "./types";
import { PatternSetupDialog } from "./components/PatternSetupDialog";
import { LabelManager } from "./components/LabelManager";
import { SetupWizard } from "./components/SetupWizard";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

export type LockMode = "strict" | "normal" | "relaxed";
export type AuthMethod = "system" | "pattern";

function App() {
  // ======== State ========
  const [isLocked, setIsLocked] = useState(true);
  const [items, setItems] = useState<VaultItemBase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<VaultItemBase | null>(null);

  const [isInitialized, setIsInitialized] = useState(() => {
    return localStorage.getItem("magpie_is_initialized") === "true";
  });

  // Settings state
  const [lockMode, setLockMode] = useState<LockMode>(() => {
    return (localStorage.getItem("magpie_lock_mode") as LockMode) || "strict";
  });
  const [lockTimeoutMs, setLockTimeoutMs] = useState<number>(() => {
    const saved = localStorage.getItem("magpie_lock_timeout");
    return saved ? parseInt(saved, 10) : 30000; // Default 30s
  });

  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItemBase | null>(null);
  const [showExportImport, setShowExportImport] = useState(false);
  const [showPatternSetup, setShowPatternSetup] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [exportImportMode, setExportImportMode] = useState<"export" | "import">("export");
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [labels, setLabels] = useState<Label[]>([]);

  const [authMethod, setAuthMethod] = useState<AuthMethod>(() => {
    return (localStorage.getItem("magpie_auth_method") as AuthMethod) || "system";
  });

  const [globalShortcut, setGlobalShortcut] = useState<string>(() => {
    return localStorage.getItem("magpie_global_shortcut") || "CommandOrControl+Shift+L";
  });

  // ======== Global Shortcut Registration ========
  useEffect(() => {
    let registered = false;

    const setupShortcut = async () => {
      try {
        await unregister(globalShortcut); // Ensure it's clean before registering
      } catch (e) {
        // Ignore unregister errors if it wasn't registered
      }

      try {
        await register(globalShortcut, async (event) => {
          if (event.state === "Pressed") {
            await toggleWindowVisibility();
          }
        });
        registered = true;
      } catch (e) {
        console.warn("Global shortcut registration skipped (likely not running in Tauri window):", e);
      }
    };

    setupShortcut();

    return () => {
      if (registered) {
        unregister(globalShortcut).catch(console.error);
      }
    };
  }, [globalShortcut]);

  // ======== Data Loading ========
  const loadItems = useCallback(async () => {
    try {
      const data = await getVaultItems();
      setItems(data);
      const labelData = await getLabels();
      setLabels(labelData);
    } catch (e) {
      console.error("Failed to load items/labels:", e);
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

  // ======== Auto-Lock Handlers ========
  const handleLock = useCallback(() => {
    if (isLocked || !isInitialized) return;
    setIsLocked(true);
    setSelectedItem(null);
    setShowAddEdit(false);
    setShowSettings(false);
    setShowExportImport(false);
  }, [isLocked, isInitialized]);

  useIdleLock(handleLock, lockMode, lockTimeoutMs);

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem("magpie_lock_mode", lockMode);
    localStorage.setItem("magpie_lock_timeout", lockTimeoutMs.toString());
    localStorage.setItem("magpie_auth_method", authMethod);
    localStorage.setItem("magpie_global_shortcut", globalShortcut);
  }, [lockMode, lockTimeoutMs, authMethod, globalShortcut]);

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
        
        {/* Setup Wizard */}
        <AnimatePresence>
          {!isInitialized && (
            <SetupWizard
              onComplete={(method) => {
                setAuthMethod(method);
                setIsInitialized(true);
                localStorage.setItem("magpie_is_initialized", "true");
                setIsLocked(false);
              }}
            />
          )}
        </AnimatePresence>

        {/* Lock Screen */}
        <AnimatePresence>
          {isInitialized && isLocked && <LockScreen onUnlock={handleUnlock} />}
        </AnimatePresence>

        {/* Main Layout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLocked ? 0 : 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col w-full h-full absolute inset-0"
        >
        {/* Window Title Bar */}
        <TitleBar />

        {/* Header (Top Navigation & Search) */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddNew={handleAddNew}
          onOpenSettings={() => setShowSettings(!showSettings)}
          onManualLock={handleLock}
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
        lockMode={lockMode}
        onLockModeChange={setLockMode}
        lockTimeoutMs={lockTimeoutMs}
        onLockTimeoutChange={setLockTimeoutMs}
        authMethod={authMethod}
        onAuthMethodChange={setAuthMethod}
        onOpenPatternSetup={() => { setShowSettings(false); setShowPatternSetup(true); }}
        globalShortcut={globalShortcut}
        onGlobalShortcutChange={setGlobalShortcut}
        onManageLabels={() => { setShowSettings(false); setShowLabelManager(true); }}
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
        labels={labels}
        onClose={() => { setShowAddEdit(false); setEditingItem(null); }}
        onSaved={handleSaved}
        onManageLabels={() => setShowLabelManager(true)}
      />

      {/* Label Manager Dialog */}
      <LabelManager
        isOpen={showLabelManager}
        onClose={() => setShowLabelManager(false)}
        onLabelsChange={setLabels}
      />

      {/* Export/Import Dialog */}
      <ExportImportDialog
        isOpen={showExportImport}
        mode={exportImportMode}
        onClose={() => setShowExportImport(false)}
        onComplete={handleExportImportComplete}
      />

      {/* Pattern Setup Dialog */}
      <PatternSetupDialog
        isOpen={showPatternSetup}
        onClose={() => setShowPatternSetup(false)}
        onSetSuccess={() => {
          setShowPatternSetup(false);
          showToast("Pattern lock updated successfully!");
        }}
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
