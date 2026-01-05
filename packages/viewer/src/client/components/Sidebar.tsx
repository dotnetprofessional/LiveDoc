import * as React from "react"
import { useStore, ProjectNode, Environment, HistoryRun } from '../store';
import { getApiBaseUrl } from '../config';
import { StatusBadge } from './StatusBadge';
import { Node } from '@livedoc/schema';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  History, 
  Trash2, 
  Activity, 
  Globe, 
  Box,
  Search,
  Plus,
  MoreVertical
} from "lucide-react"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { motion, AnimatePresence } from "framer-motion"

export function Sidebar() {
  const { 
    runs, 
    projectHierarchy,
    selectedRunId, 
    selectedNodeId,
    connectionStatus,
    sidebarWidth,
    expandedItems,
    selectRun,
    navigate,
    toggleExpanded,
    removeRun,
    getCurrentRun,
  } = useStore();

  const currentRun = getCurrentRun();
  const [searchQuery, setSearchQuery] = React.useState("");

  const connectionColors: Record<string, string> = {
    connected: 'bg-pass shadow-[0_0_8px_rgba(34,197,94,0.5)]',
    connecting: 'bg-pending animate-pulse',
    disconnected: 'bg-muted-foreground/30',
    error: 'bg-fail shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  };

  const connectionLabels: Record<string, string> = {
    connected: 'Live',
    connecting: 'Connecting...',
    disconnected: 'Offline',
    error: 'Error',
  };

  // Delete a run
  const handleDelete = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this run?')) return;
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/runs/${runId}`, { method: 'DELETE' });
      if (response.ok) {
        removeRun(runId);
      }
    } catch (err) {
      console.error('Failed to delete run:', err);
    }
  };

  // Render a history run item
  const renderHistoryRun = (run: HistoryRun, project: string, env: string) => {
    const isSelected = run.runId === selectedRunId;
    const date = new Date(run.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return (
      <motion.li 
        key={run.runId}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "group pl-10 pr-2 py-2 cursor-pointer transition-all flex items-center justify-between rounded-md mx-2 mb-0.5",
          isSelected 
            ? "bg-primary/10 text-primary font-medium" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={() => {
          selectRun(run.runId);
          navigate('summary');
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <History className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground/50")} />
          <span className="text-xs truncate">{formattedDate}</span>
        </div>
        <button 
          onClick={(e) => handleDelete(e, run.runId)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fail/10 hover:text-fail rounded transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </motion.li>
    );
  };

  // Render the tree recursively
  const renderTree = (nodes: Node[], level = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedItems.has(node.id);
      const isSelected = selectedNodeId === node.id;
      const children = (node as any).children || (node as any).examples || [];
      const hasChildren = children.length > 0;
      
      // Filter by search
      if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        if (!hasChildren) return null;
        // If children match, we should still show this node
        const childrenMatch = children.some((c: Node) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!childrenMatch) return null;
      }

      return (
        <div key={node.id} className="select-none">
          <div 
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-all rounded-md mx-2 mb-0.5 group",
              isSelected 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            style={{ paddingLeft: `${(level * 12) + 8}px` }}
            onClick={() => {
              if (hasChildren) toggleExpanded(node.id);
              navigate('node', node.id);
            }}
          >
            <div 
              className="w-4 h-4 flex items-center justify-center shrink-0"
              onClick={(e) => {
                if (hasChildren) {
                  e.stopPropagation();
                  toggleExpanded(node.id);
                }
              }}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <div className="w-1 h-1 rounded-full bg-current opacity-20" />
              )}
            </div>
            
            {node.kind === 'Feature' || node.kind === 'Specification' ? (
              <FileText className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : "text-primary/70")} />
            ) : (
              <Folder className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground/50")} />
            )}
            
            <span className="text-sm truncate flex-1">{node.title}</span>
            
            {node.execution?.status && (
              <StatusBadge status={node.execution.status} size="xs" />
            )}
          </div>
          
          <AnimatePresence initial={false}>
            {hasChildren && isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                {renderTree(children, level + 1)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  return (
    <aside 
      className="flex flex-col bg-card border-r shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
      style={{ width: sidebarWidth }}
    >
      {/* Sidebar Header */}
      <div className="h-16 border-b flex items-center px-4 gap-3 shrink-0 bg-muted/30">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Activity className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate tracking-tight">LiveDoc</h1>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", connectionColors[connectionStatus])} />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {connectionLabels[connectionStatus]}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Filter..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/50 border-none rounded-md py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        <div 
          className={cn(
            "flex items-center gap-3 py-2 px-4 cursor-pointer transition-all hover:bg-muted group mb-2",
            !selectedNodeId && selectedRunId === 'current' && "bg-primary/5 border-r-2 border-primary"
          )}
          onClick={() => navigate('summary')}
        >
          <Box className={cn("w-4 h-4", !selectedNodeId && selectedRunId === 'current' ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium", !selectedNodeId && selectedRunId === 'current' ? "text-primary" : "text-foreground")}>
            Dashboard
          </span>
        </div>

        {/* Current Run Tree */}
        {currentRun && (
          <div className="mb-6">
            <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              <span>Specifications</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-[9px]">{currentRun.documents.length}</span>
            </div>
            <div className="mt-1">
              {renderTree(currentRun.documents)}
            </div>
          </div>
        )}

        {/* History */}
        {projectHierarchy.length > 0 && (
          <div className="mt-4">
            <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              History
            </div>
            {projectHierarchy.map(project => (
              <div key={project.name} className="mt-1">
                <div 
                  className="flex items-center gap-2 py-1.5 px-4 cursor-pointer hover:bg-muted/50 text-muted-foreground transition-all"
                  onClick={() => toggleExpanded(project.name)}
                >
                  {expandedItems.has(project.name) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Globe className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium truncate">{project.name}</span>
                </div>
                
                <AnimatePresence>
                  {expandedItems.has(project.name) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {project.environments.map(env => {
                        const envKey = `${project.name}/${env.name}`;
                        const isEnvExpanded = expandedItems.has(envKey);
                        const historyKey = `${envKey}/history`;
                        const isHistoryExpanded = expandedItems.has(historyKey);

                        return (
                          <div key={env.name}>
                            <div 
                              className="flex items-center gap-2 py-1.5 px-8 cursor-pointer hover:bg-muted/50 text-muted-foreground transition-all"
                              onClick={() => toggleExpanded(envKey)}
                            >
                              {isEnvExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <span className="text-xs truncate">{env.name}</span>
                            </div>
                            
                            <AnimatePresence>
                              {isEnvExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  {/* Latest run */}
                                  {env.latestRun && (
                                    <div 
                                      className={cn(
                                        "group pl-12 pr-2 py-1.5 cursor-pointer transition-all flex items-center justify-between rounded-md mx-2 mb-0.5",
                                        env.latestRun.runId === selectedRunId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                      )}
                                      onClick={() => {
                                        selectRun(env.latestRun!.runId);
                                        navigate('summary');
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(env.latestRun.status || ''))} />
                                        <span className="text-xs">Latest</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* History folder */}
                                  {env.history.length > 0 && (
                                    <div>
                                      <div 
                                        className="flex items-center gap-2 py-1.5 px-12 cursor-pointer hover:bg-muted/50 text-muted-foreground transition-all"
                                        onClick={() => toggleExpanded(historyKey)}
                                      >
                                        {isHistoryExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        <span className="text-xs">History ({env.history.length})</span>
                                      </div>
                                      
                                      <AnimatePresence>
                                        {isHistoryExpanded && (
                                          <motion.ul
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            {env.history.map(run => renderHistoryRun(run, project.name, env.name))}
                                          </motion.ul>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">LD</span>
            </div>
            <span className="text-xs font-medium">LiveDoc User</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'passed':
      return 'bg-pass';
    case 'failed':
      return 'bg-fail';
    case 'running':
      return 'bg-accent animate-pulse';
    case 'pending':
      return 'bg-pending';
    default:
      return 'bg-muted-foreground/30';
  }
}
