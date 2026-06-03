"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Download, File, Folder, Loader2, X } from "lucide-react"
import { getBaseUrl } from "@/lib/api"

interface SharedItem {
  id: string
  name: string
  item_type: "FILE" | "FOLDER"
  size_bytes: number
  updated_at: string
  owner: string
  user_role?: "VIEWER" | "EDITOR" | "OWNER" | "PUBLIC_VIEWER"
  is_saved?: boolean
  children?: SharedItem[]
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const getPreviewType = (name: string) => {
  if (!name) return null;
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.ogg'].includes(ext)) return 'video';
  if (['.mp3', '.wav'].includes(ext)) return 'audio';
  if (['.pdf'].includes(ext)) return 'pdf';
  return null;
}

export default function SharedPage() {
  const params = useParams()
  const token = params?.token as string
  const [item, setItem] = useState<SharedItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requestStatus, setRequestStatus] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [previewItem, setPreviewItem] = useState<SharedItem | null>(null)

  useEffect(() => {
    if (!token) return;
    const fetchSharedItem = async () => {
      try {
        const baseUrl = getBaseUrl()
        const tokenStr = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
        const headers = tokenStr ? { "Authorization": `Bearer ${tokenStr}` } : {};
        const res = await fetch(`${baseUrl}/shared/${token}/`, { headers })
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`
            return;
          }
          if (res.status === 403 && data.error === 'access_denied') {
            setRequestStatus(data.request_status)
            setFileName(data.file_name)
            return;
          }
          throw new Error(data.error || "This share link is invalid or has expired.")
        }
        setItem(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSharedItem()
  }, [token])

  const handleDownload = (id: string) => {
    const baseUrl = getBaseUrl()
    const tokenStr = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    window.open(`${baseUrl}/download/${id}/?token=${tokenStr}`, "_blank")
  }

  const handleDownloadFolder = (id: string) => {
    const baseUrl = getBaseUrl()
    const tokenStr = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    window.open(`${baseUrl}/download-folder/${id}/?token=${tokenStr}`, "_blank")
  }

  const handleDoubleClick = (child: SharedItem) => {
    if (child.item_type === "FILE") {
      setPreviewItem(child);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white/60 relative animate-in fade-in duration-700">
        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />
        <Loader2 className="w-10 h-10 animate-spin text-white mb-4 relative z-10" />
        <p>Loading shared secure file...</p>
      </div>
    )
  }

  if (requestStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4 sm:px-6 relative text-white animate-in fade-in duration-700">
        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />
        <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
          <File className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <h1 className="relative z-10 text-2xl sm:text-3xl font-light tracking-wide mb-2">Request Access</h1>
        <p className="relative z-10 text-white/60 mb-8 text-sm sm:text-base px-4">You need permission to access <strong className="break-all">{fileName}</strong>.</p>
        
        {requestStatus === 'NONE' || requestStatus === 'REJECTED' ? (
          <button onClick={async () => {
             const baseUrl = getBaseUrl();
             const tokenStr = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
             await fetch(`${baseUrl}/shared/${token}/request/`, { method: "POST", headers: { "Authorization": `Bearer ${tokenStr}` }});
             setRequestStatus("PENDING");
          }} className="relative z-10 px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-slate-900 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-widest shadow-lg transition-colors hover:bg-white/90 touch-manipulation">
            Request Access
          </button>
        ) : (
          <div className="relative z-10 px-6 sm:px-8 py-3 sm:py-3.5 bg-white/10 text-white rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-widest border border-white/20">
            Request Pending...
          </div>
        )}
      </div>
    )
  }

  if (error || !item) {
    const isAuthError = error.includes("log in") || error.includes("permission");
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4 sm:px-6 relative text-white animate-in fade-in duration-700">
        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />
        <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <File className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <h1 className="relative z-10 text-2xl sm:text-3xl font-light tracking-wide mb-2">{isAuthError ? "Access Denied" : "Item Not Found"}</h1>
        <p className="relative z-10 text-white/60 mb-8 text-sm sm:text-base px-4">{error}</p>
        {isAuthError && (
          <button onClick={() => window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`} className="relative z-10 px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-slate-900 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-widest shadow-lg touch-manipulation">
            Log In to Verify
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 md:p-12 flex justify-center items-start pt-10 sm:pt-20 relative text-white font-serif animate-in fade-in duration-700">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed" style={{ backgroundImage: `url('/login-bg.png')` }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />

      <div className="relative z-10 w-full max-w-4xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden animate-in slide-in-from-bottom-5">
        <div className="p-5 sm:p-8 md:p-12 border-b border-white/10 bg-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {item.item_type === "FOLDER" ? <Folder className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white/20 shrink-0" /> : <File className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white/20 shrink-0" />}
              <h1 className="text-xl sm:text-3xl font-light tracking-wide text-white truncate">{item.name}</h1>
            </div>
            <p className="text-sm sm:text-base text-white/60">Shared securely by <span className="font-medium text-white">{item.owner}</span> • {item.user_role && item.user_role !== "PUBLIC_VIEWER" && <span className="text-white bg-white/10 px-2 py-0.5 rounded text-xs ml-1">{item.user_role}</span>} • {item.item_type === "FOLDER" ? `${item.children?.length} items` : formatBytes(item.size_bytes)}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto shrink-0 mt-4 md:mt-0">
            {typeof window !== "undefined" && !localStorage.getItem("access_token") ? (
              <button onClick={() => window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`} className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold uppercase tracking-widest transition-colors shadow-lg w-full sm:w-auto text-center touch-manipulation">
                Log in to save
              </button>
            ) : !item.is_saved && (
              <button onClick={async () => {
                const baseUrl = getBaseUrl();
                const tokenStr = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
                try {
                  const res = await fetch(`${baseUrl}/shared/${token}/save/`, { method: "POST", headers: { "Authorization": `Bearer ${tokenStr}` }});
                  if (res.ok) {
                    setItem({...item, is_saved: true, user_role: "VIEWER"});
                  }
                } catch (e) {
                  console.error("Failed to save item.");
                }
              }} className="px-6 py-3 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] w-full sm:w-auto text-center whitespace-nowrap touch-manipulation">
                Save to Shared with me
              </button>
            )}

            {item.item_type === "FILE" && (
              <button onClick={() => handleDownload(item.id)} className="px-8 py-3.5 bg-white hover:bg-white/90 text-slate-900 rounded-xl font-semibold uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 w-full sm:w-auto whitespace-nowrap touch-manipulation">
                <Download className="w-5 h-5" /> Download File
              </button>
            )}

            {item.item_type === "FOLDER" && (
              <button onClick={() => handleDownloadFolder(item.id)} className="px-8 py-3.5 bg-white hover:bg-white/90 text-slate-900 rounded-xl font-semibold uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 w-full sm:w-auto whitespace-nowrap touch-manipulation">
                <Download className="w-5 h-5" /> Download All
              </button>
            )}
          </div>
        </div>

        {item.item_type === "FILE" && (
          <div className="p-4 sm:p-6 md:p-8 bg-black/20 border-b border-white/10 flex justify-center overflow-hidden">
            {(() => {
              const pType = getPreviewType(item.name);
              const baseUrl = getBaseUrl();
              const tokenStr = typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token") || "") : "";
              const previewUrl = `${baseUrl}/download/${item.id}/?token=${tokenStr}`;
              
              if (pType === 'image') return <img src={previewUrl} alt={item.name} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl touch-manipulation" />;
              if (pType === 'video') return <video src={previewUrl} controls autoPlay className="max-w-full max-h-[60vh] rounded-lg shadow-2xl bg-black touch-manipulation w-full" />;
              if (pType === 'audio') return <audio src={previewUrl} controls autoPlay className="w-full max-w-md touch-manipulation" />;
              if (pType === 'pdf') return <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-[50vh] sm:h-[70vh] rounded-lg bg-white touch-manipulation" />;
              return (
                <div className="flex flex-col items-center py-8 sm:py-12 text-white/40">
                  <File className="w-16 h-16 sm:w-20 sm:h-20 mb-4 opacity-50" />
                  <p className="text-xs sm:text-sm text-center">Preview not available for this file type.</p>
                </div>
              );
            })()}
          </div>
        )}

        {item.item_type === "FOLDER" && item.children && (
          <div className="p-4 sm:p-6 md:p-8">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/50 mb-4 sm:mb-6 px-2">Folder Contents</h3>
            <div className="space-y-2">
              {item.children.length === 0 ? (
                <p className="text-center text-white/40 py-8 sm:py-10 italic text-sm">This folder is empty.</p>
              ) : (
                item.children.map((child) => (
                  <div key={child.id} onDoubleClick={() => handleDoubleClick(child)} className="flex items-center justify-between p-3 sm:p-4 hover:bg-white/5 rounded-2xl transition-colors border border-transparent hover:border-white/10 group touch-manipulation">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 cursor-pointer select-none">
                      {child.item_type === "FOLDER" ? (
                        <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-white shrink-0" />
                      ) : (
                        getPreviewType(child.name) === 'image' ? (
                          <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                            <img src={`${getBaseUrl()}/thumbnail/${child.id}/?token=${typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token") || "") : ""}&w=64&h=64`} alt={child.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <File className="w-5 h-5 sm:w-6 sm:h-6 text-white/60 shrink-0" />
                        )
                      )}
                      <span className="font-light tracking-wide text-white truncate text-sm sm:text-base">{child.name}</span>
                    </div>
                    <button onClick={() => handleDownload(child.id)} className="p-2 bg-white/10 border border-white/20 rounded-lg text-white/80 hover:text-white hover:bg-white/20 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-sm shrink-0 ml-2 touch-manipulation">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {previewItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
            <button onClick={() => handleDownload(previewItem.id)} className="px-4 py-2 bg-white text-slate-900 rounded-full text-sm font-bold tracking-widest uppercase hover:bg-white/90 transition-colors flex items-center gap-2 shadow-lg">
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={() => setPreviewItem(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors shadow-lg">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="w-full h-full p-8 flex flex-col items-center justify-center relative overflow-hidden">
            {(() => {
              const pType = getPreviewType(previewItem.name);
              const baseUrl = getBaseUrl();
              const tokenStr = typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token") || "") : "";
              
              if (pType === 'image') return <img src={`${baseUrl}/thumbnail/${previewItem.id}/?token=${tokenStr}&w=1200&h=1200`} alt={previewItem.name} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />;
              if (pType === 'video') return <video src={`${baseUrl}/download/${previewItem.id}/?token=${tokenStr}`} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg shadow-2xl bg-black" />;
              if (pType === 'audio') return <audio src={`${baseUrl}/download/${previewItem.id}/?token=${tokenStr}`} controls autoPlay className="w-full max-w-md" />;
              if (pType === 'pdf') return <iframe src={`${baseUrl}/download/${previewItem.id}/?token=${tokenStr}#toolbar=0`} className="w-full h-[85vh] max-w-6xl rounded-lg bg-white" />;
              return (
                <div className="flex flex-col items-center py-12 text-white/40">
                  <File className="w-20 h-20 mb-4 opacity-50" />
                  <p className="text-sm text-center">Preview not available for this file type.</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  )
}