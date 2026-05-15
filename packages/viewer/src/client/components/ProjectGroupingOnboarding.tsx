import * as React from "react"
import { Layers3, SplitSquareHorizontal, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
  hasProjectGroupingPreference,
  hasSeenProjectGroupingOnboarding,
  markProjectGroupingOnboardingSeen,
  useStore,
} from "../store"

export function ProjectGroupingOnboarding({ disabled = false }: { disabled?: boolean }) {
  const {
    runs,
    getDetectedRunGroups,
    setProjectGroupingEnabled,
    setProjectGroupingHideSourceProjects,
  } = useStore()

  const [handled, setHandled] = React.useState(() =>
    hasSeenProjectGroupingOnboarding() || hasProjectGroupingPreference()
  )
  const [open, setOpen] = React.useState(false)

  const detectedGroups = React.useMemo(() => getDetectedRunGroups(), [getDetectedRunGroups, runs])
  const firstGroup = detectedGroups[0]
  const sourceProjects = React.useMemo(() => {
    const names = new Set<string>()
    for (const group of detectedGroups) {
      for (const run of group.group.runs) names.add(run.project)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [detectedGroups])

  React.useEffect(() => {
    if (disabled || handled || detectedGroups.length === 0) return
    setOpen(true)
  }, [detectedGroups.length, disabled, handled])

  const rememberChoice = React.useCallback(() => {
    markProjectGroupingOnboardingSeen()
    setHandled(true)
    setOpen(false)
  }, [])

  const useGroupedView = React.useCallback(() => {
    setProjectGroupingHideSourceProjects(true)
    setProjectGroupingEnabled(true)
    rememberChoice()
  }, [rememberChoice, setProjectGroupingEnabled, setProjectGroupingHideSourceProjects])

  const useIndividualProjects = React.useCallback(() => {
    setProjectGroupingEnabled(false)
    rememberChoice()
  }, [rememberChoice, setProjectGroupingEnabled])

  if (!firstGroup) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          return
        }
        rememberChoice()
      }}
    >
      <DialogContent className="max-w-xl overflow-hidden border-primary/20 bg-card p-0 shadow-2xl">
        <div className="relative px-6 pt-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
          <DialogHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary shadow-inner">
                <Layers3 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <Badge variant="outline" className="w-fit rounded-full border-primary/30 bg-primary/10 text-primary">
                  Project group detected
                </Badge>
                <DialogTitle className="text-2xl leading-tight">
                  Show these test projects as one workspace?
                </DialogTitle>
                <DialogDescription className="text-sm leading-6">
                  LiveDoc noticed related projects starting close together and can present them as one
                  logical project named <span className="font-semibold text-foreground">{firstGroup.group.name}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2">
          <div className="grid gap-3 rounded-2xl border bg-background/60 p-4">
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                {detectedGroups.length} grouped run {detectedGroups.length === 1 ? 'set' : 'sets'} across{' '}
                {sourceProjects.length} source {sourceProjects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceProjects.slice(0, 5).map((project) => (
                <span key={project} className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {project}
                </span>
              ))}
              {sourceProjects.length > 5 && (
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  +{sourceProjects.length - 5} more
                </span>
              )}
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-3 text-xs text-muted-foreground">
              <SplitSquareHorizontal className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Grouped mode hides the individual source projects from the project selector by default,
                while keeping source-project folders inside the run so provenance stays visible.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-between sm:space-x-0">
          <Button variant="ghost" onClick={useIndividualProjects}>
            Show individual projects
          </Button>
          <Button onClick={useGroupedView}>
            Use grouped project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
