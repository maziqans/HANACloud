"use client"

import { useState, useEffect } from "react"
import * as api from "@/lib/api"
import { User, HardDrive, ShieldAlert, Upload, CheckCircle2, Edit2, AlertCircle } from "lucide-react"
import { StorageBreakdown } from "./storage-breakdown"

export function SettingsContent({ user, onUpdate, activeSection = "Profile Settings" }: { user?: any, onUpdate?: () => void, activeSection?: string }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState(user?.first_name || "")
  const [lastName, setLastName] = useState(user?.last_name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [isEditing, setIsEditing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean; title: string; message: string; action: () => Promise<void>; confirmText: string; isDestructive?: boolean;
  } | null>(null);
  
  const [deletePromptOpen, setDeletePromptOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setFirstName(user?.first_name || "")
    setLastName(user?.last_name || "")
    setEmail(user?.email || "")
  }, [user])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password && password !== confirmPassword) {
      setErrorMessage("Passwords do not match!");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    try {
      const formData = new FormData()
      if (password) formData.append("password", password)
      formData.append("first_name", firstName)
      formData.append("last_name", lastName)
      formData.append("email", email)
      
      await api.updateProfile(formData)
      setSuccessMessage("Profile updated successfully")
      setIsEditing(false)
      setPassword("")
      setConfirmPassword("")
      onUpdate?.() // Tell the main app to fetch the new name/email
      
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (error) {
      console.error(error)
    }
  }

  const handleStorageRequest = async () => {
    const phoneNumber = "60123408219";
    const message = "I would like to request additional storage for my HANACloud account.";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }

  const confirmDeleteAccount = async () => {
    if (deleteInput === "DELETE") {
      setIsDeleting(true);
      try {
        await api.deleteAccount()
        window.location.href = "/" // Instantly redirect to login
      } catch (err) {
        console.error(err);
        setIsDeleting(false);
      }
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
          
          {successMessage && (
            <div className="mb-8 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <p className="text-sm font-medium text-green-500">{successMessage}</p>
            </div>
          )}
          
          {errorMessage && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm font-medium text-red-500">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleProfileUpdate} className="space-y-8 max-w-2xl">
            <div>
              <label className="block text-sm font-medium mb-4 text-muted-foreground">Avatar</label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center border border-border/50 overflow-hidden shadow-sm text-muted-foreground/50 shrink-0">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-5 py-2.5 bg-background hover:bg-secondary/50 rounded-full text-sm font-medium transition-colors border border-border shadow-sm flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Upload New
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      if(e.target.files?.[0]) {
                         const form = new FormData(); form.append("avatar", e.target.files[0]); await api.updateProfile(form); onUpdate?.(); 
                         setSuccessMessage("Avatar uploaded successfully!"); setTimeout(() => setSuccessMessage(null), 4000);
                      }
                    }} />
                  </label>
                  {user?.avatar_url && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({
                        isOpen: true,
                        title: "Remove Avatar",
                        message: "Are you sure you want to remove your profile picture?",
                        confirmText: "Remove",
                        action: async () => {
                           const form = new FormData();
                           form.append("remove_avatar", "true");
                           await api.updateProfile(form);
                           onUpdate?.();
                        }
                      })}
                      className="px-5 py-2.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-full text-sm font-medium transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-5 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-full text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">First Name</label>
                {isEditing ? (
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="First Name" />
                ) : (
                  <div className="w-full bg-secondary/20 border border-transparent rounded-xl px-4 py-2.5 text-sm text-foreground">{firstName || "—"}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">Last Name</label>
                {isEditing ? (
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Last Name" />
                ) : (
                  <div className="w-full bg-secondary/20 border border-transparent rounded-xl px-4 py-2.5 text-sm text-foreground">{lastName || "—"}</div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Email Address</label>
              {isEditing ? (
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Email Address" />
              ) : (
                <div className="w-full bg-secondary/20 border border-transparent rounded-xl px-4 py-2.5 text-sm text-foreground">{email || "—"}</div>
              )}
            </div>
            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">New Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="••••••••" />
                </div>
              </div>
            )}
            {isEditing && (
              <div className="flex items-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
                <button type="submit" className="cozy-button text-primary-foreground px-8 py-3 rounded-full font-medium text-sm">Save Changes</button>
                <button type="button" onClick={() => {
                  setIsEditing(false);
                  setFirstName(user?.first_name || "");
                  setLastName(user?.last_name || "");
                  setEmail(user?.email || "");
                  setPassword("");
                  setConfirmPassword("");
                }} className="px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            )}
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
            <button onClick={() => setDeletePromptOpen(true)} className="px-8 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full text-sm font-medium transition-colors shadow-sm">
              Delete Account
            </button>
          </div>
        </section>
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
                onClick={async () => { await confirmAction.action(); setConfirmAction(null); }}
                className="px-6 py-2.5 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Prompt Modal */}
      {deletePromptOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center animate-in fade-in">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 animate-in zoom-in-95 text-white text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-6" />
            <h3 className="text-2xl font-light tracking-wide mb-4">Permanently Delete Account?</h3>
            <p className="text-sm text-white/70 mb-6 leading-relaxed">
              This action is irreversible. Type <strong className="text-white">DELETE</strong> to confirm.
            </p>
            <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder="TYPE DELETE" className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 text-white placeholder:text-white/40 text-center uppercase tracking-widest font-bold mb-8" />
            
            <div className="flex justify-center gap-4">
              <button onClick={() => { setDeletePromptOpen(false); setDeleteInput(""); }} className="px-5 py-2.5 text-sm font-semibold tracking-widest uppercase text-white/60 hover:text-white transition-colors">
                Cancel
              </button>
              <button disabled={deleteInput !== "DELETE" || isDeleting} onClick={confirmDeleteAccount} className="px-6 py-2.5 bg-red-500 text-white hover:bg-red-400 disabled:opacity-50 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  )
}