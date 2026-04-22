import { useStore } from '../store';
import { SummaryView } from './SummaryView';
import { NodeView } from './NodeView';
import { GroupView } from './GroupView';
import { ClipboardList, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function MainContent() {
  const { currentView, getCurrentViewData, getCurrentNode, connectionStatus } = useStore();
  
  const viewData = getCurrentViewData();
  const node = getCurrentNode();

  if (!viewData) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center bg-background/50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md px-6"
        >
          <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            {connectionStatus === 'connecting' ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <ClipboardList className="w-10 h-10 text-muted-foreground/50" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">No test results yet</h2>
          <p className="text-muted-foreground mb-8">
            {connectionStatus === 'connecting' 
              ? "Connecting to the LiveDoc server..." 
              : "Run your tests with the LiveDoc reporter to see real-time living documentation here."}
          </p>
          <div className="p-4 bg-card border rounded-xl text-left text-xs font-mono text-muted-foreground">
            <p className="mb-2 text-foreground font-semibold">Quick Start:</p>
            <p>pnpm vitest --reporter @swedevtools/livedoc-vitest</p>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-background/50">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView.type + (currentView.id || '')}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="p-6 md:p-10"
        >
          {currentView.type === 'summary' && (
            <SummaryView run={viewData as any} />
          )}
          
          {currentView.type === 'node' && node && (
            <NodeView node={node} />
          )}

          {currentView.type === 'group' && currentView.id && (
            <GroupView run={viewData as any} groupId={currentView.id} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
