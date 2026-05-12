"use client"

import { useEffect, useState } from "react"
import { Download, File, Folder, Loader2 } from "lucide-react"

interface SharedItem {
  id: string
  name: string
  item_type: "FILE" | "FOLDER"
  size_bytes: number
  updated_at: string
  owner: string
  children?: SharedItem[]
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export default function SharedPage({ params }: { params: { token: string } }) {
  const [item, setItem] = useState<SharedItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchSharedItem = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://192.168.56.101:8080/api"
        const res = await fetch(`${baseUrl}/shared/${params.token}/`)
        if (!res.ok) throw new Error("This share link is invalid or has expired.")
        const data = await res.json()
        setItem(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSharedItem()
  }, [params.token])

  const handleDownload = (id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://192.168.56.101:8080/api"
    window.open(`${baseUrl}/download/${id}/`, "_blank")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p>Loading shared secure file...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
          <File className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 flex justify-center items-start pt-20">
      <div className="w-full max-w-4xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-bottom-5">
        <div className="p-8 md:p-12 border-b border-border bg-secondary/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {item.item_type === "FOLDER" ? <Folder className="w-8 h-8 text-blue-500 fill-blue-500/20" /> : <File className="w-8 h-8 text-primary fill-primary/20" />}
              <h1 className="text-3xl font-semibold text-foreground truncate max-w-lg">{item.name}</h1>
            </div>
            <p className="text-muted-foreground">Shared securely by <span className="font-medium text-foreground">{item.owner}</span> • {item.item_type === "FOLDER" ? `${item.children?.length} items` : formatBytes(item.size_bytes)}</p>
          </div>
          
          {item.item_type === "FILE" && (
            <button onClick={() => handleDownload(item.id)} className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors shadow-lg flex items-center gap-2 w-full md:w-auto justify-center">
              <Download className="w-5 h-5" /> Download File
            </button>
          )}
        </div>

        {item.item_type === "FOLDER" && item.children && (
          <div className="p-6 md:p-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 px-2">Folder Contents</h3>
            <div className="space-y-2">
              {item.children.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">This folder is empty.</p>
              ) : (
                item.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-4 hover:bg-secondary/50 rounded-2xl transition-colors border border-transparent hover:border-border group">
                    <div className="flex items-center gap-4">
                      {child.item_type === "FOLDER" ? <Folder className="w-6 h-6 text-blue-500" /> : <File className="w-6 h-6 text-muted-foreground" />}
                      <span className="font-medium text-foreground">{child.name}</span>
                    </div>
                    <button onClick={() => handleDownload(child.id)} className="p-2 bg-background border border-border rounded-lg text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}