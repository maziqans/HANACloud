"use client"

import { useState, useEffect } from "react"
import * as api from "@/lib/api"
import { User, HardDrive, ShieldAlert, Upload } from "lucide-react"

export function SettingsContent() {
  const [storageInfo, setStorageInfo] = useState({ used_bytes: 0, total_bytes: 1 })
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const data = await api.getStorageInfo()
        setStorageInfo(data)
      } catch (error) {
        console.error("Failed to load storage info", error)
      }
    }
    fetchStorage()
  }, [])

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

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

  const storagePercentage = Math.min(100, (storageInfo.used_bytes / storageInfo.total_bytes) * 100)

  return (
    <main className="flex-1 flex flex-col min-h-screen overflow-auto bg-background">
      <header className="px-8 py-6 border-b border-border bg-card/50">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Account Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile, storage, and security preferences.</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full p-8 space-y-8">
        
        {/* Profile Settings */}
        <section className="bg-card rounded-2xl border border-border p-6 cozy-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg"><User className="w-5 h-5 text-primary" /></div>
            <h2 className="text-lg font-semibold">Profile Settings</h2>
          </div>
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Avatar</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-border overflow-hidden">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
                <label className="cursor-pointer px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-medium transition-colors border border-border flex items-center gap-2">
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
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="cozy-button text-primary-foreground px-6 py-2.5 rounded-xl font-medium text-sm">Save Changes</button>
          </form>
        </section>

        {/* Storage Management */}
        <section className="bg-card rounded-2xl border border-border p-6 cozy-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg"><HardDrive className="w-5 h-5 text-primary" /></div>
            <h2 className="text-lg font-semibold">Storage Management</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Used</span>
              <span className="font-medium">{formatBytes(storageInfo.used_bytes)} / {formatBytes(storageInfo.total_bytes)}</span>
            </div>
            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
              <div className="h-full progress-golden transition-all duration-500" style={{ width: `${storagePercentage}%` }} />
            </div>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-3">Running out of space? Request a quota increase from the system administrator.</p>
              <button onClick={handleStorageRequest} className="px-5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-sm font-medium transition-colors">
                Request Additional Storage
              </button>
            </div>
          </div>
        </section>

        {/* Security Settings */}
        <section className="bg-card rounded-2xl border border-destructive/20 p-6 cozy-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-destructive/10 rounded-lg"><ShieldAlert className="w-5 h-5 text-destructive" /></div>
            <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Once you delete your account, there is no going back. All of your files, folders, and shared links will be permanently destroyed.</p>
          <button onClick={handleDeleteAccount} className="px-6 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl text-sm font-medium transition-colors shadow-sm">
            Delete Account
          </button>
        </section>

      </div>
    </main>
  )
}