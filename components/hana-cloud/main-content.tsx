"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import * as api from "@/lib/api"
import { useVirtualizer } from "@tanstack/react-virtual"
import { SearchBar } from "./search-bar"
import { ViewToggle } from "./view-toggle"
import { FolderCard } from "./folder-card"
import { FileCard } from "./file-card"
import { FileRow } from "./file-row"
import { Inbox, CheckCircle2, Loader2, MoreHorizontal, ChevronRight, ChevronDown, Star, Upload, X, Download, ArrowUp, ArrowDown, Play, Bell, ShieldAlert, AlertCircle, Menu, Folder, FileText, FileSpreadsheet, Monitor, Image as ImageIcon, File as FileIcon, Film, Archive } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CloudItem {
  id: string
  name: string
  item_type: "FILE" | "FOLDER"
  size_bytes: number
  updated_at: string
  item_count?: number
  is_starred?: boolean
  owner?: string
  can_edit?: boolean
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

const getPreviewType = (name: string) => {
  if (!name) return null;
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.ogg'].includes(ext)) return 'video';
  if (['.mp3', '.wav'].includes(ext)) return 'audio';
  if (['.pdf'].includes(ext)) return 'pdf';
  return null;
}

const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

const useGridDimensions = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [dimensions, setDimensions] = useState({ columns: 4, width: 0 });

  useEffect(() => {
    const calculateDimensions = (width: number) => {
      let columns = 4;
      if (width > 1024) columns = 4;
      else if (width > 768) columns = 3;
      else if (width > 480) columns = 2;
      else columns = 1;
      return { columns, width };
    };

    const target = containerRef?.current;
    if (!target) return;

    setDimensions(calculateDimensions(target.getBoundingClientRect().width));

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setDimensions(calculateDimensions(entries[0].contentRect.width));
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [containerRef]);

  return dimensions;
};

const itemCache: Record<string, CloudItem[]> = {}
const scrollCache: Record<string, number> = {}

let globalStateCache = {
  view: "grid" as "grid" | "list",
  searchQuery: "",
  sortBy: "name" as "name" | "date" | "size",
  sortDirection: "asc" as "asc" | "desc",
  currentParentId: null as string | null,
  navStack: [] as {id: string, name: string, can_edit: boolean}[],
}

interface MainContentProps {
  activeSection?: string
  user?: any
  initialItems?: CloudItem[]
}

export function MainContent({ activeSection = "My Drive", user, initialItems }: MainContentProps) {
  if (initialItems && !itemCache['My Drive-root']) {
    itemCache['My Drive-root'] = initialItems;
  }

  const [view, setView] = useState<"grid" | "list">(globalStateCache.view)
  const [searchQuery, setSearchQuery] = useState(globalStateCache.searchQuery)
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">(globalStateCache.sortBy)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(globalStateCache.sortDirection)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [currentItems, setCurrentItems] = useState<CloudItem[]>(initialItems || [])
  const [uploads, setUploads] = useState<{ id: string, filename: string, progress: number, complete: boolean, error?: string }[]>([])
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [currentParentId, setCurrentParentId] = useState<string | null>(globalStateCache.currentParentId)
  const [navStack, setNavStack] = useState<{id: string, name: string, can_edit: boolean}[]>(globalStateCache.navStack)
  const [isLoading, setIsLoading] = useState(initialItems ? false : true)
  const [isDragging, setIsDragging] = useState(false)
  const fetchIdRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null)
  const isSelecting = useRef(false)
  const prevSelectedRef = useRef<Set<string>>(new Set())
  
  const [shareModal, setShareModal] = useState<{
    isOpen: boolean;
    url: string;
    item_id: string;
    share_mode: "RESTRICTED" | "PUBLIC";
    permissions: { email: string; role: string }[];
  } | null>(null)
  const [shareEmailInput, setShareEmailInput] = useState("")
  const [shareRoleInput, setShareRoleInput] = useState("VIEWER")
  const [isSavingShare, setIsSavingShare] = useState(false)
  const [emailSuggestions, setEmailSuggestions] = useState<{email: string, name: string}[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [generalAccessDropdownOpen, setGeneralAccessDropdownOpen] = useState(false)
  const [addRoleDropdownOpen, setAddRoleDropdownOpen] = useState(false)
  const [openRoleMenuId, setOpenRoleMenuId] = useState<string | null>(null)
  
  const [isCopied, setIsCopied] = useState(false)
  const [permissionWarning, setPermissionWarning] = useState(false)
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false)
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [showRequests, setShowRequests] = useState(false)

  const [folderPicker, setFolderPicker] = useState<{
    isOpen: boolean;
    action: "move" | "copy";
    currentFolderId: string | null;
    navStack: {id: string, name: string}[];
  } | null>(null);
  const [pickerFolders, setPickerFolders] = useState<CloudItem[]>([]);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerHasFiles, setPickerHasFiles] = useState(false);

  const getToken = () => typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token") || "") : "";
  
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    confirmText: string;
  } | null>(null);
  
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    isOpen: boolean;
    filename: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  
  const [genericAlert, setGenericAlert] = useState<{ title: string; message: string; } | null>(null);

  const [prevSection, setPrevSection] = useState(activeSection);

  if (activeSection !== prevSection) {
    setPrevSection(activeSection);
    setCurrentParentId(null);
    setNavStack([]);
    setSelectedItems(new Set());
  }
  
  const itemsRef = useRef(currentItems);
  useEffect(() => {
    itemsRef.current = currentItems;
  }, [currentItems]);

  useEffect(() => {
    globalStateCache.view = view;
    globalStateCache.searchQuery = searchQuery;
    globalStateCache.sortBy = sortBy;
    globalStateCache.sortDirection = sortDirection;
    globalStateCache.currentParentId = currentParentId;
    globalStateCache.navStack = navStack;
  }, [view, searchQuery, sortBy, sortDirection, currentParentId, navStack]);

  const currentFolderCanEdit = useMemo(() => {
    if (activeSection === "Trash" || activeSection === "Recent" || activeSection === "Starred") return false;
    if (activeSection === "Shared with me" && !currentParentId) return false;
    if (currentParentId && navStack.length > 0) return navStack[navStack.length - 1].can_edit;
    return true; // Root of My Drive
  }, [activeSection, currentParentId, navStack]);

  useEffect(() => {
    // Broadcast the permission status so the Sidebar can grey out its Add buttons!
    window.dispatchEvent(new CustomEvent('canEditChange', { detail: currentFolderCanEdit }));
  }, [currentFolderCanEdit]);

  const getCacheKey = () => `${activeSection}-${currentParentId || 'root'}`;

  const loadItems = async (isBackground = false) => {
    const key = getCacheKey();
    const fetchId = ++fetchIdRef.current;
    
    if (itemCache[key] && !isBackground) {
      setCurrentItems(itemCache[key]);
      setIsLoading(false);
      isBackground = true;
    } else if (!isBackground) {
      setIsLoading(true);
    }

    try {
      let data;
      if (currentParentId) {
        data = await api.fetchItems(currentParentId)
      } else if (activeSection === "Trash") {
        data = await api.fetchTrashItems()
      } else if (activeSection === "Shared with me") {
        data = await api.fetchSharedWithMeItems()
      } else if (activeSection === "Recent") {
        data = await api.fetchRecentItems()
      } else if (activeSection === "Starred") {
        data = await api.fetchStarredItems()
      } else {
        data = await api.fetchItems(null)
      }

      if (fetchId === fetchIdRef.current && Array.isArray(data)) {
        itemCache[key] = data;
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
    if (folderPicker?.isOpen) {
      const loadPickerFolders = async () => {
        setIsPickerLoading(true);
        try {
          const data = await api.fetchItems(folderPicker.currentFolderId);
          if (Array.isArray(data)) {
            setPickerFolders(data.filter(item => item.item_type === "FOLDER"));
            setPickerHasFiles(data.some(item => item.item_type === "FILE"));
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsPickerLoading(false);
        }
      }
      loadPickerFolders();
    }
  }, [folderPicker?.currentFolderId, folderPicker?.isOpen]);

  const fetchRequests = async () => {
    try {
      const data = await api.getPendingRequests();
      setPendingRequests(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  useEffect(() => {
    loadItems();
    fetchRequests();
  }, [activeSection, currentParentId])

  useEffect(() => {
    const interval = setInterval(fetchRequests, 10000); // Poll for access requests every 10 seconds
    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    const handlePermissionWarning = () => setPermissionWarning(true)
    window.addEventListener("showPermissionWarning", handlePermissionWarning)
    return () => window.removeEventListener("showPermissionWarning", handlePermissionWarning)
  }, [])

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

  useEffect(() => {
    if (scrollContainerRef.current && !isLoading) {
      const savedScroll = scrollCache[getCacheKey()] || 0;
      scrollContainerRef.current.scrollTop = savedScroll;
    }
  }, [activeSection, currentParentId, isLoading]);

  const processUploadFiles = async (files: File[]) => {
    if (!files.length) return
    
    const existingNames = currentItems.map((item) => item.name)
    const filesToUpload: { file: File, finalName: string, path: string }[] = []

    for (const file of files) {
      let finalName = file.name
      let skip = false

      if (existingNames.includes(finalName)) {
        const keep = await new Promise<boolean>((resolve) => {
          setDuplicateConfirm({ isOpen: true, filename: finalName, resolve });
        });
        setDuplicateConfirm(null);
        if (keep) {
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
    if (!currentFolderCanEdit) {
      window.dispatchEvent(new Event('showPermissionWarning'));
      return;
    }
    if (!e.target.files?.length) return
    await processUploadFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    // Disable dragging directly into the trash
    if (activeSection === "Trash") return
    if (!currentFolderCanEdit) {
      window.dispatchEvent(new Event('showPermissionWarning'));
      return;
    }

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

  // Apply Search Filtering
  const filteredItems = useMemo(() => currentItems.filter(item => 
    (item?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  ), [currentItems, searchQuery]);

  // Apply Sorting
  const sortedItems = useMemo(() => [...filteredItems].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "name") {
      comparison = (a?.name || "").localeCompare(b?.name || "", undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortBy === "date") {
      comparison = (a.updated_at ? new Date(a.updated_at).getTime() : 0) - (b.updated_at ? new Date(b.updated_at).getTime() : 0);
    } else if (sortBy === "size") {
      comparison = (a.size_bytes || 0) - (b.size_bytes || 0);
    }
    return sortDirection === "asc" ? comparison : -comparison;
  }), [filteredItems, sortBy, sortDirection]);

  const folders = useMemo(() => sortedItems.filter((item) => item.item_type === "FOLDER"), [sortedItems]);
  const files = useMemo(() => sortedItems.filter((item) => item.item_type === "FILE"), [sortedItems]);

  // --- Virtualization Setup ---
  const { columns: columnCount, width: containerWidth } = useGridDimensions(scrollContainerRef);
  const gap = 16;
  const totalGapWidth = (columnCount - 1) * gap;
  const itemWidth = containerWidth > 0 ? (containerWidth - totalGapWidth) / columnCount : 0;

  const gridItems = useMemo(() => [...folders, ...files], [folders, files]);
  const gridRows = useMemo(() => view === 'grid' ? chunk(gridItems, columnCount) : [], [gridItems, columnCount, view]);

  const rowVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 240 + gap,
    overscan: 5,
  });
  // --- End Virtualization Setup ---

  const handleDownload = useCallback((id: string) => {
    const baseUrl = api.getBaseUrl()
    const link = document.createElement("a")
    link.href = `${baseUrl}/download/${id}/?token=${getToken()}`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, []);

  const handleDoubleClick = useCallback((id: string) => {
    if (activeSection === "Trash") return;
    const item = itemsRef.current.find(i => i.id === id);
    if (!item) return;
    
    if (item.item_type === "FOLDER") {
      setCurrentParentId(item.id)
      setNavStack(prev => [...prev, { id: item.id, name: item.name, can_edit: item.can_edit ?? false }])
      setSelectedItems(new Set())
    } else {
      if (getPreviewType(item.name)) {
        window.dispatchEvent(new CustomEvent('openPreview', { detail: item }));
      } else {
        handleDownload(item.id);
      }
      setTimeout(() => loadItems(true), 500) // silently update recent tab sorting in background
    }
  }, [activeSection, handleDownload, itemsRef]);

  const handleDownloadFolder = useCallback((id: string) => {
    const baseUrl = api.getBaseUrl()
    const link = document.createElement("a")
    link.href = `${baseUrl}/download-folder/${id}/?token=${getToken()}`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, []);

  const handleShare = useCallback(async (id: string) => {
    try {
      const data = await api.getShareSettings(id);
      
      // Dynamically constructs using the active domain (IP or cloud.hanacasa.my)
      const shareUrl = `${window.location.origin}/share/${data.share_token}`;
      
      setShareModal({ 
        isOpen: true, 
        url: shareUrl,
        item_id: id,
        share_mode: data.share_mode || "RESTRICTED",
        permissions: data.permissions || []
      });
      setIsCopied(false);
    } catch (error) {
      console.error(error);
      setGenericAlert({ title: "Server Error", message: "Failed to access share settings. Make sure your database migrations are applied!" });
    }
  }, []);

  const saveShareSettings = async (mode: string, perms: {email: string, role: string}[]) => {
    // Optimistic UI Update: instantly apply mode/permission changes without waiting for server
    setShareModal(prev => prev ? { ...prev, share_mode: mode as any, permissions: perms } : null);
    setIsSavingShare(true);
    try {
      await api.saveShareSettings(shareModal!.item_id, mode, perms);
      setShareEmailInput("");
      setEmailSuggestions([]);
      setShowSuggestions(false);
    } catch (e: any) {
      setGenericAlert({ title: "Action Failed", message: e.message });
    } finally {
      setIsSavingShare(false);
    }
  }

  const handleEmailInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setShareEmailInput(val);
    if (val.length >= 2) {
      try {
        const suggestions = await api.searchUsers(val);
        setEmailSuggestions(Array.isArray(suggestions) ? suggestions : []);
        setShowSuggestions(true);
      } catch (err) {}
    } else {
      setEmailSuggestions([]);
      setShowSuggestions(false);
    }
  }

  const openFolderPicker = (action: "move" | "copy") => {
    setFolderPicker({ isOpen: true, action, currentFolderId: null, navStack: [] });
  }

  const handleActionConfirm = async () => {
    if (!folderPicker) return;
    
    const baseUrl = api.getBaseUrl();
    const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    const itemIds = Array.from(selectedItems).map(id => id.replace(/file-|folder-/, ''));
    
    try {
      const res = await fetch(`${baseUrl}/${folderPicker.action}/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_ids: itemIds,
          target_parent_id: folderPicker.currentFolderId
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${folderPicker.action}`);
      }
      
      setFolderPicker(null);
      setSelectedItems(new Set());
      await loadItems(true);
      window.dispatchEvent(new Event("storageUpdated"));
    } catch (err: any) {
      setGenericAlert({ title: "Action Failed", message: err.message });
    }
  }

  const navigateTo = (index: number) => {
    const newStack = navStack.slice(0, index + 1)
    setNavStack(newStack)
    setCurrentParentId(newStack[newStack.length - 1].id)
  }

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, []);
  
  const toggleStar = useCallback(async (id: string, is_starred: boolean) => {
    await api.toggleStar(id, is_starred);
    await loadItems(true);
    window.dispatchEvent(new Event("storageUpdated"));
  }, []);

  const executeConfirmAction = async () => {
    if (confirmAction) {
      await confirmAction.action();
      setConfirmAction(null);
    }
  };

  const requestDelete = useCallback((id: string, isPermanent: boolean) => {
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
  }, []);

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

  const handleRestore = useCallback(async (id: string) => {
    await api.moveToTrash(id, false);
    await loadItems(true);
    window.dispatchEvent(new Event("storageUpdated"));
  }, []);

  const selectedCanEdit = useMemo(() => {
    return Array.from(selectedItems).every(id => {
      const rawId = id.replace(/file-|folder-/, '');
      const item = currentItems.find(i => i.id === rawId);
      return item ? item.can_edit !== false : false;
    });
  }, [selectedItems, currentItems]);

  return (
    <main 
      className="flex-1 flex flex-col h-svh overflow-hidden bg-background animate-in fade-in duration-700 relative"
      onDragOver={(e) => { e.preventDefault(); if (activeSection !== "Trash" && currentFolderCanEdit) setIsDragging(true); }}
    >
      <input type="file" multiple className="hidden" id="file-upload" onChange={handleUpload} />
      <input type="file" multiple webkitdirectory="true" className="hidden" id="folder-upload" onChange={handleUpload} />

      {/* Header */}
      <header className="px-4 md:px-8 py-4 md:py-6 border-b border-border bg-card/50 relative z-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 relative z-50">
          <div className="flex items-center gap-3 w-full md:max-w-xl md:flex-1">
            <button 
              onClick={() => window.dispatchEvent(new Event('toggleMobileSidebar'))}
              className="md:hidden p-2 -ml-2 text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0 touch-manipulation"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto custom-scrollbar">
            {/* Notifications */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 text-sm shadow-sm backdrop-blur-md relative">
              <div className="relative">
                <button onClick={() => setShowRequests(!showRequests)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white relative">
                  <Bell className="w-4 h-4" />
                  {pendingRequests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
                {showRequests && (
                  <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowRequests(false)} />
                    <div className="absolute top-full right-0 mt-2 w-80 bg-black/80 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-xl overflow-hidden z-50 p-2">
                      <h4 className="text-xs uppercase tracking-widest text-white/50 font-semibold px-3 py-2 mb-1">Access Requests</h4>
                      {!Array.isArray(pendingRequests) || pendingRequests.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-white/40 text-center">No pending requests</div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 relative z-50">
                          {pendingRequests?.map(req => (
                            <div key={req.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                              <p className="text-sm text-white truncate mb-1"><strong>{req.user_email}</strong></p>
                              <p className="text-xs text-white/60 truncate mb-3">Requested access to: {req.file_name}</p>
                              <div className="flex gap-2">
                                <button onClick={async () => { await api.reviewAccessRequest(req.id, 'approve'); fetchRequests(); loadItems(true); }} className="flex-1 py-1.5 bg-white text-slate-900 text-xs font-bold rounded">Approve</button>
                                <button onClick={async () => { await api.reviewAccessRequest(req.id, 'reject'); fetchRequests(); }} className="flex-1 py-1.5 bg-white/10 text-white text-xs font-bold rounded hover:bg-red-500/20 hover:text-red-400">Reject</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <ViewToggle view={view} onViewChange={setView} />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-3 mt-4 relative z-40">
          <div className="relative">
            <button
              onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)}
              className="flex items-center gap-2 px-4 py-1.5 border border-border rounded-full hover:bg-secondary text-sm text-foreground font-medium transition-colors relative z-50"
            >
              <span>Type</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", isTypeFilterOpen && "rotate-180")} />
            </button>

            {isTypeFilterOpen && (
              <>
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsTypeFilterOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {[
                    { label: "Folders", icon: Folder },
                    { label: "Documents", icon: FileText },
                    { label: "Spreadsheets", icon: FileSpreadsheet },
                    { label: "Presentations", icon: Monitor },
                    { label: "Photos & images", icon: ImageIcon },
                    { label: "PDFs", icon: FileIcon },
                    { label: "Videos", icon: Film },
                    { label: "Archives (zip)", icon: Archive },
                  ].map((type, idx) => (
                    <button
                      key={idx}
                      onClick={() => setIsTypeFilterOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors text-left"
                    >
                      <type.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{type.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-foreground">
              {navStack.length === 0 ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                    className="flex items-center gap-1 hover:bg-white/10 rounded-lg px-2 py-1 -ml-2 transition-colors relative z-50"
                  >
                    <span>{activeSection}</span>
                    <ChevronDown className={cn("w-5 h-5 transition-transform", isFolderMenuOpen && "rotate-180")} />
                  </button>
                  {isFolderMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsFolderMenuOpen(false)} />
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white shadow-lg rounded-xl py-2 z-50 text-slate-800 border border-slate-200 font-normal text-base">
                        <button onClick={() => { setIsFolderMenuOpen(false); window.dispatchEvent(new Event("createFolder")); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">New folder</button>
                        <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Download</button>
                        <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Rename</button>
                        <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Share</button>
                        <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Folder information</button>
                        <div className="h-px bg-slate-200 my-2" />
                        <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 transition-colors">Move to trash</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => { setCurrentParentId(null); setNavStack([]); setSelectedItems(new Set()); }}
                  className="hover:underline"
                >
                  {activeSection}
                </button>
              )}
              {navStack.map((nav, index) => (
                <div key={nav.id} className="flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  {index === navStack.length - 1 ? (
                    <div className="relative">
                      <button 
                        onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                        className="flex items-center gap-1 hover:bg-white/10 rounded-lg px-2 py-1 -ml-2 transition-colors relative z-50"
                      >
                        <span className="truncate max-w-[150px]">{nav.name}</span>
                        <ChevronDown className={cn("w-5 h-5 transition-transform", isFolderMenuOpen && "rotate-180")} />
                      </button>
                      {isFolderMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsFolderMenuOpen(false)} />
                          <div className="absolute top-full left-0 mt-1 w-56 bg-white shadow-lg rounded-xl py-2 z-50 text-slate-800 border border-slate-200 font-normal text-base">
                            <button onClick={() => { setIsFolderMenuOpen(false); window.dispatchEvent(new Event("createFolder")); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">New folder</button>
                            <button onClick={() => { setIsFolderMenuOpen(false); handleDownloadFolder(nav.id); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Download</button>
                            <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Rename</button>
                            <button onClick={() => { setIsFolderMenuOpen(false); handleShare(nav.id); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Share</button>
                            <button onClick={() => setIsFolderMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors">Folder information</button>
                            <div className="h-px bg-slate-200 my-2" />
                            <button onClick={() => { setIsFolderMenuOpen(false); requestDelete(nav.id, false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 transition-colors">Move to trash</button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => navigateTo(index)}
                      className="hover:underline truncate max-w-[150px]"
                    >
                      {nav.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSection === "Trash" ? "Items in trash will be permanently deleted when cleared." : activeSection === "Recent" ? "Your 20 most recently viewed files." : activeSection === "Shared with me" ? "Files and folders shared securely with you." : activeSection === "Starred" ? "Your favorite files and folders." : `Welcome back, ${user?.first_name || user?.username}! Here are your files.`}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground overflow-x-auto pb-1 sm:pb-0 whitespace-nowrap">
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

      {/* Selection Action Bar (Moved outside to prevent offset issues with virtualizer) */}
      {selectedItems.size > 0 && (
        <div className="mx-4 md:mx-8 mt-4 bg-white/10 backdrop-blur-2xl border border-white/20 text-white px-4 md:px-8 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-top-2 relative z-40 shrink-0">
            <span className="font-light tracking-wider text-base md:text-lg shrink-0">{selectedItems.size} document(s) selected</span>
            {activeSection === "Trash" ? (
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold tracking-widest uppercase">
                <button onClick={async () => {
                  for (const idStr of selectedItems) await api.moveToTrash(idStr.replace(/file-|folder-/, ''), false);
                  setSelectedItems(new Set()); loadItems(true); window.dispatchEvent(new Event("storageUpdated"));
                }} className="hover:text-white/70 transition-colors">Restore</button>
                <button onClick={async () => {
                  setConfirmAction({
                    isOpen: true, title: "Delete Forever?", confirmText: "Delete Forever",
                    message: `Are you sure you want to permanently delete ${selectedItems.size} item(s)?`,
                    action: async () => {
                      for (const idStr of selectedItems) await api.permanentDelete(idStr.replace(/file-|folder-/, ''));
                      setSelectedItems(new Set()); await loadItems(true); window.dispatchEvent(new Event("storageUpdated"));
                    }
                  });
                }} className="text-red-400 hover:text-red-300 transition-colors">Delete Permanently</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold tracking-widest uppercase">
                {selectedCanEdit && <button onClick={() => openFolderPicker("move")} className="hover:text-white/70 transition-colors">Move</button>}
                <button onClick={() => openFolderPicker("copy")} className="hover:text-white/70 transition-colors">Copy</button>
                {selectedCanEdit && <button onClick={handleDeleteSelected} className="text-red-400 hover:text-red-300 transition-colors">Move to Trash</button>}
              </div>
            )}
          </div>
        )}

        {/* Content Area / Virtualized Container */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative z-0 px-4 md:px-8 py-4 md:py-6"
          onMouseDown={handleMouseDown}
          onScroll={(e) => { scrollCache[getCacheKey()] = e.currentTarget.scrollTop; }}
        >
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
            <p className="text-sm mt-2">{activeSection === "Recent" ? "Open some files to see them here." : activeSection === "Starred" ? "Star files and folders to see them here." : activeSection === "Shared with me" ? "Nothing has been shared with you yet." : "Upload files or create folders to get started."}</p>
          </div>
        ) : (
          view === 'grid' ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowItems = gridRows[virtualRow.index];
                if (!rowItems) return null;
                
                return rowItems.map((item, localIndex) => {
                  const index = virtualRow.index * columnCount + localIndex;
                  
                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                          top: `${virtualRow.start}px`,
                          left: `${(index % columnCount) * (itemWidth + gap)}px`,
                          width: `${itemWidth}px`,
                        height: '240px',
                      }}
                    >
                      {item.item_type === 'FOLDER' ? (
                        <FolderCard
                          id={item.id}
                          name={item.name}
                          itemCount={item.item_count || 0}
                          selected={selectedItems.has(`folder-${item.id}`)}
                          isTrash={activeSection === "Trash"}
                          isStarred={item.is_starred}
                          canEdit={item.can_edit !== false}
                          onSelect={toggleSelection}
                          onDoubleClick={handleDoubleClick}
                          onToggleStar={toggleStar}
                          onShare={handleShare}
                          onDelete={requestDelete}
                          onRestore={handleRestore}
                          onPermanentDelete={requestDelete}
                        />
                      ) : (
                        <FileCard
                          id={item.id}
                          name={item.name}
                          type={getFileType(item.name)}
                          size={formatBytes(item.size_bytes)}
                          selected={selectedItems.has(`file-${item.id}`)}
                          isTrash={activeSection === "Trash"}
                          isStarred={item.is_starred}
                          canEdit={item.can_edit !== false}
                          previewUrl={getPreviewType(item.name) === 'image' ? `${api.getBaseUrl()}/thumbnail/${item.id}/?token=${getToken()}` : undefined}
                          previewType={getPreviewType(item.name) === 'image' ? 'image' : undefined}
                          onSelect={toggleSelection}
                          onDoubleClick={handleDoubleClick}
                          onToggleStar={toggleStar}
                          onShare={handleShare}
                          onDelete={requestDelete}
                          onRestore={handleRestore}
                          onPermanentDelete={requestDelete}
                          onDownload={handleDownload}
                        />
                      )}
                    </div>
                  );
                });
              })}
            </div>
          ) : (
            <>
              {/* List View - Folders */}
              {folders.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-sm font-medium text-muted-foreground mb-4">Folders</h2>
                  <div className="space-y-1">
                    {folders.map((folder) => (
                      <FileRow key={folder.id} id={folder.id} isFolder={true} name={folder.name} type="default" size={folder.item_count === 1 ? "1 item" : `${folder.item_count || 0} items`} modified={folder.updated_at ? new Date(folder.updated_at).toLocaleDateString() : "—"} selected={selectedItems.has(`folder-${folder.id}`)} onSelect={toggleSelection} onDoubleClick={handleDoubleClick} isStarred={folder.is_starred} onToggleStar={toggleStar} isTrash={activeSection === "Trash"} onDelete={requestDelete} onRestore={handleRestore} onPermanentDelete={requestDelete} onShare={handleShare} canEdit={folder.can_edit !== false} onDownload={handleDownloadFolder} />
                    ))}
                  </div>
                </section>
              )}
              {/* List View - Files */}
              {files.length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-muted-foreground mb-4">Files</h2>
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_80px_40px] sm:grid-cols-[auto_1fr_100px_140px_40px] gap-4 items-center px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border bg-secondary/50">
                      <div className="w-5" />
                      <div>Name</div>
                      <div className="text-right">Size</div>
                      <div className="hidden sm:block text-right">Modified</div>
                      <div />
                    </div>
                    <div className="divide-y divide-border/50">
                      {files.map((file) => (
                        <FileRow key={file.id} id={file.id} name={file.name} type={getFileType(file.name)} size={formatBytes(file.size_bytes)} modified={file.updated_at ? new Date(file.updated_at).toLocaleDateString() : "—"} selected={selectedItems.has(`file-${file.id}`)} onSelect={toggleSelection} onDoubleClick={handleDoubleClick} isStarred={file.is_starred} onToggleStar={toggleStar} isTrash={activeSection === "Trash"} onDownload={handleDownload} onShare={handleShare} onDelete={requestDelete} onRestore={handleRestore} onPermanentDelete={requestDelete} canEdit={file.can_edit !== false} previewUrl={ getPreviewType(file.name) === 'image' ? `${api.getBaseUrl()}/thumbnail/${file.id}/?token=${getToken()}` : undefined } previewType={getPreviewType(file.name) === 'image' ? 'image' : undefined} />
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center animate-in fade-in">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 animate-in zoom-in-95 text-white">
            <h3 className="text-2xl font-light tracking-wide mb-6">Create New Folder</h3>
            <input 
              type="text" 
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all mb-8 text-white placeholder:text-white/40"
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
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setIsCreateFolderOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold tracking-widest uppercase text-white/60 hover:text-white transition-colors"
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
                className="px-6 py-2.5 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Confirmation Modal */}
      {confirmAction && confirmAction.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center animate-in fade-in">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 animate-in zoom-in-95 text-white">
            <h3 className="text-2xl font-light tracking-wide mb-4">{confirmAction.title}</h3>
            <p className="text-sm text-white/70 mb-8 leading-relaxed">
              {confirmAction.message}
            </p>
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2.5 text-sm font-semibold tracking-widest uppercase text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeConfirmAction}
                className="px-6 py-2.5 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate File Modal */}
      {duplicateConfirm && duplicateConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center animate-in fade-in duration-500">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 animate-in zoom-in-95 text-white">
            <h3 className="text-2xl font-light tracking-wide mb-4">File Already Exists</h3>
            <p className="text-sm text-white/70 mb-8 leading-relaxed">
              "{duplicateConfirm.filename}" already exists in this folder. Would you like to save it as a duplicate or skip this file?
            </p>
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => duplicateConfirm.resolve(false)}
                className="px-5 py-2.5 text-sm font-semibold tracking-widest uppercase text-white/60 hover:text-white transition-colors"
              >
                Skip
              </button>
              <button 
                onClick={() => duplicateConfirm.resolve(true)}
                className="px-6 py-2.5 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                Save as Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Tab */}
      {uploads.length > 0 && (
        <div className="fixed bottom-6 right-6 w-80 bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-5 max-h-96 flex flex-col text-white">
          <div className="bg-black/40 px-5 py-4 border-b border-white/10 flex justify-between items-center text-xs font-semibold tracking-widest uppercase">
            Uploading {uploads.length} item(s)
          </div>
          <div className="overflow-y-auto max-h-80 custom-scrollbar bg-black/20">
            {uploads.map((upload) => (
              <div key={upload.id} className="p-4 border-b border-white/10 last:border-0">
                <div className="flex items-center gap-3 w-full">
                  {upload.complete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  ) : upload.error ? (
                    <div className="w-5 h-5 bg-red-500 rounded-full shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-light tracking-wide truncate">
                      {upload.filename}
                    </p>
                    {!upload.complete && !upload.error && (
                      <p className="text-xs text-white/50 mt-1 font-mono">
                        {upload.progress}%
                      </p>
                    )}
                    {upload.error && (
                      <p className="text-xs text-red-400 mt-1">Upload failed</p>
                    )}
                  </div>
                </div>
                {!upload.complete && !upload.error && (
                  <div className="h-1 w-full bg-white/10 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-300" style={{ width: `${upload.progress}%` }} />
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

        {/* Share Link Modal */}
        {shareModal && shareModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center animate-in fade-in">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 animate-in zoom-in-95 text-white">
              <h3 className="text-2xl font-light tracking-wide mb-6">Share "{currentItems.find(i => i.id === shareModal.item_id)?.name || "Item"}"</h3>
              
              {shareModal.share_mode === 'RESTRICTED' && (
                <>
              {/* Add People */}
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-2 font-semibold">Share with people</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      value={shareEmailInput}
                      onChange={handleEmailInputChange}
                      onFocus={() => { if(emailSuggestions.length > 0) setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="Enter user email..."
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder:text-white/40"
                    />
                    {showSuggestions && Array.isArray(emailSuggestions) && emailSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-xl overflow-hidden z-50">
                        {emailSuggestions?.map(s => (
                          <div 
                            key={s.email}
                            className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShareEmailInput(s.email);
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="text-white font-medium">{s.name}</div>
                            <div className="text-white/60 text-xs">{s.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setAddRoleDropdownOpen(!addRoleDropdownOpen)}
                      className="bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none flex items-center justify-between gap-2 min-w-[100px] hover:bg-white/10 transition-colors"
                    >
                      <span>{shareRoleInput === "VIEWER" ? "Viewer" : "Editor"}</span>
                      <ChevronDown className="w-4 h-4 text-white/50" />
                    </button>
                    {addRoleDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-xl overflow-hidden z-50 min-w-[120px]">
                        <button onClick={() => { setShareRoleInput("VIEWER"); setAddRoleDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">Viewer</button>
                        <button onClick={() => { setShareRoleInput("EDITOR"); setAddRoleDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">Editor</button>
                      </div>
                    )}
                  </div>
                  <button
                    disabled={!shareEmailInput || isSavingShare}
                    onClick={() => {
                      if (!shareEmailInput) return;
                      const newPerms = [...shareModal.permissions.filter(p => p.email !== shareEmailInput), {email: shareEmailInput, role: shareRoleInput}];
                      saveShareSettings(shareModal.share_mode, newPerms);
                    }}
                    className="px-4 py-2.5 bg-white text-slate-900 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors hover:bg-white/90"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* People with Access */}
              <div className="mb-8">
                 <label className="block text-xs uppercase tracking-widest text-white/60 mb-3 font-semibold">People with access</label>
                 <div className="space-y-3 max-h-32 overflow-y-auto custom-scrollbar">
                   <div className="flex items-center justify-between text-sm bg-white/5 p-3 rounded-xl border border-white/10">
                     <span className="truncate flex-1 font-medium">{user?.email || "You"} (Owner)</span>
                     <span className="text-white/60 text-xs uppercase tracking-widest ml-4">Owner</span>
                   </div>
                   {shareModal.permissions?.map((p, idx) => (
                     <div key={idx} className="flex items-center justify-between text-sm bg-white/5 p-3 rounded-xl border border-white/10 group">
                       <span className="truncate flex-1">{p.email}</span>
                       <div className="flex items-center gap-3">
                         <div className="relative">
                           <button
                             onClick={() => setOpenRoleMenuId(openRoleMenuId === p.email ? null : p.email)}
                             className="bg-transparent text-white/60 text-xs uppercase tracking-widest outline-none hover:text-white transition-colors flex items-center gap-1"
                           >
                             {p.role} <ChevronDown className="w-3 h-3" />
                           </button>
                           {openRoleMenuId === p.email && (
                             <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-xl overflow-hidden z-50 min-w-[100px]">
                               <button onClick={() => {
                                 saveShareSettings(shareModal.share_mode, shareModal.permissions.map(perm => perm.email === p.email ? { ...perm, role: "VIEWER" } : perm));
                                 setOpenRoleMenuId(null);
                               }} className="w-full text-left px-4 py-2.5 text-xs text-white uppercase tracking-widest hover:bg-white/10 transition-colors">VIEWER</button>
                               <button onClick={() => {
                                 saveShareSettings(shareModal.share_mode, shareModal.permissions.map(perm => perm.email === p.email ? { ...perm, role: "EDITOR" } : perm));
                                 setOpenRoleMenuId(null);
                               }} className="w-full text-left px-4 py-2.5 text-xs text-white uppercase tracking-widest hover:bg-white/10 transition-colors">EDITOR</button>
                             </div>
                           )}
                         </div>
                         <button 
                           onClick={() => {
                             const newPerms = shareModal.permissions.filter(perm => perm.email !== p.email);
                             saveShareSettings(shareModal.share_mode, newPerms);
                           }}
                           className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
                </>
              )}

              {/* General Access */}
              <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-xl">
                 <label className="block text-xs uppercase tracking-widest text-white/60 mb-2 font-semibold">General Access</label>
                 <div className="relative">
                   <button
                     onClick={() => setGeneralAccessDropdownOpen(!generalAccessDropdownOpen)}
                     className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white flex justify-between items-center hover:bg-white/10 transition-colors text-left"
                   >
                     <span>{shareModal.share_mode === "RESTRICTED" ? "Restricted - Only people added can access" : "Public - Anyone with the link can access"}</span>
                     <ChevronDown className={cn("w-4 h-4 text-white/50 transition-transform", generalAccessDropdownOpen && "rotate-180")} />
                   </button>
                   {generalAccessDropdownOpen && (
                     <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-xl overflow-hidden z-50">
                       <button onClick={() => { saveShareSettings("RESTRICTED", shareModal.permissions); setGeneralAccessDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">Restricted - Only people added can access</button>
                       <button onClick={() => { saveShareSettings("PUBLIC", shareModal.permissions); setGeneralAccessDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">Public - Anyone with the link can access</button>
                     </div>
                   )}
                 </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <button
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(shareModal.url);
                      } else {
                        const input = document.createElement('input');
                        input.value = shareModal.url;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        document.body.removeChild(input);
                      }
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    } catch (err) {
                      alert("Failed to copy. Please select the link and copy manually.");
                    }
                  }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold tracking-widest uppercase transition-all border border-white/10"
                >
                  {isCopied ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={() => setShareModal(null)}
                  className="px-8 py-2.5 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Folder Picker Modal (Move/Copy) */}
      {folderPicker && folderPicker.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center animate-in fade-in">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md flex flex-col animate-in zoom-in-95 h-[500px] overflow-hidden text-white">
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-xl font-light tracking-wide capitalize">{folderPicker.action} {selectedItems.size} item(s)</h3>
              <div className="flex items-center gap-2 text-sm text-white/60 mt-3 overflow-x-auto whitespace-nowrap custom-scrollbar pb-1">
                <button 
                  onClick={() => setFolderPicker(prev => prev ? {...prev, currentFolderId: null, navStack: []} : null)}
                  className="hover:text-white hover:underline transition-colors shrink-0"
                >
                  My Drive
                </button>
                {folderPicker.navStack.map((nav, idx) => (
                  <div key={nav.id} className="flex items-center gap-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-white/40" />
                    <button 
                      onClick={() => setFolderPicker(prev => prev ? {...prev, currentFolderId: nav.id, navStack: prev.navStack.slice(0, idx + 1)} : null)}
                      className="hover:text-white hover:underline transition-colors max-w-[120px] truncate"
                    >
                      {nav.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
              {isPickerLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : pickerFolders.length === 0 ? (
                <div className="text-center text-white/40 py-8 text-sm italic">
                  {pickerHasFiles ? "No subfolders inside" : "This folder is empty"}
                </div>
              ) : (
                <div className="space-y-1">
                  {pickerFolders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => setFolderPicker(prev => prev ? {
                        ...prev,
                        currentFolderId: folder.id,
                        navStack: [...prev.navStack, { id: folder.id, name: folder.name }]
                      } : null)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/10">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" /></svg>
                      </div>
                      <span className="font-light tracking-wide text-white truncate flex-1">{folder.name}</span>
                      <ChevronRight className="w-5 h-5 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-white/10 flex justify-end gap-4 bg-white/5">
              <button 
                onClick={() => setFolderPicker(null)}
                className="px-5 py-2.5 text-sm font-semibold tracking-widest uppercase text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleActionConfirm}
                className="px-6 py-2.5 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                {folderPicker.action} Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Warning Modal */}
      {permissionWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center animate-in fade-in duration-500">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-500 text-white text-center">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-light tracking-wide mb-3">Access Denied</h3>
            <p className="text-sm text-white/60 mb-8 leading-relaxed">
              You don't have the permission to edit or upload files to this folder.
            </p>
            <button 
              onClick={() => setPermissionWarning(false)}
              className="w-full px-6 py-3 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Generic Error / Info Modal */}
      {genericAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[140] flex items-center justify-center animate-in fade-in duration-500">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-500 text-white text-center">
            <div className="w-16 h-16 bg-white/10 text-white border border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-light tracking-wide mb-3">{genericAlert.title}</h3>
            <p className="text-sm text-white/60 mb-8 leading-relaxed">
              {genericAlert.message}
            </p>
            <button 
              onClick={() => setGenericAlert(null)}
              className="w-full px-6 py-3 bg-white text-slate-900 hover:bg-white/90 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <FilePreviewModal />
    </main>
  )
}

const FilePreviewModal = React.memo(() => {
  const [previewItem, setPreviewItem] = useState<CloudItem | null>(null);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleOpen = (e: any) => {
      setPreviewItem(e.detail);
      setIsHighResLoaded(false);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    };
    window.addEventListener('openPreview', handleOpen);
    return () => window.removeEventListener('openPreview', handleOpen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null);
    };
    if (previewItem) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem]);

  if (!previewItem) return null;

  const getToken = () => typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token") || "") : "";
  
  const handleDownload = (id: string) => {
    const baseUrl = api.getBaseUrl();
    const link = document.createElement("a");
    link.href = `${baseUrl}/download/${id}/?token=${getToken()}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewType = getPreviewType(previewItem.name);

  // Zoom / Pan handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (previewType !== 'image') return;
    const scaleAdjust = e.deltaY * -0.005;
    let newScale = Math.min(Math.max(1, scale + scaleAdjust), 5); // Limit zoom from 1x to 5x
    
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
      <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
        <button onClick={() => { handleDownload(previewItem.id); setPreviewItem(null); }} className="px-4 py-2 bg-white text-slate-900 rounded-full text-sm font-bold tracking-widest uppercase hover:bg-white/90 transition-colors flex items-center gap-2 shadow-lg">
          <Download className="w-4 h-4" /> Download
        </button>
        <button onClick={() => setPreviewItem(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors shadow-lg">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div 
        className={cn(
          "w-full h-full p-8 flex flex-col items-center justify-center relative overflow-hidden",
          previewType === 'image' && scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {previewType === 'image' && (
          <div 
            className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center"
            style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
          >
            {/* Blurry Low-Res Thumbnail */}
            <img src={`${api.getBaseUrl()}/thumbnail/${previewItem.id}/?token=${getToken()}&w=400&h=400`} alt={previewItem.name} className={cn("absolute max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-opacity duration-700", isHighResLoaded ? "opacity-0" : "opacity-100 blur-xl")} />
            {/* High-Res Image */}
            <img src={`${api.getBaseUrl()}/download/${previewItem.id}/?token=${getToken()}`} alt={previewItem.name} onLoad={() => setIsHighResLoaded(true)} draggable={false} className={cn("absolute max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-opacity duration-700", isHighResLoaded ? "opacity-100" : "opacity-0")} />
          </div>
        )}
        {previewType === 'video' && <div className="w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center"><video controls autoPlay src={`${api.getBaseUrl()}/download/${previewItem.id}/?token=${getToken()}`} className="max-w-full max-h-full rounded-lg shadow-2xl bg-black" /></div>}
        {previewType === 'audio' && (
          <div className="w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center">
            <div className="bg-black/40 backdrop-blur-md p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-8 w-full max-w-md border border-white/10">
              <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center animate-pulse"><div className="w-16 h-16 bg-white rounded-full" /></div>
              <h3 className="text-xl font-medium text-white text-center truncate w-full px-4">{previewItem.name}</h3>
              <audio controls autoPlay src={`${api.getBaseUrl()}/download/${previewItem.id}/?token=${getToken()}`} className="w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
