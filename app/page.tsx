"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/hana-cloud/sidebar"
import { MainContent } from "@/components/hana-cloud/main-content"
import { SettingsContent } from "@/components/hana-cloud/settings-content"
import * as api from "@/lib/api"
import { Cloud } from "lucide-react"

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
        } catch (e: any) {
          if (e.response && e.response.status === 401) {
            api.logout();
          } else {
            setIsAuthenticated(true);
          }
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
        <div className="w-full max-w-md p-10 bg-card rounded-3xl border border-border cozy-shadow">
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-5 shadow-sm border border-primary/20">
              <Cloud className="w-8 h-8 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-light tracking-tight text-center text-foreground">Welcome to HANACloud</h1>
            <p className="text-sm text-muted-foreground mt-2 text-center">Your private storage</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" required placeholder="Enter your username" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" required placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full cozy-button text-primary-foreground px-4 py-3.5 rounded-full font-medium mt-4 shadow-sm">Sign In</button>
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
