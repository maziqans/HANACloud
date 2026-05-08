"use client"

import { FileText, Image, FileVideo, FileAudio, File, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileCardProps {
  name: string
  type?: string
  size?: string
  selected?: boolean
  onClick?: () => void
  onSelect?: () => void
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
  onClick,
  onSelect
}: FileCardProps) {
  const Icon = fileIcons[type] || fileIcons.default
  const styles = fileStyles[type] || fileStyles.default

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 bg-card border border-border cozy-shadow",
        "hover:border-primary/20 hover:shadow-md",
        selected && "cozy-selected border-primary/30"
      )}
    >
      {/* File Icon */}
      <div className="w-full aspect-[4/3] mb-3 flex items-center justify-center">
        <div className={cn("w-14 h-16 rounded-xl flex items-center justify-center", styles.bg)}>
          <Icon className={cn("w-7 h-7", styles.icon)} strokeWidth={1.5} />
        </div>
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
