"use client"

import { useState, useEffect } from "react"
import * as api from "@/lib/api"
import { SearchBar } from "./search-bar"
import { ViewToggle } from "./view-toggle"
import { FolderCard } from "./folder-card"
import { FileCard } from "./file-card"
import { FileRow } from "./file-row"
import { Inbox, CheckCircle2, Loader2, MoreHorizontal, ChevronRight } from "lucide-react"

export interface CloudItem {
  id: string
  name: string
  item_type: "FILE" | "FOLDER"
  size_bytes: number
  updated_at: string
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const getFileType = (name: string): any => {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx")) return "document"
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image"
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "video"
  if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "audio"
  return "default"
}

const getUniqueFilename = (filename: string, existingNames: string[]) => {
  let newName = filename
  let counter = 1
  const dotIndex = filename.lastIndexOf('.')
  const namePart = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename
  const extPart = dotIndex !== -1 ? filename.slice(dotIndex) : ''

  while (existingNames.includes(newName)) {
    newName = `${namePart} (${counter})${extPart}`
    counter++
  }
  return newName
}

interface MainContentProps {
  activeSection?: string
}

export function MainContent({ activeSection = "My Drive" }: MainContentProps) {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [currentItems, setCurrentItems] = useState<CloudItem[]>([])
  const [uploadState, setUploadState] = useState<{ progress: number, total: number, complete: boolean, filename: string } | null>(null)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [navStack, setNavStack] = useState<{id: string, name: string}[]>([])

  const loadItems = async () => {
    try {
      if (activeSection === "Trash") {
        const data = await api.fetchTrashItems()
        setCurrentItems(data)
      } else {
        const data = await api.fetchItems(currentParentId)
        setCurrentItems(data)
      }
    } catch (error) {
      console.error("Failed to fetch items:", error)
    }
  }

  useEffect(() => {
    setCurrentParentId(null);
    setNavStack([]);
    setSelectedItems(new Set());
    loadItems();
  }, [activeSection])

  useEffect(() => {
    loadItems()
  }, [currentParentId])

  useEffect(() => {
    const handleCreateFolder = () => {
      setNewFolderName("")
      setIsCreateFolderOpen(true)
    }
    window.addEventListener("createFolder", handleCreateFolder)
    return () => window.removeEventListener("createFolder", handleCreateFolder)
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return

    const formData = new FormData()
    const existingNames = currentItems.map((item) => item.name)
    const files = Array.from(e.target.files)

    for (const file of files) {
      let finalName = file.name
      let skip = false

      if (existingNames.includes(finalName)) {
        if (window.confirm("This file already exists. Save as duplicate?")) {
          finalName = getUniqueFilename(finalName, existingNames)
          existingNames.push(finalName)
        } else {
          skip = true
        }
      }

      if (skip) continue

      let path = file.webkitRelativePath || file.name
      if (finalName !== file.name) {
        const pathParts = path.split('/')
        pathParts[pathParts.length - 1] = finalName
        path = pathParts.join('/')
      }

      formData.append("files", file, finalName)
      formData.append("paths", path)
    }

    if (!formData.has("files")) {
      e.target.value = ''
      return
    }

    const fileNames = files.map(f => f.name).join(", ")
    setUploadState({ progress: 0, total: files.length, complete: false, filename: fileNames })

    try {
      await api.uploadFiles(formData, currentParentId, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        setUploadState(prev => prev ? { ...prev, progress: percentCompleted } : null)
      })
      await loadItems()
      window.dispatchEvent(new Event("storageUpdated"))
      setUploadState(prev => prev ? { ...prev, complete: true, progress: 100 } : null)
      setTimeout(() => setUploadState(null), 4000)
    } catch (error) {
      console.error("Failed to upload files:", error)
    } finally {
      e.target.value = ''
    }
  }

  const folders = currentItems.filter((item) => item.item_type === "FOLDER")
  const files = currentItems.filter((item) => item.item_type === "FILE")

  const handleDownload = (id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://192.168.56.101:8080/api"
    const link = document.createElement("a")
    link.href = `${baseUrl}/download/${id}/`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDoubleClick = (item: CloudItem) => {
    if (activeSection === "Trash") return;
    if (item.item_type === "FOLDER") {
      setCurrentParentId(item.id)
      setNavStack(prev => [...prev, { id: item.id, name: item.name }])
      setSelectedItems(new Set())
    } else {
      handleDownload(item.id)
    }
  }

  const navigateTo = (index: number) => {
    const newStack = navStack.slice(0, index + 1)
    setNavStack(newStack)
    setCurrentParentId(newStack[newStack.length - 1].id)
  }

  const toggleSelection = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleDeleteSelected = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} item(s)?`)) {
      for (const idStr of selectedItems) {
        const id = idStr.replace('file-', '').replace('folder-', '')
        await api.moveToTrash(id)
      }
      setSelectedItems(new Set())
      await loadItems()
      window.dispatchEvent(new Event("storageUpdated"))
    }
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-background animate-in fade-in duration-700">
      <input type="file" multiple className="hidden" id="file-upload" onChange={handleUpload} />
      <input type="file" multiple webkitdirectory="true" className="hidden" id="folder-upload" onChange={handleUpload} />

      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-card/50">
        <div className="flex items-center justify-between gap-6 mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <ViewToggle view={view} onViewChange={setView} />
        </div>

        {/* Section Title */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <button 
                onClick={() => { setCurrentParentId(null); setNavStack([]); setSelectedItems(new Set()); }}
                className="hover:underline"
              >
                {activeSection}
              </button>
              {navStack.map((nav, index) => (
                <div key={nav.id} className="flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  <button 
                    onClick={() => navigateTo(index)}
                    className="hover:underline truncate max-w-[150px]"
                  >
                    {nav.name}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSection === "Trash" ? "Items in trash will be permanently deleted when cleared." : "Welcome back! Here are your files."}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {activeSection === "Trash" && (
              <button 
                onClick={async () => {
                  if (window.confirm("Empty trash? All items will be permanently deleted from the cloud. This cannot be undone.")) {
                    await api.emptyTrash();
                    await loadItems();
                    window.dispatchEvent(new Event("storageUpdated"));
                  }
                }}
                className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-xl transition-colors font-medium mr-2"
              >
                Clear Trash
              </button>
            )}
            <span>{folders.length} folders</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{files.length} files</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Selection Action Bar */}
        {selectedItems.size > 0 && (
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl flex items-center justify-between mb-6 shadow-lg animate-in slide-in-from-top-2">
            <span className="font-medium">{selectedItems.size} document(s) selected</span>
            {activeSection === "Trash" ? (
              <div className="flex items-center gap-4 text-sm font-medium">
                <button onClick={async () => {
                  for (const idStr of selectedItems) await api.moveToTrash(idStr.replace(/file-|folder-/, ''), false);
                  setSelectedItems(new Set()); loadItems(); window.dispatchEvent(new Event("storageUpdated"));
                }} className="hover:underline">Restore</button>
                <button onClick={async () => {
                  if(window.confirm("Permanently delete selected items?")) {
                    for (const idStr of selectedItems) await api.permanentDelete(idStr.replace(/file-|folder-/, ''));
                    setSelectedItems(new Set()); loadItems(); window.dispatchEvent(new Event("storageUpdated"));
                  }
                }} className="hover:underline text-red-200">Delete Permanently</button>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-sm font-medium">
                <button onClick={() => alert("Move functionality coming soon!")} className="hover:underline">Move</button>
                <button onClick={() => alert("Copy functionality coming soon!")} className="hover:underline">Copy</button>
                <button onClick={handleDeleteSelected} className="hover:underline text-red-200">Delete</button>
              </div>
            )}
          </div>
        )}

        {folders.length === 0 && files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground animate-in fade-in zoom-in-95 duration-700 delay-150">
            <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 opacity-50" />
            </div>
            <h3 className="text-xl font-medium text-foreground">No files or folders yet</h3>
            <p className="text-sm mt-2">Upload files or create folders to get started.</p>
          </div>
        ) : (
          <>
            {/* Folders Section */}
            {folders.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-medium text-muted-foreground mb-4">
                  Folders
                </h2>
                {view === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {folders.map((folder) => (
                      <div 
                        key={folder.id} 
                        onDoubleClick={() => handleDoubleClick(folder)}
                        className="relative group"
                      >
                        <FolderCard
                          name={folder.name}
                          itemCount={0}
                          selected={selectedItems.has(`folder-${folder.id}`)}
                          onSelect={() => toggleSelection(`folder-${folder.id}`)}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); const el = document.getElementById(`folder-menu-${folder.id}`); if(el) el.classList.toggle('hidden'); }} className="p-1.5 rounded-lg hover:bg-secondary bg-card/50 backdrop-blur border border-border">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          <div id={`folder-menu-${folder.id}`} className="hidden absolute right-0 top-8 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 py-1" onMouseLeave={(e) => e.currentTarget.classList.add('hidden')}>
                            {activeSection === "Trash" ? (
                              <>
                                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-foreground" onClick={(e) => { e.stopPropagation(); api.moveToTrash(folder.id, false).then(() => { loadItems(); window.dispatchEvent(new Event("storageUpdated")); }) }}>Restore</button>
                                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive" onClick={(e) => { e.stopPropagation(); if(window.confirm("Permanently delete folder?")) api.permanentDelete(folder.id).then(() => { loadItems(); window.dispatchEvent(new Event("storageUpdated")); }) }}>Delete Forever</button>
                              </>
                            ) : (
                              <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive" onClick={(e) => { 
                                e.stopPropagation(); 
                                if(window.confirm("Delete folder?")) {
                                  api.moveToTrash(folder.id).then(() => { loadItems(); window.dispatchEvent(new Event("storageUpdated")); });
                                }
                              }}>Delete</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {folders.map((folder) => (
                      <FileRow
                        key={folder.id}
                        name={folder.name}
                        type="default"
                        size="—"
                        modified={folder.updated_at ? new Date(folder.updated_at).toLocaleDateString() : "—"}
                        selected={selectedItems.has(`folder-${folder.id}`)}
                        onSelect={() => toggleSelection(`folder-${folder.id}`)}
                        onDoubleClick={() => handleDoubleClick(folder)}
                        isTrash={activeSection === "Trash"}
                        onDelete={async () => { if(window.confirm("Delete folder?")) { await api.moveToTrash(folder.id); loadItems(); window.dispatchEvent(new Event("storageUpdated")); } }}
                        onRestore={async () => { await api.moveToTrash(folder.id, false); loadItems(); window.dispatchEvent(new Event("storageUpdated")); }}
                        onPermanentDelete={async () => { if(window.confirm("Permanently delete folder?")) { await api.permanentDelete(folder.id); loadItems(); window.dispatchEvent(new Event("storageUpdated")); } }}
                        onShare={() => alert("Share functionality coming soon!")}
                        onDownload={() => alert("Downloading entire folders coming soon!")}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Files Section */}
            {files.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-muted-foreground mb-4">
                  Files
                </h2>
                {view === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {files.map((file) => (
                      <FileCard
                        key={file.id}
                        name={file.name}
                        type={getFileType(file.name)}
                        size={formatBytes(file.size_bytes)}
                        selected={selectedItems.has(`file-${file.id}`)}
                        onSelect={() => toggleSelection(`file-${file.id}`)}
                        onDoubleClick={() => handleDoubleClick(file)}
                        isTrash={activeSection === "Trash"}
                        onDownload={() => handleDownload(file.id)}
                        onShare={() => alert("Share functionality coming soon!")}
                        onDelete={async () => { if(window.confirm("Delete file?")) { await api.moveToTrash(file.id); loadItems(); window.dispatchEvent(new Event("storageUpdated")); } }}
                        onRestore={async () => { await api.moveToTrash(file.id, false); loadItems(); window.dispatchEvent(new Event("storageUpdated")); }}
                        onPermanentDelete={async () => { if(window.confirm("Permanently delete file?")) { await api.permanentDelete(file.id); loadItems(); window.dispatchEvent(new Event("storageUpdated")); } }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[auto_1fr_100px_140px_40px] gap-4 items-center px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border bg-secondary/50">
                      <div className="w-5" />
                      <div>Name</div>
                      <div className="text-right">Size</div>
                      <div className="text-right">Modified</div>
                      <div />
                    </div>
                    <div className="divide-y divide-border/50">
                      {files.map((file) => (
                        <FileRow
                          key={file.id}
                          name={file.name}
                          type={getFileType(file.name)}
                          size={formatBytes(file.size_bytes)}
                          modified={file.updated_at ? new Date(file.updated_at).toLocaleDateString() : "—"}
                          selected={selectedItems.has(`file-${file.id}`)}
                          onSelect={() => toggleSelection(`file-${file.id}`)}
                          onDoubleClick={() => handleDoubleClick(file)}
                          isTrash={activeSection === "Trash"}
                          onDownload={() => handleDownload(file.id)}
                          onShare={() => alert("Share functionality coming soon!")}
                          onDelete={async () => { if(window.confirm("Delete file?")) { await api.moveToTrash(file.id); loadItems(); window.dispatchEvent(new Event("storageUpdated")); } }}
                          onRestore={async () => { await api.moveToTrash(file.id, false); loadItems(); window.dispatchEvent(new Event("storageUpdated")); }}
                          onPermanentDelete={async () => { if(window.confirm("Permanently delete file?")) { await api.permanentDelete(file.id); loadItems(); window.dispatchEvent(new Event("storageUpdated")); } }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
            <input 
              type="text" 
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all mb-6"
              placeholder="Folder name"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  setIsCreateFolderOpen(false);
                  await api.createFolder(newFolderName.trim(), currentParentId);
                  await loadItems();
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsCreateFolderOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (newFolderName.trim()) {
                    setIsCreateFolderOpen(false);
                    await api.createFolder(newFolderName.trim(), currentParentId);
                    await loadItems();
                  }
                }}
                className="cozy-button text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Tab */}
      {uploadState && (
        <div className="fixed bottom-6 right-6 w-80 bg-card border border-border shadow-2xl rounded-xl overflow-hidden z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-secondary/50 px-4 py-4 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-3 w-full">
              {uploadState.complete ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-foreground">
                  {uploadState.complete ? "Upload complete" : uploadState.filename}
                </p>
                {!uploadState.complete && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Uploading {uploadState.total} item(s) • {uploadState.progress}%
                  </p>
                )}
              </div>
            </div>
          </div>
          {!uploadState.complete && (
            <div className="h-1.5 w-full bg-secondary">
               <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadState.progress}%` }} />
            </div>
          )}
        </div>
      )}
    </main>
  )
}
