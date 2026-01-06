import * as React from "react"
import { Sidebar } from "./Sidebar"
import { useStore } from "../store"
import { isEmbedded } from "../config"
import { Button } from "./ui/button"
import { Moon, Sun, Bell } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { GlobalFilter } from "./GlobalFilter"

export function Layout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = React.useState(true)
  const embedded = isEmbedded()
  const { audienceMode, setAudienceMode } = useStore()

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
            <GlobalFilter className="max-w-2xl w-full" />
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={audienceMode} onValueChange={(v) => setAudienceMode(v as any)}>
              <TabsList className="h-9 rounded-full bg-muted/40">
                <TabsTrigger value="business" className="rounded-full text-xs">Business</TabsTrigger>
                <TabsTrigger value="developer" className="rounded-full text-xs">Developer</TabsTrigger>
              </TabsList>
            </Tabs>
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
