import * as React from "react"
import { Sidebar } from "./Sidebar"
import { useStore } from "../store"
import { isEmbedded, isStaticMode } from "../config"
import { Button } from "./ui/button"
import { Menu, Moon, Sun, Settings2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { Switch } from "./ui/switch"
import { GlobalFilter } from "./GlobalFilter"
import { Badge } from "./ui/badge"
import { RunProgressBanner } from "./RunProgressBanner"
import { ProjectGroupingOnboarding } from "./ProjectGroupingOnboarding"
import { VIEWER_VERSION } from "../lib/version"
import { cn } from "../lib/utils"
import { TEST_TYPES, type TestType } from "../lib/test-type-filter"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"
import { usePanelRef } from "react-resizable-panels"
import { MIN_CONTENT_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, SIDEBAR_DIVIDER_WIDTH } from "../lib/sidebar-layout"

export function Layout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = React.useState(true)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const embedded = isEmbedded()
  const staticMode = isStaticMode()
  const [desktop, setDesktop] = React.useState(() => window.matchMedia('(min-width: 768px)').matches)
  const groupElement = React.useRef<HTMLDivElement>(null)
  const sidebarPanel = usePanelRef()
  const initialSidebarWidth = React.useRef(useStore.getState().sidebarWidth)
  const showDesktopSidebar = desktop && !embedded
  const {
    audienceMode,
    setAudienceMode,
    connectionStatus,
    projectGrouping,
    followLatestRun,
    setProjectGroupingEnabled,
    setProjectGroupingHideSourceProjects,
    setFollowLatestRun,
    testTypes,
    setTestTypeIncluded,
  } = useStore()

  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
        ? 'Connecting'
        : connectionStatus === 'disconnected'
          ? 'Disconnected'
          : 'Error'

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => {
      setDesktop(media.matches)
      if (media.matches) setMobileNavOpen(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  React.useEffect(() => {
    if (!showDesktopSidebar || !groupElement.current) return
    // Clamp the rendered width without overwriting the preference on smaller windows.
    let frame = 0
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const available = entry.contentRect.width - MIN_CONTENT_WIDTH - SIDEBAR_DIVIDER_WIDTH
      const width = Math.max(MIN_SIDEBAR_WIDTH, Math.min(useStore.getState().sidebarWidth, available))
      cancelAnimationFrame(frame)
      // Let the primitive update its group measurement before applying pixel constraints.
      frame = requestAnimationFrame(() => sidebarPanel.current?.resize(`${width}px`))
    })
    observer.observe(groupElement.current)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [showDesktopSidebar, sidebarPanel])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {!embedded && (
        <>
          <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <DialogContent aria-describedby={undefined} className="left-0 top-0 h-dvh w-[min(88vw,20rem)] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 md:hidden">
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <Sidebar fullWidth />
            </DialogContent>
          </Dialog>
        </>
      )}

      <ResizablePanelGroup
        orientation="horizontal"
        elementRef={groupElement}
        resizeTargetMinimumSize={{ fine: 12, coarse: 44 }}
        onLayoutChanged={(_layout, meta) => {
          if (meta.isUserInteraction && sidebarPanel.current) {
            useStore.getState().setSidebarWidth(sidebarPanel.current.getSize().inPixels)
          }
        }}
      >
        {showDesktopSidebar && (
          <>
            <ResizablePanel
              id="report-sidebar"
              panelRef={sidebarPanel}
              defaultSize={`${initialSidebarWidth.current}px`}
              minSize={`${MIN_SIDEBAR_WIDTH}px`}
              maxSize={`${MAX_SIDEBAR_WIDTH}px`}
              groupResizeBehavior="preserve-pixel-size"
            >
              <Sidebar fullWidth />
            </ResizablePanel>
            <ResizableHandle aria-label="Resize navigation sidebar" title="Drag to resize navigation; use arrow keys when focused" />
          </>
        )}
        <ResizablePanel id="report-content" minSize={showDesktopSidebar ? `${MIN_CONTENT_WIDTH}px` : 0}>
      <div className="@container flex h-full flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between gap-2 px-3 sm:px-6 shrink-0 bg-card/50 backdrop-blur-md z-10">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {!embedded && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full md:hidden"
                aria-label="Open navigation"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <GlobalFilter className="max-w-2xl w-full" />

            <div className="hidden @3xl:flex items-center gap-2 text-xs text-muted-foreground">
              {staticMode ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-indigo-500/40 bg-indigo-500/15 text-indigo-400 font-bold"
                >
                  Static Report
                </Badge>
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className={
                      connectionStatus === 'connected'
                        ? 'rounded-full border-primary/40 bg-primary/15 text-primary font-bold'
                        : connectionStatus === 'connecting'
                          ? 'rounded-full border-muted-foreground/30 bg-muted/60 text-foreground font-bold'
                          : 'rounded-full border-destructive/40 bg-destructive/15 text-destructive font-bold'
                    }
                  >
                    {connectionLabel}
                  </Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden @2xl:inline-flex rounded-full border-muted-foreground/20 bg-background/60 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              title={`LiveDoc Viewer version ${VIEWER_VERSION}`}
            >
              Viewer v{VIEWER_VERSION}
            </Badge>
            <Tabs className="hidden @xl:block" value={audienceMode} onValueChange={(v) => setAudienceMode(v as any)}>
              <TabsList className="h-9 rounded-full bg-muted/40">
                <TabsTrigger value="business" className="rounded-full text-xs">Business</TabsTrigger>
                <TabsTrigger value="developer" className="rounded-full text-xs">Developer</TabsTrigger>
              </TabsList>
            </Tabs>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Viewer settings">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto">
                <DropdownMenuLabel>Viewer settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Included test types</DropdownMenuLabel>
                <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground">
                  Excluded types are hidden from results and test metrics. Your reports are unchanged.
                </p>
                {TEST_TYPES.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={testTypes[type]}
                    onCheckedChange={included => setTestTypeIncluded(type, included)}
                    onSelect={event => event.preventDefault()}
                    className="min-h-9"
                  >
                    {testTypeLabels[type]}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <SettingsSwitchRow
                  title="Group related test projects"
                  description="Combine projects by prefix, environment, and run timing."
                  checked={projectGrouping.enabled}
                  onCheckedChange={setProjectGroupingEnabled}
                />
                <SettingsSwitchRow
                  title="Hide grouped source projects"
                  description="Keep individual test projects out of the project selector once grouped."
                  checked={projectGrouping.hideSourceProjects}
                  disabled={!projectGrouping.enabled}
                  onCheckedChange={setProjectGroupingHideSourceProjects}
                />
                <SettingsSwitchRow
                  title="Always show latest run"
                  description="Automatically switch to the newest run as test executions start and complete."
                  checked={followLatestRun}
                  onCheckedChange={setFollowLatestRun}
                />
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsDark(!isDark)}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Run progress indicator */}
        {!staticMode && <RunProgressBanner />}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="container max-w-7xl mx-auto px-2 py-4 sm:px-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ProjectGroupingOnboarding disabled={embedded} />
    </div>
  )
}

const testTypeLabels: Record<TestType, string> = {
  features: 'Features',
  specifications: 'Specifications',
  tests: 'Standard tests (non-LiveDoc)',
}

interface SettingsSwitchRowProps {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

function SettingsSwitchRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: SettingsSwitchRowProps) {
  const id = React.useId()
  const descriptionId = `${id}-description`

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-muted/60",
        disabled && "opacity-50"
      )}
    >
      <div className="min-w-0 space-y-1">
        <label
          htmlFor={id}
          className={cn(
            "block text-sm font-medium leading-none text-foreground",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {title}
        </label>
        <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
    </div>
  )
}
