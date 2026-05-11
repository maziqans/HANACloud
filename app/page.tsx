"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/hana-cloud/sidebar"
import { MainContent } from "@/components/hana-cloud/main-content"
import { SettingsContent } from "@/components/hana-cloud/settings-content"
import * as api from "@/lib/api"

export default function HANACloudPage() {
  const [activeSection, setActiveSection] = useState("My Drive")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const isSettings = ["Profile Settings", "Storage Management", "Security Settings", "Settings"].includes(activeSection)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await api.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (e) {
          api.logout();
        }
      }
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.login({ username, password });
      const userData = await api.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (err) {
      alert("Invalid credentials. Please try again.");
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  if (isChecking) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground animate-pulse">Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background animate-in fade-in duration-700 p-4">
        <div className="w-full max-w-md p-8 bg-card rounded-3xl border border-border shadow-lg">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c.6 0 1-.4 1-1V6c0-.6-.4-1-1-1H6.5c-.6 0-1 .4-1 1v12c0 .6.4 1 1 1h11z"/><path d="M12 10v4"/><path d="M10 12h4"/></svg>
            </div>
          </div>
          <h1 className="text-2xl font-light tracking-tight mb-8 text-center">Welcome to HANACloud</h1>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" required placeholder="Enter your username" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" required placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full cozy-button text-primary-foreground px-4 py-3 rounded-xl font-medium mt-2">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        activeItem={activeSection}
        onNavigate={setActiveSection}
        user={user}
        onLogout={handleLogout}
      />
      {isSettings ? (
        <SettingsContent key={activeSection} activeSection={activeSection} />
      ) : (
        <MainContent key={activeSection} activeSection={activeSection} />
      )}
    </div>
  )
}
