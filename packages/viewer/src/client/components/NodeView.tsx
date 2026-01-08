import { Node, Binding, Feature, Scenario, SpecKind, Status } from '@livedoc/schema';
import { StepList, TemplateStepList } from './StepList';
import { ChevronRight, CheckCircle2, XCircle, AlertCircle, HelpCircle, Layers, FileText, BookOpen, ScrollText, LayoutList, Home } from 'lucide-react';
import { useStore } from '../store';
import { renderTitle } from '../lib/title-utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { subtreeHasMatch, normalizeTag } from '../lib/filter-utils';
import { Markdown } from './Markdown';
import { StatusBadge } from './StatusBadge';
import { buildGroupedNavTree, findNavItemById, NavItem } from '../lib/nav-tree';
import { ScenarioBlock } from './ScenarioBlock';

interface NodeViewProps {
  node: Node;
}

function getIconForKind(kind: string) {
  switch (kind) {
    case SpecKind.Feature: return BookOpen;
    case SpecKind.Specification: return ScrollText;
    case SpecKind.Suite: return LayoutList;
    default: return FileText;
  }
}

function findNavPath(items: NavItem[], targetId: string): NavItem[] | null {
  for (const item of items) {
    if (item.id === targetId) return [item];
    if (item.kind === 'Group') {
      const found = findNavPath(item.children, targetId);
      if (found) return [item, ...found];
    }
  }
  return null;
}

