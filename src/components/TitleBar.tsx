import { Minus, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function TitleBar() {

  return (
    <div
      data-tauri-drag-region
      className="h-9 w-full flex items-center justify-between px-2 shrink-0 glass-surface border-b border-white/5 bg-black/20 backdrop-blur-md relative z-50 select-none cursor-default"
    >
      {/* Decorative drag handle */}
      <div 
        className="flex-1 flex items-center justify-center pointer-events-none"
      >
        <div className="w-12 h-1 rounded-full bg-white/10" />
      </div>

      <div className="flex items-center justify-end w-24 gap-1 z-10" data-tauri-drag-region="false">
        <button
          onClick={() => invoke("minimize_window")}
          data-tauri-drag-region="false"
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer text-muted-dark hover:text-primary pointer-events-auto"
          title="Minimize"
        >
          <Minus className="w-4 h-4 pointer-events-none" strokeWidth={2} />
        </button>
        <button
          onClick={() => invoke("close_window")}
          data-tauri-drag-region="false"
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-danger/20 hover:text-danger-text active:bg-danger/30 transition-colors cursor-pointer text-muted-dark pointer-events-auto"
          title="Close"
        >
          <X className="w-4 h-4 pointer-events-none" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
