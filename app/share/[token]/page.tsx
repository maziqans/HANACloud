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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white/60 relative">
        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />
        <Loader2 className="w-10 h-10 animate-spin text-white mb-4 relative z-10" />
        <p>Loading shared secure file...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6 relative text-white">
        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />
        <div className="relative z-10 w-20 h-20 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <File className="w-10 h-10" />
        </div>
        <h1 className="relative z-10 text-3xl font-light tracking-wide mb-2">Item Not Found</h1>
        <p className="relative z-10 text-white/60">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 flex justify-center items-start pt-20 relative text-white font-sans">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />

      <div className="relative z-10 w-full max-w-4xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-bottom-5">
        <div className="p-8 md:p-12 border-b border-white/10 bg-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {item.item_type === "FOLDER" ? <Folder className="w-8 h-8 text-white fill-white/20" /> : <File className="w-8 h-8 text-white fill-white/20" />}
              <h1 className="text-3xl font-light tracking-wide text-white truncate max-w-lg">{item.name}</h1>
            </div>
            <p className="text-white/60">Shared securely by <span className="font-medium text-white">{item.owner}</span> • {item.item_type === "FOLDER" ? `${item.children?.length} items` : formatBytes(item.size_bytes)}</p>
          </div>
          
          {item.item_type === "FILE" && (
            <button onClick={() => handleDownload(item.id)} className="px-8 py-3.5 bg-white hover:bg-white/90 text-slate-900 rounded-xl font-semibold uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-3 w-full md:w-auto justify-center">
              <Download className="w-5 h-5" /> Download File
            </button>
          )}
        </div>

        {item.item_type === "FOLDER" && item.children && (
          <div className="p-6 md:p-8">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/50 mb-6 px-2">Folder Contents</h3>
            <div className="space-y-2">
              {item.children.length === 0 ? (
                <p className="text-center text-white/40 py-10 italic">This folder is empty.</p>
              ) : (
                item.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors border border-transparent hover:border-white/10 group">
                    <div className="flex items-center gap-4">
                      {child.item_type === "FOLDER" ? <Folder className="w-6 h-6 text-white" /> : <File className="w-6 h-6 text-white/60" />}
                      <span className="font-light tracking-wide text-white">{child.name}</span>
                    </div>
                    <button onClick={() => handleDownload(child.id)} className="p-2 bg-white/10 border border-white/20 rounded-lg text-white/80 hover:text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
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