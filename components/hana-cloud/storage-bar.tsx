"use client"

import { useStorageSummary } from "@/hooks/use-storage"
import { AlertCircle } from "lucide-react"

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export function StorageBar() {
  const { storageInfo } = useStorageSummary()
  const percentage = Math.min(100, (storageInfo.used_bytes / storageInfo.total_bytes) * 100)
  const remainingBytes = storageInfo.total_bytes - storageInfo.used_bytes
  const isLowStorage = remainingBytes <= 5 * 1024 * 1024 * 1024 // 5GB threshold

  return (
    <div className="bg-sidebar-accent rounded-xl p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-sidebar-muted">Storage</span>
        <span className="text-sidebar-foreground font-medium">
          {formatBytes(storageInfo.used_bytes)} / {formatBytes(storageInfo.total_bytes)}
        </span>
      </div>
      <div className="h-2 bg-sidebar-border rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isLowStorage ? 'bg-destructive' : 'progress-golden'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isLowStorage && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md border border-destructive/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Low storage space!</span>
        </div>
      )}
    </div>
  )
}