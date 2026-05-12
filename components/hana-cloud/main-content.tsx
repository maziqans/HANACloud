"use client"

import { useState, useEffect, useRef } from "react"
import * as api from "@/lib/api"
import { SearchBar } from "./search-bar"
import { ViewToggle } from "./view-toggle"
import { FolderCard } from "./folder-card"
import { FileCard } from "./file-card"
import { FileRow } from "./file-row"
import { Inbox, CheckCircle2, Loader2, MoreHorizontal, ChevronRight, Star, Upload } from "lucide-react"

export interface CloudItem {
  id: string
  name: string
  item_type: "FILE" | "FOLDER"
  size_bytes: number
  updated_at: string
  item_count?: number
  is_starred?: boolean
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const getFileType = (name: string): any => {
  if (!name) return "default";
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
  user?: any
}

export function MainContent({ activeSection = "My Drive", user }: MainContentProps) {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [currentItems, setCurrentItems] = useState<CloudItem[]>([])
  const [uploads, setUploads] = useState<{ id: string, filename: string, progress: number, complete: boolean, error?: string }[]>([])
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [navStack, setNavStack] = useState<{id: string, name: string}[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const fetchIdRef = useRef(0)
  
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null)
  const isSelecting = useRef(false)
  const prevSelectedRef = useRef<Set<string>>(new Set())
  
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    confirmText: string;
  } | null>(null);

  const [prevSection, setPrevSection] = useState(activeSection);

  if (activeSection !== prevSection) {
    setPrevSection(activeSection);
    setCurrentParentId(null);
    setNavStack([]);
    setSelectedItems(new Set());
  }

  const loadItems = async (isBackground = false) => {
    const fetchId = ++fetchIdRef.current;
    if (!isBackground) setIsLoading(true)
    try {
      let data;
      if (activeSection === "Trash") {
        data = await api.fetchTrashItems()
      } else if (activeSection === "Recent") {
        data = await api.fetchRecentItems()
      } else if (activeSection === "Starred") {
        data = await api.fetchStarredItems()
      } else {
        data = await api.fetchItems(currentParentId)
      }

      if (fetchId === fetchIdRef.current && Array.isArray(data)) {
        setCurrentItems(data)
      }
    } catch (error) {
      console.error("Failed to fetch items:", error)
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    loadItems();
  }, [activeSection, currentParentId])

  useEffect(() => {
    const handleCreateFolder = () => {
      setNewFolderName("")
      setIsCreateFolderOpen(true)
    }
    window.addEventListener("createFolder", handleCreateFolder)
    return () => window.removeEventListener("createFolder", handleCreateFolder)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = currentItems.map(item => `${item.item_type === 'FOLDER' ? 'folder' : 'file'}-${item.id}`);
        setSelectedItems(new Set(allIds));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItems]);

