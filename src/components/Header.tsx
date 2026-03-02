import { Search, Plus, Settings, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNew: () => void;
  onOpenSettings: () => void;
  onManualLock: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onAddNew,
  onOpenSettings,
  onManualLock,
}: HeaderProps) {
  const { t } = useTranslation();
  const { actualTheme } = useTheme();

  return (
    <div className="flex flex-col gap-3 px-4 py-3 glass-surface border-b-0 shrink-0 z-10 sticky top-0 shadow-sm border-border-subtle transition-colors">
      {/* Top Bar: Title + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center">
            <img src={actualTheme === "dark" ? "/MPAW.png" : "/MPA.png"} alt="Logo" className="w-full h-full object-contain drop-shadow-md transition-opacity" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-primary drop-shadow-md">
            {t("app.title")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onManualLock}
            className="w-9 h-9 rounded-full flex items-center justify-center
                       bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all duration-200 cursor-pointer"
            title={t("app.lockVault")}
          >
            <Lock className="w-5 h-5 text-primary/80" strokeWidth={1.5} />
          </button>
          <button
            onClick={onAddNew}
            className="w-9 h-9 rounded-full flex items-center justify-center
                       bg-black/5 dark:bg-white/10 border border-border-subtle shadow-sm
                       hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all duration-200 cursor-pointer"
            title={t("app.addNewItem")}
          >
            <Plus className="w-5 h-5 text-primary" strokeWidth={2} />
          </button>
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-full flex items-center justify-center
                       bg-transparent hover:bg-black/5 dark:hover:bg-white/10
                       transition-all duration-200 cursor-pointer"
            title={t("app.settings")}
          >
            <Settings className="w-5 h-5 text-primary/80" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search Bar - Flex Layout overrides absolute positioning overlapping bug */}
      <div className="flex items-center w-full h-11 px-3.5 rounded-xl bg-surface-sunken border border-border-subtle shadow-inner focus-within:border-border focus-within:bg-background transition-all duration-200 mt-1 mb-1 group">
        <Search className="w-4 h-4 text-muted-dark group-focus-within:text-primary transition-colors shrink-0" strokeWidth={2} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("app.searchPlaceholder")}
          className="flex-1 h-full bg-transparent outline-none pl-3 text-[15px]
                     text-primary placeholder:text-muted-dark/60"
        />
      </div>
    </div>
  );
}
