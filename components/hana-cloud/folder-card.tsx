"use client"

import { Folder, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface FolderCardProps {
  name: string
  itemCount?: number
  selected?: boolean
  onClick?: () => void
  onSelect?: () => void
}

export function FolderCard({ name, itemCount = 0, selected, onClick, onSelect }: FolderCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 bg-card border border-border cozy-shadow",
        "hover:border-primary/20 hover:shadow-md",
        selected && "cozy-selected border-primary/30"
      )}
    >
      {/* Folder Icon */}
      <div className="w-full aspect-[4/3] mb-3 flex items-center justify-center">
        <div className="w-16 h-14 rounded-xl folder-cozy flex items-center justify-center">
          <Folder 
            className="w-8 h-8 text-[oklch(0.55_0.14_55)]" 
            strokeWidth={1.5} 
            fill="oklch(0.95 0.04 55)"
          />
        </div>
      </div>

      {/* Folder Info */}
      <div>
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
          onSelect?.()
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

      {/* More options */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all duration-150"
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
      </button>
    </div>
  )
}
