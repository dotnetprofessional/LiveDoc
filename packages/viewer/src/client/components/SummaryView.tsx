import { Run } from '../store';
import { StatsBar } from './StatsBar';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, Clock, Calendar, Globe, Zap, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { normalizeTag, subtreeHasMatch } from '../lib/filter-utils';

interface SummaryViewProps {
  run: Run;
}

export function SummaryView({ run }: SummaryViewProps) {
  const { navigate, filterText, filterTags } = useStore();
  
  const summary = run.summary;
  const duration = run.duration;
  const status = run.status;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const filteredDocuments = (() => {
    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;
    if (!hasText && !hasTags) return run.documents;
    return run.documents.filter((n) => subtreeHasMatch(n as any, textLower, filterTags));
  })();

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 border-primary/20 bg-primary/5 text-primary font-bold tracking-wider uppercase text-[10px]">
              {run.framework || 'LiveDoc'}
            </Badge>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(run.timestamp).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            {run.project || 'Test Results'}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-lg font-medium leading-relaxed">
            Living documentation generated from executable specifications. 
            Review the latest execution results and business requirements.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col items-end">
            <StatusBadge status={status as any} showLabel size="lg" className="px-6 py-2 text-sm" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 mr-1">
              Overall Status
            </span>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stats Card */}
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl bg-linear-to-br from-card to-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Execution Summary
            </CardTitle>
            <CardDescription>Real-time metrics from the latest test run</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <StatsBar summary={summary} duration={duration} size="lg" />
          </CardContent>
        </Card>

        {/* Environment Info Card */}
        <Card className="border-none shadow-xl bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Target</span>
              <Badge variant="secondary" className="font-bold">{run.environment || 'Default'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Started</span>
              <span className="text-sm font-bold">{new Date(run.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Duration</span>
              <span className="text-sm font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(duration)}
              </span>
            </div>
            <Separator />
            <div className="pt-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-wider">
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-wider">
                  Share Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Specifications List */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Specifications</h2>
              <p className="text-sm text-muted-foreground font-medium">Explore the executable requirements</p>
            </div>
          </div>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4"
        >
          {filteredDocuments.map(node => (
            <motion.div key={node.id} variants={item}>
              <Card 
                className="group cursor-pointer hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 border-muted/50 overflow-hidden"
                onClick={() => navigate('node', node.id)}
              >
                <div className="flex items-stretch min-h-20">
                  <div className={cn(
                    "w-1.5 shrink-0 transition-colors duration-300",
                    node.execution.status === 'passed' ? 'bg-pass' : 
                    node.execution.status === 'failed' ? 'bg-fail' : 'bg-pending'
                  )} />
                  <div className="flex-1 p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="shrink-0">
                        <StatusBadge status={node.execution.status} size="md" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                            {node.kind}
                          </span>
                          {node.tags && node.tags.length > 0 && (
                            <div className="flex gap-1">
                              {node.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {normalizeTag(String(tag))}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {node.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold">{node.execution.duration}ms</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Duration</span>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
