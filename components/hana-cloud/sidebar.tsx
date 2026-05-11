"use client"

import { useState, useRef, useEffect } from "react"
import {
  HardDrive,
  Users,
  Clock,
  Star,
  Trash2,
  Plus,
  FolderPlus,
  Upload,
  FolderInput,
  Cloud,
  ChevronDown,
  Settings,
  LogOut,
  User,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { StorageBar } from "./storage-bar"

interface NavItem {
  icon: React.ElementType
  label: string
}

const navItems: NavItem[] = [
  { icon: HardDrive, label: "My Drive" },
  { icon: Users, label: "Shared with me" },
  { icon: Clock, label: "Recent" },
  { icon: Star, label: "Starred" },
  { icon: Trash2, label: "Trash" },
]

const settingsItems: NavItem[] = [
  { icon: User, label: "Profile Settings" },
  { icon: HardDrive, label: "Storage Management" },
  { icon: ShieldAlert, label: "Security Settings" },
]

interface SidebarProps {
  onNavigate?: (item: string) => void
  activeItem?: string
  user?: any
  onLogout?: () => void
}

export function Sidebar({ onNavigate, activeItem = "My Drive", user, onLogout }: SidebarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const isSettingsMode = ["Profile Settings", "Storage Management", "Security Settings", "Settings"].includes(activeItem)
  const currentNavItems = isSettingsMode ? settingsItems : navItems

  return (
    <aside className="w-64 h-screen flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo Section */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          {/* Simple Cloud Icon - golden accent */}
          <Cloud 
            className="w-8 h-8 text-sidebar-primary" 
            strokeWidth={1.5}
          />
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground tracking-tight">
              HANACloud
            </h1>
            <p className="text-xs text-sidebar-muted">
              Your private storage
            </p>
          </div>
        </div>
      </div>

      {/* Add New Button - Golden */}
      <div className="px-4 pb-4 relative">
        {isSettingsMode ? (
          <button
            onClick={() => onNavigate?.("My Drive")}
            className="w-full bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground rounded-xl px-4 py-3 flex items-center gap-2.5 transition-cozy"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-medium">Back to My Drive</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full golden-button rounded-xl px-4 py-3 flex items-center gap-2.5 text-sidebar-primary-foreground transition-cozy"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span className="text-sm font-semibold">Add new</span>
              <ChevronDown className={cn(
                "w-4 h-4 ml-auto opacity-80 transition-transform duration-200",
                dropdownOpen && "rotate-180"
              )} strokeWidth={2} />
            </button>

            {/* Dropdown Menu - Dark theme */}
            {dropdownOpen && (
              <div className="absolute left-4 right-4 top-full mt-2 z-50 dropdown-dark rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <button className="w-full px-4 py-3 flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                    <FolderPlus className="w-4 h-4 text-sidebar-primary" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium">New Folder</span>
                </button>
                <button className="w-full px-4 py-3 flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-sidebar-primary" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium">File Upload</span>
                </button>
                <button className="w-full px-4 py-3 flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                    <FolderInput className="w-4 h-4 text-sidebar-primary" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium">Import Folder</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {currentNavItems.map((item) => {
          const Icon = item.icon
          const isActive = item.label === activeItem
          return (
            <button
              key={item.label}
              onClick={() => {
                onNavigate?.(item.label)
                setDropdownOpen(false)
              }}
              className={cn(
                "w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 text-left mb-1 relative",
                isActive 
                  ? "nav-dark-active text-sidebar-primary font-medium" 
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* User Profile & Storage */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        {/* User Profile - Clickable */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center gap-3 mb-4 p-2 -mx-2 rounded-xl profile-button cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-sidebar-primary/40 to-sidebar-primary/20 flex items-center justify-center ring-2 ring-sidebar-primary/40">
            <span className="text-sm font-semibold text-sidebar-primary uppercase">{user?.first_name?.[0] || user?.username?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
              {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || 'User'}
              </p>
              <p className="text-xs text-sidebar-muted truncate">
                {user?.email || 'No email provided'}
              </p>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-sidebar-muted transition-transform duration-200",
              profileOpen && "rotate-180"
            )} />
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute left-0 right-0 bottom-full mb-2 z-50 dropdown-dark rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button 
                onClick={() => {
                  onNavigate?.("Profile Settings");
                  setProfileOpen(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left"
              >
                <Settings className="w-4 h-4 text-sidebar-muted" strokeWidth={1.5} />
                <span className="text-sm">Account Settings</span>
              </button>
              <div className="h-px bg-sidebar-border mx-3" />
              <button 
                onClick={onLogout}
                className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-sidebar-accent transition-colors text-left"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-sm">Log out</span>
              </button>
            </div>
          )}
        </div>

        {/* Storage Progress */}
        <StorageBar />
      </div>
    </aside>
  )
}
