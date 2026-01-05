import * as React from "react"
import { Sidebar } from "./Sidebar"
import { useStore } from "../store"
import { isEmbedded } from "../config"
import { Button } from "./ui/button"
import { Moon, Sun, Search, LayoutDashboard, FileText, Settings, Bell } from "lucide-react"
import { cn } from "../lib/utils"

export function Layout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = React.useState(true)
  const embedded = isEmbedded()

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {!embedded && <Sidebar />}
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-card/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search specifications..." 
                className="w-full bg-muted/50 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => setIsDark(!isDark)}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="h-8 w-px bg-border mx-2" />
            <div className="flex items-center gap-3 pl-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                LD
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold leading-none">LiveDoc</div>
                <div className="text-[10px] text-muted-foreground mt-1">vNext Viewer</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="container max-w-7xl mx-auto py-8 px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
