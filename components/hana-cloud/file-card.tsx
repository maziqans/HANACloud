"use client"

import { useState } from "react"
import { FileText, Image, FileVideo, FileAudio, File, MoreHorizontal, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileCardProps {
  name: string
  type?: string
  size?: string
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
  previewType?: string
  canEdit?: boolean
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

export function FileCard({ 
  name, 
  type = "default", 
  size = "—",
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
  previewUrl,
  previewType,
  canEdit = true
}: FileCardProps) {
  const Icon = fileIcons[type] || fileIcons.default
  const styles = fileStyles[type] || fileStyles.default
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 bg-card border border-border cozy-shadow",
        "hover:border-primary/20 hover:shadow-md",
        selected && "cozy-selected border-primary/30"
      )}
    >
      {/* File Icon */}
      <div className="w-full aspect-[4/3] mb-3 flex items-center justify-center">
        {previewUrl && previewType ? (
          <div className="w-full h-full rounded-xl overflow-hidden bg-black/20 flex items-center justify-center relative">
            {previewType === 'image' && <img src={previewUrl} alt={name} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
            {previewType === 'video' && <video src={`${previewUrl}#t=0.1`} className="w-full h-full object-cover" preload="metadata" muted playsInline />}
            {previewType === 'pdf' && (
              <>
                <iframe src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="w-[140%] h-[140%] border-none pointer-events-none" tabIndex={-1} />
                <div className="absolute inset-0 z-10" />
              </>
            )}
          </div>
        ) : (
          <div className={cn("w-14 h-16 rounded-xl flex items-center justify-center", styles.bg)}>
            <Icon className={cn("w-7 h-7", styles.icon)} strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* File Info */}
      <div>
        <h3 className="text-sm font-medium text-foreground truncate">
          {name}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {size}
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
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRestore?.(); }}>Restore</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPermanentDelete?.(); }}>Delete Forever</button>
              </>
            ) : (
              <>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStar?.(); }}>{isStarred ? "Remove from Starred" : "Add to Starred"}</button>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDownload?.(); }}>Download</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare?.(); }}>Share</button>
              {canEdit !== false && <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(); }}>Move to Trash</button>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
