"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/hana-cloud/sidebar"
import { MainContent } from "@/components/hana-cloud/main-content"
import { SettingsContent } from "@/components/hana-cloud/settings-content"
import * as api from "@/lib/api"
import { Cloud, AlertCircle } from "lucide-react"

export default function HANACloudPage() {
  const [activeSection, setActiveSection] = useState("My Drive")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [initialItems, setInitialItems] = useState<any[]>([])

  const isSettings = ["Profile Settings", "Storage Management", "Security Settings", "Settings"].includes(activeSection)

  const fetchUser = async () => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);

      // Pre-fetch initial drive items to hydrate the state instantly
      try {
        const items = await api.fetchItems(null);
        setInitialItems(Array.isArray(items) ? items : []);
      } catch (err) {
        setInitialItems([]);
      }

      setIsAuthenticated(true);
    } catch (e: any) {
      if (e.response && e.response.status === 401) {
        api.logout();
        setIsAuthenticated(false);
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetchUser();
      }
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await api.login({ username, password });
      await fetchUser();
      
      // Handle redirect back to restricted share link if applicable
      const params = new URLSearchParams(window.location.search);
      if (params.get('redirect')) {
        window.location.href = params.get('redirect') as string;
      }
    } catch (err) {
      setLoginError("Invalid credentials. Please try again.");
      setTimeout(() => setLoginError(null), 4000);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  if (isChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white animate-pulse">Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950 overflow-hidden font-sans animate-in fade-in duration-700">
        {/* Background Image with a subtle zoom-in animation for a premium feel */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat animate-in zoom-in duration-1000"
          style={{ backgroundImage: `url('/login-bg.png')` }}
        />
        
        {/* Elegant dark gradient overlay to ensure text readability */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />

        {/* Luxury Glassmorphism Login Card */}
        <div className="relative z-10 w-full max-w-md p-10 md:p-14 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif text-white tracking-wider mb-2 drop-shadow-sm">
              HANACloud
            </h1>
            <div className="h-px w-12 bg-white/40 mx-auto my-5" />
            <p className="text-white/80 text-xs tracking-[0.3em] uppercase font-light">
              Exclusive Access
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleLogin} className="space-y-8">
            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-2 group">
              <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-widest transition-colors group-focus-within:text-white">
                Username
              </label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-transparent border-b border-white/30 focus:border-white text-white px-0 py-2 outline-none transition-colors placeholder:text-white/20 text-sm" required placeholder="Enter your username" />
            </div>
            
            <div className="space-y-2 group">
              <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-widest transition-colors group-focus-within:text-white">
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-transparent border-b border-white/30 focus:border-white text-white px-0 py-2 outline-none transition-colors placeholder:text-white/20 text-sm" required placeholder="••••••••" />
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full bg-white text-slate-900 py-4 font-medium tracking-widest uppercase text-xs hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70"
              >
                {isLoggingIn ? "Authenticating..." : "Sign In"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen relative overflow-hidden font-sans text-foreground bg-background transition-colors duration-300">
      
      {/* Background Image & Overlay (Only visible in dark mode for the premium feel, light mode uses pure colors) */}
      <div className="hidden dark:block absolute inset-0 z-0 bg-cover bg-center bg-no-repeat fixed opacity-50" style={{ backgroundImage: `url('/login-bg.png')` }} />
      <div className="hidden dark:block absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90 fixed" />

      {/* Main UI Content Container */}
      <div className="relative z-10 flex w-full h-screen">
        <Sidebar activeItem={activeSection} onNavigate={setActiveSection} user={user} onLogout={handleLogout} />
        <div className="flex-1 flex flex-col overflow-hidden bg-background dark:bg-white/5 dark:backdrop-blur-3xl border-l border-border dark:border-white/10 shadow-2xl transition-colors duration-300">
          {isSettings ? <SettingsContent user={user} onUpdate={fetchUser} activeSection={activeSection} /> : <MainContent user={user} activeSection={activeSection} initialItems={initialItems} />}
        </div>
      </div>
    </div>
  )
}