  useEffect(() => {
    let animationFrameId: number;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting.current) return;
      e.preventDefault();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setSelectionBox(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
      });
    };
    const handleMouseUp = () => {
      isSelecting.current = false;
      setSelectionBox(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (selectionBox && selectionBox.startX === selectionBox.endX && selectionBox.startY === selectionBox.endY) {
      prevSelectedRef.current = new Set(selectedItems);
    }
  }, [selectionBox?.startX, selectionBox?.startY]);

  useEffect(() => {
    if (!selectionBox) return;
    if (Math.abs(selectionBox.endX - selectionBox.startX) < 5 && Math.abs(selectionBox.endY - selectionBox.startY) < 5) return;

    const boxRect = {
      left: Math.min(selectionBox.startX, selectionBox.endX),
      right: Math.max(selectionBox.startX, selectionBox.endX),
      top: Math.min(selectionBox.startY, selectionBox.endY),
      bottom: Math.max(selectionBox.startY, selectionBox.endY),
    };

    const elements = document.querySelectorAll('.selectable-item');
    const newSelected = new Set<string>();

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const isIntersecting = !(rect.right < boxRect.left || rect.left > boxRect.right || rect.bottom < boxRect.top || rect.top > boxRect.bottom);
      if (isIntersecting) {
        const id = el.getAttribute('data-selection-id');
        if (id) newSelected.add(id);
      }
    });

    setSelectedItems(newSelected);
  }, [selectionBox?.endX, selectionBox?.endY]);

  const processUploadFiles = async (files: File[]) => {
    if (!files.length) return
    
    const existingNames = currentItems.map((item) => item.name)
    const filesToUpload: { file: File, finalName: string, path: string }[] = []

    for (const file of files) {
      let finalName = file.name
      let skip = false

      if (existingNames.includes(finalName)) {
        if (window.confirm(`"${finalName}" already exists. Save as duplicate?`)) {
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

      filesToUpload.push({ file, finalName, path })
    }

    if (filesToUpload.length === 0) {
      return
    }

    // Initialize all uploads in state
    const newUploads = filesToUpload.map(f => ({
      id: Math.random().toString(36).substring(7),
      filename: f.finalName,
      progress: 0,
      complete: false,
      file: f.file,
      path: f.path
    }))

    setUploads(prev => [...prev, ...newUploads.map(u => ({ id: u.id, filename: u.filename, progress: 0, complete: false }))])

    // Upload files sequentially one by one
    for (const upload of newUploads) {
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks to bypass ANY server/proxy limits
      const totalChunks = Math.ceil(upload.file.size / CHUNK_SIZE);

      try {
        if (totalChunks <= 1) {
          const formData = new FormData()
          formData.append("files", upload.file, upload.filename)
          formData.append("paths", upload.path)
          
          await api.uploadFiles(formData, currentParentId, (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, progress: percentCompleted } : u))
          })
        } else {
          for (let i = 0; i < totalChunks; i++) {
            const chunk = upload.file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const formData = new FormData();
            formData.append("files", chunk, upload.filename);
            formData.append("paths", upload.path);
            formData.append("chunk_index", i.toString());
            formData.append("total_chunks", totalChunks.toString());
            formData.append("file_id", upload.id);
            formData.append("filename", upload.filename);
            
            await api.uploadFiles(formData, currentParentId, () => {});
            
            const percentCompleted = Math.round(((i + 1) * 100) / totalChunks);
            setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, progress: percentCompleted } : u))
          }
        }
        
        setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, complete: true, progress: 100 } : u))
        await loadItems(true)
        window.dispatchEvent(new Event("storageUpdated"))
      } catch (error) {
        console.error("Failed to upload file:", upload.filename, error)
        setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, error: "Failed" } : u))
      }
      
      // Remove completed uploads from UI after 5 seconds
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== upload.id))
      }, 5000)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    await processUploadFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    // Disable dragging directly into the trash
    if (activeSection === "Trash") return
    if (!e.dataTransfer.files?.length) return
    
    await processUploadFiles(Array.from(e.dataTransfer.files))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.selectable-item')) return; 
    isSelecting.current = true;
    setSelectionBox({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY });
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedItems(new Set());
    }
  };

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
      setTimeout(() => loadItems(true), 500) // silently update recent tab sorting in background
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
  
  const toggleStar = async (id: string, is_starred: boolean) => {
    await api.toggleStar(id, is_starred);
    await loadItems(true);
    window.dispatchEvent(new Event("storageUpdated"));
  }

  const executeConfirmAction = async () => {
    if (confirmAction) {
      await confirmAction.action();
      setConfirmAction(null);
    }
  };

  const requestDelete = (id: string, isPermanent: boolean) => {
    setConfirmAction({
      isOpen: true,
      title: isPermanent ? "Delete Forever?" : "Move to Trash?",
      message: isPermanent ? "This item will be permanently deleted. This cannot be undone." : "This item will be moved to the trash.",
      confirmText: isPermanent ? "Delete Forever" : "Move to Trash",
      action: async () => {
        if (isPermanent) await api.permanentDelete(id);
        else await api.moveToTrash(id);
        await loadItems(true);
        window.dispatchEvent(new Event("storageUpdated"));
      }
    });
  };

  const handleDeleteSelected = () => {
    setConfirmAction({
      isOpen: true,
      title: "Move to Trash?",
      message: `Are you sure you want to move ${selectedItems.size} item(s) to the trash?`,
      confirmText: "Move to Trash",
      action: async () => {
        for (const idStr of selectedItems) await api.moveToTrash(idStr.replace(/file-|folder-/, ''));
        setSelectedItems(new Set()); await loadItems(true); window.dispatchEvent(new Event("storageUpdated"));
      }
    });
  }

  return (
    <main 
      className="flex-1 flex flex-col h-svh overflow-hidden bg-background animate-in fade-in duration-700 relative"
      onDragOver={(e) => { e.preventDefault(); if (activeSection !== "Trash") setIsDragging(true); }}
    >
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
              {activeSection === "Trash" ? "Items in trash will be permanently deleted when cleared." : activeSection === "Recent" ? "Your 20 most recently viewed files." : activeSection === "Starred" ? "Your favorite files and folders." : `Welcome back, ${user?.first_name || user?.username}! Here are your files.`}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {activeSection === "Trash" && (
              <button 
                onClick={() => {
                  setConfirmAction({
                    isOpen: true,
                    title: "Empty Trash?",
                    message: "All items in the trash will be permanently deleted from the cloud. This action cannot be undone.",
                    confirmText: "Empty Trash",
                    action: async () => {
                      await api.emptyTrash(); await loadItems(true); window.dispatchEvent(new Event("storageUpdated"));
                    }
                  });
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
      <div 
        className="flex-1 overflow-auto px-8 py-6"
        onMouseDown={handleMouseDown}
      >
        {/* Selection Action Bar */}
        {selectedItems.size > 0 && (
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl flex items-center justify-between mb-6 shadow-lg animate-in slide-in-from-top-2">
            <span className="font-medium">{selectedItems.size} document(s) selected</span>
            {activeSection === "Trash" ? (
              <div className="flex items-center gap-4 text-sm font-medium">
                <button onClick={async () => {
                  for (const idStr of selectedItems) await api.moveToTrash(idStr.replace(/file-|folder-/, ''), false);
                  setSelectedItems(new Set()); loadItems(true); window.dispatchEvent(new Event("storageUpdated"));
                }} className="hover:underline">Restore</button>
                <button onClick={async () => {
                  setConfirmAction({
                    isOpen: true, title: "Delete Forever?", confirmText: "Delete Forever",
                    message: `Are you sure you want to permanently delete ${selectedItems.size} item(s)?`,
                    action: async () => {
                      for (const idStr of selectedItems) await api.permanentDelete(idStr.replace(/file-|folder-/, ''));
                      setSelectedItems(new Set()); await loadItems(true); window.dispatchEvent(new Event("storageUpdated"));
                    }
                  });
                }} className="hover:underline text-red-200">Delete Permanently</button>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-sm font-medium">
                <button onClick={() => alert("Move functionality coming soon!")} className="hover:underline">Move</button>
                <button onClick={() => alert("Copy functionality coming soon!")} className="hover:underline">Copy</button>
                <button onClick={handleDeleteSelected} className="hover:underline text-red-200">Move to Trash</button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground animate-in fade-in duration-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-80 mb-4" />
            <p className="text-sm">Loading your files...</p>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground animate-in fade-in zoom-in-95 duration-700 delay-150">
            <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 opacity-50" />
            </div>
            <h3 className="text-xl font-medium text-foreground">No files or folders yet</h3>
            <p className="text-sm mt-2">{activeSection === "Recent" ? "Open some files to see them here." : activeSection === "Starred" ? "Star files and folders to see them here." : "Upload files or create folders to get started."}</p>
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
                        className="relative group selectable-item"
                        data-selection-id={`folder-${folder.id}`}
                      >
                        <FolderCard
                          name={folder.name}
                          itemCount={folder.item_count || 0}
                          selected={selectedItems.has(`folder-${folder.id}`)}
                          onSelect={() => toggleSelection(`folder-${folder.id}`)}
                        />
                        {folder.is_starred && (
                          <div className="absolute top-3 right-10 p-1.5 text-yellow-500 pointer-events-none">
                            <Star className="w-4 h-4 fill-current" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); const el = document.getElementById(`folder-menu-${folder.id}`); if(el) el.classList.toggle('hidden'); }} className="p-1.5 rounded-lg hover:bg-secondary bg-card/50 backdrop-blur border border-border">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          <div id={`folder-menu-${folder.id}`} className="hidden absolute right-0 top-8 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 py-1" onMouseLeave={(e) => e.currentTarget.classList.add('hidden')}>
                            {activeSection === "Trash" ? (
                              <>
                                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-foreground" onClick={(e) => { e.stopPropagation(); api.moveToTrash(folder.id, false).then(() => { loadItems(true); window.dispatchEvent(new Event("storageUpdated")); }) }}>Restore</button>
                                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive" onClick={(e) => { e.stopPropagation(); requestDelete(folder.id, true); }}>Delete Forever</button>
                              </>
                            ) : (
                              <>
                                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors" onClick={(e) => { e.stopPropagation(); toggleStar(folder.id, !folder.is_starred); }}>{folder.is_starred ? "Remove from Starred" : "Add to Starred"}</button>
                                <button className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); requestDelete(folder.id, false); }}>Move to Trash</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {folders.map((folder) => (
                      <div key={folder.id} data-selection-id={`folder-${folder.id}`} className="selectable-item">
                      <FileRow
                        name={folder.name}
                        type="default"
                        size={folder.item_count === 1 ? "1 item" : `${folder.item_count || 0} items`}
                        modified={folder.updated_at ? new Date(folder.updated_at).toLocaleDateString() : "—"}
                        selected={selectedItems.has(`folder-${folder.id}`)}
                        onSelect={() => toggleSelection(`folder-${folder.id}`)}
                        onDoubleClick={() => handleDoubleClick(folder)}
                        isStarred={folder.is_starred}
                        onToggleStar={() => toggleStar(folder.id, !folder.is_starred)}
                        isTrash={activeSection === "Trash"}
                        onDelete={() => requestDelete(folder.id, false)}
                        onRestore={async () => { await api.moveToTrash(folder.id, false); loadItems(true); window.dispatchEvent(new Event("storageUpdated")); }}
                        onPermanentDelete={() => requestDelete(folder.id, true)}
                        onShare={() => alert("Share functionality coming soon!")}
                        onDownload={() => alert("Downloading entire folders coming soon!")}
                      />
                      </div>
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
                      <div key={file.id} data-selection-id={`file-${file.id}`} className="selectable-item h-full">
                      <FileCard
                        name={file.name}
                        type={getFileType(file.name)}
                        size={formatBytes(file.size_bytes)}
                        selected={selectedItems.has(`file-${file.id}`)}
                        onSelect={() => toggleSelection(`file-${file.id}`)}
                        onDoubleClick={() => handleDoubleClick(file)}
                        isStarred={file.is_starred}
                        onToggleStar={() => toggleStar(file.id, !file.is_starred)}
                        isTrash={activeSection === "Trash"}
                        onDownload={() => handleDownload(file.id)}
                        onShare={() => alert("Share functionality coming soon!")}
                        onDelete={() => requestDelete(file.id, false)}
                        onRestore={async () => { await api.moveToTrash(file.id, false); loadItems(true); window.dispatchEvent(new Event("storageUpdated")); }}
                        onPermanentDelete={() => requestDelete(file.id, true)}
                      />
                      </div>
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
                        <div key={file.id} data-selection-id={`file-${file.id}`} className="selectable-item">
                        <FileRow
                          name={file.name}
                          type={getFileType(file.name)}
                          size={formatBytes(file.size_bytes)}
                          modified={file.updated_at ? new Date(file.updated_at).toLocaleDateString() : "—"}
                          selected={selectedItems.has(`file-${file.id}`)}
                          onSelect={() => toggleSelection(`file-${file.id}`)}
                          onDoubleClick={() => handleDoubleClick(file)}
                          isStarred={file.is_starred}
                          onToggleStar={() => toggleStar(file.id, !file.is_starred)}
                          isTrash={activeSection === "Trash"}
                          onDownload={() => handleDownload(file.id)}
                          onShare={() => alert("Share functionality coming soon!")}
                          onDelete={() => requestDelete(file.id, false)}
                          onRestore={async () => { await api.moveToTrash(file.id, false); loadItems(true); window.dispatchEvent(new Event("storageUpdated")); }}
                          onPermanentDelete={() => requestDelete(file.id, true)}
                        />
                        </div>
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
                  const name = newFolderName.trim();
                  setIsCreateFolderOpen(false);
                  
                  // Optimistic UI Update (Instant feedback)
                  const tempId = "temp-" + Date.now();
                  setCurrentItems(prev => [{
                    id: tempId,
                    name: name,
                    item_type: "FOLDER",
                    size_bytes: 0,
                    updated_at: new Date().toISOString(),
                    item_count: 0,
                    is_starred: false
                  }, ...prev]);

                  try {
                    await api.createFolder(name, currentParentId);
                  } finally { await loadItems(true); }
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
                    const name = newFolderName.trim();
                    setIsCreateFolderOpen(false);
                    
                    const tempId = "temp-" + Date.now();
                    setCurrentItems(prev => [{
                      id: tempId,
                      name: name,
                      item_type: "FOLDER",
                      size_bytes: 0,
                      updated_at: new Date().toISOString(),
                      item_count: 0,
                      is_starred: false
                    }, ...prev]);

                    try {
                      await api.createFolder(name, currentParentId);
                    } finally { await loadItems(true); }
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

      {/* Universal Confirmation Modal */}
      {confirmAction && confirmAction.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-semibold mb-2">{confirmAction.title}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmAction.message}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeConfirmAction}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-5 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Tab */}
      {uploads.length > 0 && (
        <div className="fixed bottom-6 right-6 w-80 bg-card border border-border shadow-2xl rounded-xl overflow-hidden z-50 animate-in slide-in-from-bottom-5 max-h-96 flex flex-col">
          <div className="bg-secondary/50 px-4 py-3 border-b border-border flex justify-between items-center text-sm font-medium text-foreground">
            Uploading {uploads.length} item(s)
          </div>
          <div className="overflow-y-auto max-h-80 custom-scrollbar">
            {uploads.map((upload) => (
              <div key={upload.id} className="p-3 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3 w-full">
                  {upload.complete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : upload.error ? (
                    <div className="w-5 h-5 bg-destructive rounded-full shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">
                      {upload.filename}
                    </p>
                    {!upload.complete && !upload.error && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {upload.progress}%
                      </p>
                    )}
                    {upload.error && (
                      <p className="text-xs text-destructive mt-0.5">Upload failed</p>
                    )}
                  </div>
                </div>
                {!upload.complete && !upload.error && (
                  <div className="h-1.5 w-full bg-secondary mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${upload.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div 
          className="absolute inset-0 z-[100] bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 m-4 rounded-2xl flex items-center justify-center transition-all"
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="bg-card px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 pointer-events-none">
             <Upload className="w-12 h-12 text-primary" />
             <h2 className="text-xl font-semibold text-foreground">Drop files here to upload</h2>
          </div>
        </div>
      )}

      {/* Drag Selection Box */}
      {selectionBox && (
        <div 
          className="fixed border border-primary/50 bg-primary/10 pointer-events-none z-[100]"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.endX),
            top: Math.min(selectionBox.startY, selectionBox.endY),
            width: Math.abs(selectionBox.endX - selectionBox.startX),
            height: Math.abs(selectionBox.endY - selectionBox.startY),
          }}
        />
      )}
    </main>
  )
}
