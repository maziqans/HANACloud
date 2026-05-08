"use client"

import { useState, useEffect } from "react"
import * as api from "@/lib/api"
import { SearchBar } from "./search-bar"
import { ViewToggle } from "./view-toggle"
import { FolderCard } from "./folder-card"
import { FileCard } from "./file-card"
import { FileRow } from "./file-row"

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

  const loadItems = async () => {
    try {
      const data = await api.fetchItems(null)
      setCurrentItems(data)
    } catch (error) {
      console.error("Failed to fetch items:", error)
    }
  }

  useEffect(() => {
    loadItems()
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

    try {
      await api.uploadFiles(formData)
      await loadItems()
    } catch (error) {
      console.error("Failed to upload files:", error)
    } finally {
      e.target.value = ''
    }
  }

  const folders = currentItems.filter((item) => item.item_type === "FOLDER")
  const files = currentItems.filter((item) => item.item_type === "FILE")

  const handleDownload = (id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
    const link = document.createElement("a")
    link.href = `${baseUrl}/download/${id}/`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

  return (
    <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-background">
      <input type="file" multiple className="hidden" id="file-upload" onChange={handleUpload} />

      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-card/50">
        <div className="flex items-center justify-between gap-6 mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <ViewToggle view={view} onViewChange={setView} />
        </div>

        {/* Section Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {activeSection}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back! Here are your files.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{folders.length} folders</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{files.length} files</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Folders Section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            Folders
          </h2>
          {view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  name={folder.name}
                  itemCount={0}
                  selected={selectedItems.has(`folder-${folder.id}`)}
                  onSelect={() => toggleSelection(`folder-${folder.id}`)}
                />
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
                />
              ))}
            </div>
          )}
        </section>

        {/* Files Section */}
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
                  onDownload={() => handleDownload(file.id)}
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
                    onDownload={() => handleDownload(file.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