export function NodeView({ node }: NodeViewProps) {
  const { navigate, audienceMode, getCurrentRun, filterText, filterTags } = useStore();
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  const run = getCurrentRun();
  const kind = String((node as any).kind ?? '').toLowerCase();
  const isBusiness = audienceMode === 'business';
  const isContainer = [SpecKind.Feature, SpecKind.Specification, SpecKind.Suite].some(k => k.toLowerCase() === kind);

  // Build nav tree for breadcrumbs
  const navTree = useMemo(() => run ? buildGroupedNavTree(run.documents ?? []) : [], [run?.documents]);

  // Given any node (Scenario/Step/etc), find the owning Feature by scanning documents.
  // Then resolve background either from feature.background OR a Background node under feature.children.
  const feature = useMemo<Feature | undefined>(() => {
    if (!run?.documents) return undefined;

    const isFeature = (n: any) => String(n?.kind ?? '').toLowerCase() === SpecKind.Feature.toLowerCase();

    const containsId = (n: any): boolean => {
      if (!n) return false;
      if (n.id === node.id) return true;

      const children = (n.children as any[] | undefined) ?? (n.steps as any[] | undefined);
      if (Array.isArray(children)) {
        for (const c of children) {
          if (containsId(c)) return true;
        }
      }

      const examples = n.examples as any[] | undefined;
      if (Array.isArray(examples)) {
        for (const e of examples) {
          if (containsId(e)) return true;
        }
      }

      const template = (n as any).template;
      if (template && containsId(template)) return true;

      return false;
    };

    for (const doc of run.documents) {
      if (isFeature(doc) && containsId(doc)) return doc as Feature;
    }
    return undefined;
  }, [run?.documents, node.id]);

  const background = useMemo<Scenario | undefined>(() => {
    if (!feature) return undefined;

    // vNext shape
    if (feature.background) return feature.background;

    // Legacy/batch shape: Background as first-class child under Feature
    const bg = (feature as any).children?.find((c: any) =>
      String(c?.kind ?? '').toLowerCase() === SpecKind.Background.toLowerCase()
    );
    return bg as Scenario | undefined;
  }, [feature]);

  // Get breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (feature) {
      const path = findNavPath(navTree, feature.id);
      return path || [];
    }
    if (isContainer) {
      const path = findNavPath(navTree, node.id);
      return path || [];
    }
    return [];
  }, [navTree, feature, node.id, isContainer]);

  const summary = 'summary' in node ? (node as any).summary : undefined;
  const children = 'children' in node ? (node as any).children : undefined;
  const examples = 'examples' in node ? (node as any).examples : undefined;
  const templateSteps = 'templateSteps' in node ? (node as any).templateSteps : undefined;
  
  const isLeafContainer = [SpecKind.Scenario, SpecKind.Background, SpecKind.Rule, SpecKind.Test].some(k => k.toLowerCase() === kind);
  const steps = 'steps' in node ? (node as any).steps : (isLeafContainer ? children : undefined);
  const showCards = children && !isLeafContainer;

  const kindPrefixTitle = (kindLabel: string, title: string) => `${kindLabel}: ${title}`;

  type BindingVariable = { name: string; value: { value: unknown } };
  const getHighlightValues = (binding?: Binding) => {
    if (!binding) return undefined;
    const variables = (binding as any).variables as BindingVariable[] | undefined;
    if (!variables || variables.length === 0) return undefined;
    return variables.reduce<Record<string, string>>((acc, v) => {
      acc[v.name] = String(v.value?.value);
      return acc;
    }, {});
  };

  const highlightValues = getHighlightValues(node.binding);

  const isScenarioView = !!feature && kind === SpecKind.Scenario.toLowerCase();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-6 h-6 text-pass" />;
      case 'failed': return <XCircle className="w-6 h-6 text-fail" />;
      case 'pending': return <AlertCircle className="w-6 h-6 text-pending" />;
      default: return <HelpCircle className="w-6 h-6 text-muted-foreground/40" />;
    }
  };

  // Determine the container to display as header (same style as GroupView)
  const containerNode = feature || (isContainer ? node : undefined);
  const containerTitle = containerNode?.title || '';
  const containerDescription = containerNode?.description;
  const containerTags = containerNode?.tags || [];
  const containerStatus = containerNode?.execution?.status as Status | undefined;
  const environment = run?.environment || 'local';

  const containerTitleWithKind = containerNode
    ? (containerNode.kind.toLowerCase() === SpecKind.Feature.toLowerCase()
      ? kindPrefixTitle('Feature', containerTitle)
      : containerTitle)
    : '';

  const renderExamples = () => {
    if (!examples || examples.length === 0) return null;

    const headers = Object.keys(examples[0].exampleValues || {});
    if (headers.length === 0) return null;

    const selectedExample = (examples as any[]).find((e: any) => e.id === selectedExampleId);

    return (
      <div className="mt-12 space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Examples</h2>
            <p className="text-sm text-muted-foreground font-medium">Data-driven execution scenarios</p>
          </div>
        </div>

        {templateSteps && (
          <Card className="border-none shadow-xl bg-muted/30 overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/50">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Scenario Template
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <TemplateStepList steps={templateSteps} />
            </CardContent>
          </Card>
        )}

        <div className="overflow-hidden rounded-2xl border border-border shadow-xl bg-card">
          <table className="min-w-full text-sm font-medium border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-12 px-4 py-4 text-center font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50">#</th>
                <th className="w-12 px-4 py-4 text-center font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50">Status</th>
                {headers.map(h => (
                  <th key={h} className="px-6 py-4 text-left font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-r-0">
                    {h}
                  </th>
                ))}
                <th className="w-12 px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {(examples as any[]).map((example: any, idx: number) => (
                <tr 
                  key={example.id} 
                  className={cn(
                    "border-b border-border/50 last:border-b-0 transition-all cursor-pointer group",
                    selectedExampleId === example.id ? "bg-primary/5" : "hover:bg-muted/20"
                  )}
                  onClick={() => setSelectedExampleId(selectedExampleId === example.id ? null : example.id)}
                >
                  <td className="px-4 py-4 text-center font-mono text-xs text-muted-foreground border-r border-border/50">{idx + 1}</td>
                  <td className="px-4 py-4 text-center border-r border-border/50">
                    <div className="flex justify-center">
                      {getStatusIcon(example.execution.status)}
                    </div>
                  </td>
                  {headers.map(h => (
                    <td key={h} className="px-6 py-4 text-foreground/80 border-r border-border/50 last:border-r-0 font-mono text-xs">
                      {example.exampleValues?.[h]}
                    </td>
                  ))}
                  <td className="px-4 py-4 text-center">
                    <ChevronRight className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-300",
                      selectedExampleId === example.id ? "rotate-90 text-primary" : "group-hover:translate-x-1"
                    )} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {selectedExampleId && selectedExample && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-4"
            >
              <Card className="border-primary/20 shadow-2xl bg-card overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-row items-center justify-between py-4">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Execution Details for Example #{examples.indexOf(selectedExample) + 1}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {selectedExample.execution.duration}ms
                  </Badge>
                </CardHeader>
                <CardContent className="pt-8">
                  <StepList
                    steps={selectedExample.steps || []}
                    highlightValues={selectedExample.exampleValues}
                    showDurations={!isBusiness}
                    showErrorStack={!isBusiness}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderChildren = () => {
    if (!showCards || !children || children.length === 0) return null;

    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;
    const visibleChildren = (!hasText && !hasTags)
      ? (children as any[])
      : (children as any[]).filter((child: any) => subtreeHasMatch(child as any, textLower, filterTags));

    if (visibleChildren.length === 0) return null;

    const Icon = FileText;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground tracking-tight flex-1">
            Scenarios
          </h3>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {visibleChildren.length}
          </span>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {visibleChildren.map((child: any) => (
              <button
                key={child.id}
                onClick={() => navigate('node', child.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {child.title}
                </span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {child.execution?.duration !== undefined && child.execution.duration < 1000 
                    ? `${Math.floor(child.execution.duration)}ms` 
                    : child.execution?.duration !== undefined 
                      ? `${(child.execution.duration / 1000).toFixed(2)}s` 
                      : ''}
                </span>
                <StatusBadge status={child.execution?.status} size="sm" />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* ========== HEADER - EXACT SAME STYLE AS GROUPVIEW ========== */}
      <div className="space-y-2">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2 overflow-hidden">
          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isRoot = item.title === 'Root' && index === 0;
              
              return (
                <div key={item.id} className="flex items-center gap-1 shrink-0">
                  {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
                  <button 
                    onClick={() => !isLast && navigate('group', item.id)}
                    disabled={isLast}
                    className={cn(
                      "flex items-center gap-1.5 hover:text-foreground transition-colors truncate px-1 py-0.5 rounded-md hover:bg-muted/50",
                      isLast && "font-medium text-foreground pointer-events-none bg-transparent hover:bg-transparent"
                    )}
                  >
                    {isRoot ? (
                      <>
                        <Home className="w-3.5 h-3.5" />
                        <span>Root</span>
                      </>
                    ) : item.title}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => navigate('group', 'group:/')}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors px-1 py-0.5 rounded-md hover:bg-muted/50"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              <span className="font-medium text-foreground px-1 py-0.5">{containerTitleWithKind || containerTitle}</span>
            </div>
          )}
        </nav>
        
        {/* Title + Status */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{containerTitleWithKind || containerTitle}</h1>
          <div className="flex items-center gap-3">
            {environment && <Badge variant="outline" className="text-muted-foreground font-normal border-border bg-muted/20">{environment}</Badge>}
            {containerStatus && <StatusBadge status={containerStatus} size="lg" showLabel />}
          </div>
        </div>
        
        {/* Description */}
        {containerDescription && (
          <Markdown content={containerDescription} className="max-w-3xl" />
        )}

        {/* Tags */}
        {containerTags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {containerTags.map(tag => (
              <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                {normalizeTag(tag)}
              </Badge> 
            ))}
          </div>
        )}
      </div>

      {/* ========== BACKGROUND ========== */}
      {background && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Background"
            title={renderTitle(background.title)}
            status={(background as any).execution?.status as Status | undefined}
            description={background.description}
            tags={(background as any).tags}
            steps={(((background as any).steps || background.children) ?? []) as any}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="background"
          />
        </div>
      )}

      {/* ========== SCENARIO SECTION (when viewing a child of a Feature) ========== */}
      {feature && kind !== 'feature' && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Scenario"
            title={renderTitle(node.title, highlightValues)}
            status={node.execution?.status as Status | undefined}
            description={node.description}
            tags={node.tags}
            steps={(steps ?? []) as any}
            highlightValues={highlightValues}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="scenario"
          />
        </div>
      )}

      {/* ========== FAILURE SUMMARY ========== */}
      {node.execution.status === 'failed' && node.execution.error && (
        <Card className="bg-destructive/5 border-destructive/20 shadow-none overflow-hidden">
          <CardHeader className="bg-destructive/10 border-b border-destructive/10 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <h3 className="text-sm font-bold text-destructive uppercase tracking-widest">Failure Summary</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-foreground/90 whitespace-pre-wrap font-mono">
              {node.execution.error.message}
            </div>
            {!isBusiness && node.execution.error.stack && (
              <div className="mt-4">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-fit">
                    <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                    Full Stack Trace
                  </summary>
                  <div className="mt-3 pl-6 border-l-2 border-destructive/10">
                    <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap overflow-x-auto max-h-80 scrollbar-thin">
                      {node.execution.error.stack}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== STEPS ========== */}
      {steps && steps.length > 0 && !isScenarioView && (
        <StepList
          steps={steps}
          highlightValues={highlightValues}
          showDurations={!isBusiness}
          showErrorStack={!isBusiness}
        />
      )}

      {/* ========== EXAMPLES (Scenario Outline) ========== */}
      {renderExamples()}

      {/* ========== CHILDREN (when viewing a container) ========== */}
      {renderChildren()}
    </div>
  );
}
