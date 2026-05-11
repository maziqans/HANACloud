"use client"

import { useStorageSummary } from "@/hooks/use-storage"

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
          className="h-full rounded-full progress-golden transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}