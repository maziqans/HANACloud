"use client"

import { useState } from "react"
import { FileText, Image, FileVideo, FileAudio, File, MoreHorizontal, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileRowProps {
  name: string
  type?: string
  size?: string
  modified?: string
  selected?: boolean
  isTrash?: boolean
  isStarred?: boolean
  onClick?: () => void
  onSelect?: () => void
  onDoubleClick?: () => void
  onDelete?: () => void
  onRestore?: () => void
  onPermanentDelete?: () => void
  onShare?: () => void
  onDownload?: () => void
  onToggleStar?: () => void
  previewUrl?: string
}

const fileIcons: Record<string, React.ElementType> = {
  document: FileText,
  image: Image,
  video: FileVideo,
  audio: FileAudio,
  default: File,
}

const fileStyles: Record<string, { icon: string; bg: string }> = {
  document: { 
    icon: "text-[oklch(0.5_0.16_250)]", 
    bg: "bg-[oklch(0.94_0.04_250)]" 
  },
  image: { 
    icon: "text-[oklch(0.5_0.14_160)]", 
    bg: "bg-[oklch(0.92_0.05_160)]" 
  },
  video: { 
    icon: "text-[oklch(0.5_0.14_290)]", 
    bg: "bg-[oklch(0.92_0.05_290)]" 
  },
  audio: { 
    icon: "text-[oklch(0.55_0.14_55)]", 
    bg: "bg-[oklch(0.92_0.06_55)]" 
  },
  default: { 
    icon: "text-muted-foreground", 
    bg: "bg-secondary" 
  },
}

export function FileRow({ 
  name, 
  type = "default", 
  size = "—", 
  modified = "—",
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
  onDownload,
  onToggleStar,
  previewUrl
}: FileRowProps) {
  const Icon = fileIcons[type] || fileIcons.default
  const styles = fileStyles[type] || fileStyles.default
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "group relative grid grid-cols-[auto_1fr_100px_140px_40px] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-200",
        selected && "cozy-selected",
        !selected && "hover:bg-secondary/50"
      )}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.()
        }}
        className={cn(
          "w-5 h-5 rounded-lg border-2 transition-all duration-150 flex items-center justify-center",
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

      {/* File name with icon */}
      <div className="flex items-center gap-3 min-w-0">
        {previewUrl ? (
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-black/20">
            <img src={previewUrl} alt={name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={cn("p-2 rounded-lg", styles.bg)}>
            <Icon className={cn("w-4 h-4", styles.icon)} strokeWidth={2} />
          </div>
        )}
        <span className="text-sm font-medium text-foreground truncate">
          {name}
        </span>
        {isStarred && <Star className="w-4 h-4 text-yellow-500 fill-current shrink-0" />}
      </div>

      {/* Size */}
      <span className="text-sm text-muted-foreground text-right">
        {size}
      </span>

      {/* Modified date */}
      <span className="text-sm text-muted-foreground text-right">
        {modified}
      </span>

      {/* More options */}
      <div className="justify-self-end relative">
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
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRestore?.(); }}>Restore</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPermanentDelete?.(); }}>Delete Forever</button>
              </>
            ) : (
              <>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStar?.(); }}>{isStarred ? "Remove from Starred" : "Add to Starred"}</button>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDownload?.(); }}>Download</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare?.(); }}>Share</button>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(); }}>Move to Trash</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
