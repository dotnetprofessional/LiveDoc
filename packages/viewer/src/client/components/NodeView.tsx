import { Node, Feature, Scenario, Specification, Rule, TestSuite, Test, Outline, Step, Binding, Container } from '@livedoc/schema';
import { StepList, TemplateStepList } from './StepList';
import { StatsBar } from './StatsBar';
import { ChevronRight, ChevronDown, Clock, Tag, FileText, CheckCircle2, XCircle, AlertCircle, HelpCircle, Layers, BookOpen, Target, Info } from 'lucide-react';
import { useStore } from '../store';
import { renderTitle } from '../lib/title-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface NodeViewProps {
  node: Node;
}

export function NodeView({ node }: NodeViewProps) {
  const { navigate } = useStore();
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  const summary = 'summary' in node ? (node as any).summary : undefined;
  const children = 'children' in node ? (node as any).children : undefined;
  const examples = 'examples' in node ? (node as any).examples : undefined;
  const templateSteps = 'templateSteps' in node ? (node as any).templateSteps : undefined;
  const steps = 'steps' in node ? (node as any).steps : undefined;

  const getHighlightValues = (binding?: Binding) => {
    if (!binding) return undefined;
    return binding.variables.reduce((acc, v) => {
      acc[v.name] = String(v.value.value);
      return acc;
    }, {} as Record<string, string>);
  };

  const highlightValues = getHighlightValues(node.binding);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-6 h-6 text-pass" />;
      case 'failed': return <XCircle className="w-6 h-6 text-fail" />;
      case 'pending': return <AlertCircle className="w-6 h-6 text-pending" />;
      default: return <HelpCircle className="w-6 h-6 text-muted-foreground/40" />;
    }
  };

  const renderTags = (tags?: string[]) => {
    if (!tags || tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-muted/50 text-muted-foreground border-none">
            <Tag className="w-3 h-3 mr-1.5 opacity-50" />
            {tag}
          </Badge>
        ))}
      </div>
    );
  };

  const renderHeader = () => (
    <div className="mb-10">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
              {node.kind === 'feature' ? <BookOpen className="w-5 h-5 text-primary" /> : 
               node.kind === 'scenario' ? <Target className="w-5 h-5 text-primary" /> :
               <FileText className="w-5 h-5 text-primary" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              {node.kind}
            </span>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <Badge variant="outline" className="rounded-full text-[10px] font-bold uppercase tracking-widest border-muted-foreground/20 text-muted-foreground/60">
              ID: {node.id.split('-')[0]}
            </Badge>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="mt-1 shrink-0">
              {getStatusIcon(node.execution.status)}
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground leading-tight">
              {renderTitle(node.title, highlightValues)}
            </h1>
          </div>

          {node.description && (
            <div className="mt-6 relative">
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
              <p className="text-muted-foreground text-lg font-medium leading-relaxed whitespace-pre-wrap pl-2">
                {node.description}
              </p>
            </div>
          )}
          
          {renderTags(node.tags)}
        </div>

        <div className="flex flex-col items-end gap-4 shrink-0">
          <Card className="bg-card border-none shadow-lg p-4 min-w-45">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duration</span>
                <span className="text-sm font-black flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {node.execution.duration}ms
                </span>
              </div>
              {summary && (
                <>
                  <Separator className="opacity-50" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Results</span>
                      <span className="text-[10px] font-bold">{summary.total} Total</span>
                    </div>
                    <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-muted">
                      <div className="bg-pass h-full" style={{ width: `${(summary.passed / summary.total) * 100}%` }} />
                      <div className="bg-fail h-full" style={{ width: `${(summary.failed / summary.total) * 100}%` }} />
                      <div className="bg-pending h-full" style={{ width: `${(summary.pending / summary.total) * 100}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderExamples = () => {
    if (!examples || examples.length === 0) return null;

    // Get headers from first example
    const headers = Object.keys(examples[0].exampleValues || {});
    if (headers.length === 0) return null;

    const selectedExample = examples.find(e => e.id === selectedExampleId);
    const substitutionValues = selectedExample?.exampleValues || null;

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
              {examples.map((example, idx) => (
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
                  <StepList steps={selectedExample.steps || []} highlightValues={selectedExample.exampleValues} />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderChildren = () => {
    if (!children || children.length === 0) return null;
    return (
      <div className="mt-16 space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Specifications</h2>
            <p className="text-sm text-muted-foreground font-medium">Nested requirements and scenarios</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map(child => (
            <Card 
              key={child.id}
              className="group cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-muted/50 overflow-hidden"
              onClick={() => navigate('node', child.id)}
            >
              <div className="flex items-stretch min-h-16">
                <div className={cn(
                  "w-1 shrink-0 transition-colors duration-300",
                  child.execution.status === 'passed' ? 'bg-pass' : 
                  child.execution.status === 'failed' ? 'bg-fail' : 'bg-pending'
                )} />
                <div className="flex-1 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {getStatusIcon(child.execution.status)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                        {child.kind}
                      </div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {child.title}
                      </h3>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {renderHeader()}
      
      <Separator className="my-10 opacity-50" />

      {steps && steps.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Execution</h2>
              <p className="text-sm text-muted-foreground font-medium">Step-by-step verification</p>
            </div>
          </div>
          <Card className="border-none shadow-2xl bg-card overflow-hidden">
            <CardContent className="pt-10">
              <StepList steps={steps} highlightValues={highlightValues} />
            </CardContent>
          </Card>
        </div>
      )}

      {renderExamples()}
      {renderChildren()}
    </div>
  );
}
