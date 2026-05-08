"use client"

import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  view: "grid" | "list"
  onViewChange: (view: "grid" | "list") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary border border-border">
      <button
        onClick={() => onViewChange("grid")}
        className={cn(
          "p-2 rounded-lg transition-all duration-200",
          view === "grid"
            ? "bg-card text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Grid view"
      >
        <LayoutGrid className="w-4 h-4" strokeWidth={2} />
      </button>
      <button
        onClick={() => onViewChange("list")}
        className={cn(
          "p-2 rounded-lg transition-all duration-200",
          view === "list"
            ? "bg-card text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="List view"
      >
        <List className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}
