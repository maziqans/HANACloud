"use client"

import React, { useState } from "react"
import { Folder, MoreHorizontal, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface FolderCardProps {
  id: string
  name: string
  itemCount?: number
  selected?: boolean
  isTrash?: boolean
  isStarred?: boolean
  onClick?: (id: string) => void
  onSelect?: (id: string) => void
  onDoubleClick?: (id: string) => void
  onDelete?: (id: string, isPermanent: boolean) => void
  onRestore?: (id: string) => void
  onPermanentDelete?: (id: string, isPermanent: boolean) => void
  onShare?: (id: string) => void
  onToggleStar?: (id: string, currentStatus: boolean) => void
  canEdit?: boolean
}

export const FolderCard = React.memo(function FolderCard({ 
  id, 
  name, 
  itemCount = 0, 
  selected, 
  isTrash,
  isStarred,
  onClick, 
  onSelect,
  onDoubleClick,
  onDelete,
  onRestore,
  onPermanentDelete,
  onShare,
  onToggleStar,
  canEdit = true
}: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      data-selection-id={`folder-${id}`}
      onClick={() => onClick?.(id)}
      onDoubleClick={() => onDoubleClick?.(id)}
      className={cn(
        "group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 bg-card border border-border cozy-shadow selectable-item touch-manipulation h-full flex flex-col",
        "hover:border-primary/20 hover:shadow-md",
        selected && "cozy-selected border-primary/30"
      )}
    >
      {/* Folder Icon */}
      <div className="w-full flex-1 min-h-0 mb-3 flex items-center justify-center">
        <div className="w-16 h-14 rounded-xl folder-cozy flex items-center justify-center">
          <Folder 
            className="w-8 h-8 text-[oklch(0.55_0.14_55)]" 
            strokeWidth={1.5} 
            fill="oklch(0.95 0.04 55)"
          />
        </div>
      </div>

      {/* Folder Info */}
      <div className="shrink-0">
        <h3 className="text-sm font-medium text-foreground truncate">
          {name}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
      </div>

      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(`folder-${id}`)
        }}
        className={cn(
          "absolute top-3 left-3 w-5 h-5 rounded-lg border-2 transition-all duration-150 flex items-center justify-center",
          selected
            ? "bg-primary border-primary"
            : "border-border bg-card opacity-0 group-hover:opacity-100 hover:border-primary/50"
        )}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {isStarred && (
        <div className="absolute top-3 right-10 p-1.5 text-yellow-500 pointer-events-none">
          <Star className="w-4 h-4 fill-current" />
        </div>
      )}

      {/* More options */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all duration-150"
        >
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-in zoom-in-95" onMouseLeave={() => setMenuOpen(false)}>
            {isTrash ? (
              <>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRestore?.(id); }}>Restore</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPermanentDelete?.(id, true); }}>Delete Forever</button>
              </>
            ) : (
              <>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStar?.(id, !isStarred); }}>{isStarred ? "Remove from Starred" : "Add to Starred"}</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare?.(id); }}>Share</button>
                {canEdit !== false && <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(id, false); }}>Move to Trash</button>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
