"use client"

import { useStorageSummary } from "@/hooks/use-storage"
import { Film, Image, FileText, File } from "lucide-react"

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export function StorageBreakdown() {
  const { storageInfo } = useStorageSummary()
  const breakdown = storageInfo.breakdown || { videos: 0, images: 0, documents: 0, others: 0 }
  
  const vidPct = (breakdown.videos / storageInfo.total_bytes) * 100
  const imgPct = (breakdown.images / storageInfo.total_bytes) * 100
  const docPct = (breakdown.documents / storageInfo.total_bytes) * 100
  const othPct = (breakdown.others / storageInfo.total_bytes) * 100

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total Used</span>
        <span className="font-medium text-lg">
          {formatBytes(storageInfo.used_bytes)} <span className="text-muted-foreground text-sm font-normal">/ {formatBytes(storageInfo.total_bytes)}</span>
        </span>
      </div>
      <div className="h-3 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
        <div className="flex h-full w-full">
          <div className="h-full bg-blue-500/90 transition-all duration-1000 ease-out" style={{ width: `${vidPct}%` }} title="Videos" />
          <div className="h-full bg-purple-500/90 transition-all duration-1000 ease-out delay-100" style={{ width: `${imgPct}%` }} title="Images" />
          <div className="h-full bg-green-500/90 transition-all duration-1000 ease-out delay-200" style={{ width: `${docPct}%` }} title="Documents" />
          <div className="h-full bg-gray-400/90 transition-all duration-1000 ease-out delay-300" style={{ width: `${othPct}%` }} title="Others" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Film className="w-4 h-4 text-blue-500" /></div>
          <div><p className="text-xs font-medium">Videos</p><p className="text-xs text-muted-foreground">{formatBytes(breakdown.videos)}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"><Image className="w-4 h-4 text-purple-500" /></div>
          <div><p className="text-xs font-medium">Images</p><p className="text-xs text-muted-foreground">{formatBytes(breakdown.images)}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><FileText className="w-4 h-4 text-green-500" /></div>
          <div><p className="text-xs font-medium">Documents</p><p className="text-xs text-muted-foreground">{formatBytes(breakdown.documents)}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-400/10 flex items-center justify-center"><File className="w-4 h-4 text-gray-500" /></div>
          <div><p className="text-xs font-medium">Others</p><p className="text-xs text-muted-foreground">{formatBytes(breakdown.others)}</p></div>
        </div>
      </div>
    </div>
  )
}