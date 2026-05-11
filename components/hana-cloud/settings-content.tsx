"use client"

import { useState, useEffect } from "react"
import * as api from "@/lib/api"
import { User, HardDrive, ShieldAlert, Upload } from "lucide-react"
import { StorageBreakdown } from "./storage-breakdown"

export function SettingsContent({ activeSection = "Profile Settings" }: { activeSection?: string }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) return alert("Passwords do not match!")
    try {
      const formData = new FormData()
      if (password) formData.append("password", password)
      await api.updateProfile(formData)
      alert("Profile updated successfully")
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error(error)
    }
  }

  const handleStorageRequest = async () => {
    const reason = window.prompt("Why do you need more storage?")
    if (reason) {
      await api.requestStorage(reason)
      alert("Storage request submitted to admin.")
    }
  }

  const handleDeleteAccount = async () => {
    const confirm = window.prompt('Type "DELETE" to permanently delete your account.')
    if (confirm === "DELETE") {
      await api.deleteAccount()
      alert("Account deleted.")
      window.location.href = "/" // Redirect to login
    }
  }

  const showProfile = activeSection === "Profile Settings" || activeSection === "Settings"
  const showStorage = activeSection === "Storage Management"
  const showSecurity = activeSection === "Security Settings"

  return (
    <main className="flex-1 flex flex-col min-h-screen overflow-auto bg-background animate-in fade-in duration-700">
      <div className="max-w-4xl w-full mx-auto px-8 py-10 space-y-12">
        
        {/* Page Header (Sleek & Modern) */}
        <div className="mb-10">
          <h1 className="text-4xl font-light tracking-tight text-foreground">Account Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your profile, storage, and security preferences.</p>
        </div>
        
        {/* Profile Settings */}
        {showProfile && (
        <section className="py-2">
          <div className="flex items-center gap-3 mb-8 border-b border-border/40 pb-4">
            <h2 className="text-2xl font-light tracking-tight">Profile Settings</h2>
          </div>
          <form onSubmit={handleProfileUpdate} className="space-y-8 max-w-2xl">
            <div>
              <label className="block text-sm font-medium mb-4 text-muted-foreground">Avatar</label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center border border-border/50 overflow-hidden shadow-sm">
                  <User className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <label className="cursor-pointer px-5 py-2.5 bg-background hover:bg-secondary/50 rounded-full text-sm font-medium transition-colors border border-border shadow-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload New
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    if(e.target.files?.[0]) {
                       const form = new FormData(); form.append("avatar", e.target.files[0]); api.updateProfile(form); alert("Avatar uploaded!");
                    }
                  }} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="cozy-button text-primary-foreground px-8 py-3 rounded-full font-medium text-sm">Save Changes</button>
          </form>
        </section>
        )}

        {/* Storage Management */}
        {showStorage && (
        <section className="py-2">
          <div className="flex items-center gap-3 mb-8 border-b border-border/40 pb-4">
            <h2 className="text-2xl font-light tracking-tight">Storage Management</h2>
          </div>
          <div className="space-y-8 max-w-3xl">
            <StorageBreakdown />
            <div className="pt-8 border-t border-border/40">
              <p className="text-sm text-muted-foreground mb-4">Running out of space? Request a quota increase from the system administrator.</p>
              <button onClick={handleStorageRequest} className="px-6 py-2.5 bg-background hover:bg-secondary/50 text-foreground border border-border shadow-sm rounded-full text-sm font-medium transition-colors">
                Request Additional Storage
              </button>
            </div>
          </div>
        </section>
        )}

        {/* Security Settings */}
        {showSecurity && (
        <section className="py-2">
          <div className="flex items-center gap-3 mb-8 border-b border-border/40 pb-4">
            <h2 className="text-2xl font-light tracking-tight text-destructive">Security Settings</h2>
          </div>
          <div className="max-w-2xl">
            <p className="text-sm text-muted-foreground mb-6">Once you delete your account, there is no going back. All of your files, folders, and shared links will be permanently destroyed.</p>
            <button onClick={handleDeleteAccount} className="px-8 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full text-sm font-medium transition-colors shadow-sm">
              Delete Account
            </button>
          </div>
        </section>
        )}

      </div>
    </main>
  )
}