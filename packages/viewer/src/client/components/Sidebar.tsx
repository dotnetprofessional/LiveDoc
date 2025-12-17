import { useStore, ProjectNode, Environment, HistoryRun } from '../store';
import { getApiBaseUrl } from '../config';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, ChevronDown, FolderIcon, FileIcon } from './Icons';

// Icons for the tree
function ProjectIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 1h5l.5.5L7.5 3h7l.5.5v11l-.5.5h-13l-.5-.5v-13l.5-.5zm0 1v12h13V4H7l-.5-.5L6 2H1.5z"/>
    </svg>
  );
}

function EnvIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4v8.5l-.5.5H11v-1h2V4H3v8h2v1H2.5l-.5-.5V4h12z"/>
      <path d="M8 5L4 9h3v4h2V9h3L8 5z"/>
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 7 7h-1a6 6 0 1 1-1.76-4.24l-1.95 1.95L14 8V2l-2.05 2.05A6.97 6.97 0 0 0 8 1z"/>
      <path d="M7.5 4v4.5l3 1.5.5-.87-2.5-1.25V4h-1z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5zm1 2h1v5H6V6zm3 0h1v5H9V6z"/>
    </svg>
  );
}

export function Sidebar() {
  const { 
    runs, 
    projectHierarchy,
    selectedRunId, 
    connectionStatus,
    sidebarWidth,
    theme,
    expandedItems,
    selectRun,
    navigate,
    toggleTheme,
    toggleExpanded,
    removeRun,
  } = useStore();

  const connectionColors: Record<string, string> = {
    connected: 'bg-pass',
    connecting: 'bg-pending animate-pulse',
    disconnected: 'bg-text-muted',
    error: 'bg-fail',
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
      <li 
        key={run.runId}
        className={`group pl-10 pr-2 py-1.5 cursor-pointer transition-colors flex items-center justify-between
          ${isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'}`}
        onClick={() => {
          selectRun(run.runId);
          navigate('summary');
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(run.status)}`}></span>
          <span className="text-xs text-text-muted truncate">{formattedDate}</span>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fail/20 rounded transition-opacity text-text-muted hover:text-fail"
          onClick={(e) => handleDelete(e, run.runId)}
          title="Delete run"
        >
          <TrashIcon />
        </button>
      </li>
    );
  };

  // Render environment node
  const renderEnvironment = (env: Environment, project: string) => {
    const envKey = `${project}/${env.name}`;
    const isExpanded = expandedItems.has(envKey);
    const historyKey = `${envKey}/history`;
    const isHistoryExpanded = expandedItems.has(historyKey);
    const latestRunId = env.latestRun?.runId;
    const isLatestSelected = latestRunId === selectedRunId;
    
    return (
      <li key={env.name}>
        {/* Environment header */}
        <div 
          className={`flex items-center gap-1 pl-4 pr-2 py-1.5 cursor-pointer transition-colors
            ${isLatestSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'}`}
          onClick={() => toggleExpanded(envKey)}
        >
          <span className="text-text-muted w-4 flex justify-center">
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </span>
          <span className="text-text-muted"><EnvIcon /></span>
          <span className="text-sm text-text flex-1">{env.name}</span>
          {env.latestRun && (
            <span className={`w-2 h-2 rounded-full ${getStatusDot(env.latestRun.status || '')}`}></span>
          )}
        </div>
        
        {/* Environment children */}
        {isExpanded && (
          <ul className="space-y-0.5">
            {/* Latest run */}
            {env.latestRun && (
              <li 
                className={`group pl-8 pr-2 py-1.5 cursor-pointer transition-colors flex items-center justify-between
                  ${isLatestSelected ? 'bg-accent/20 border-l-2 border-accent' : 'hover:bg-surface-hover/50'}`}
                onClick={() => {
                  selectRun(env.latestRun!.runId);
                  navigate('summary');
                }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getStatusDot(env.latestRun.status || '')}`}></span>
                  <span className="text-sm font-medium text-text">Latest</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fail/20 rounded transition-opacity text-text-muted hover:text-fail"
                  onClick={(e) => handleDelete(e, env.latestRun!.runId)}
                  title="Delete run"
                >
                  <TrashIcon />
                </button>
              </li>
            )}
            
            {/* History folder */}
            {env.history.length > 0 && (
              <li>
                <div 
                  className="flex items-center gap-1 pl-8 pr-2 py-1.5 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                  onClick={() => toggleExpanded(historyKey)}
                >
                  <span className="text-text-muted w-4 flex justify-center">
                    {isHistoryExpanded ? <ChevronDown /> : <ChevronRight />}
                  </span>
                  <span className="text-text-muted"><HistoryIcon /></span>
                  <span className="text-sm text-text-muted">History</span>
                  <span className="text-xs text-text-muted ml-auto">({env.history.length})</span>
                </div>
                
                {/* History runs */}
                {isHistoryExpanded && (
                  <ul className="space-y-0.5">
                    {env.history.map(run => renderHistoryRun(run, project, env.name))}
                  </ul>
                )}
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  // Render project node
  const renderProject = (project: ProjectNode) => {
    const isExpanded = expandedItems.has(project.name);
    
    return (
      <li key={project.name}>
        {/* Project header */}
        <div 
          className="flex items-center gap-1 px-2 py-2 cursor-pointer hover:bg-surface-hover/50 transition-colors"
          onClick={() => toggleExpanded(project.name)}
        >
          <span className="text-text-muted w-4 flex justify-center">
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </span>
          <span className="text-accent"><ProjectIcon /></span>
          <span className="text-sm font-medium text-text">{project.name}</span>
        </div>
        
        {/* Project environments */}
        {isExpanded && (
          <ul className="space-y-0.5">
            {project.environments.map(env => renderEnvironment(env, project.name))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside 
      className="bg-surface border-r border-border flex flex-col overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🍵</span>
          <h1 className="text-base font-semibold text-text">LiveDoc</h1>
        </div>
        <button 
          className="p-1.5 bg-surface-hover border border-border rounded hover:bg-bg transition-colors text-sm"
          title="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-text-muted border-b border-border/50">
        <span className={`w-1.5 h-1.5 rounded-full ${connectionColors[connectionStatus]}`}></span>
        <span>{connectionLabels[connectionStatus]}</span>
      </div>

      {/* Project Tree */}
      <div className="flex-1 overflow-auto p-2">
        {projectHierarchy.length > 0 ? (
          <ul className="space-y-0.5">
            {projectHierarchy.map(project => renderProject(project))}
          </ul>
        ) : runs.length > 0 ? (
          // Fallback to flat list if hierarchy not loaded
          <ul className="space-y-0.5">
            {runs.map((run) => (
              <li 
                key={run.runId}
                className={`px-3 py-2.5 rounded-md cursor-pointer transition-colors
                  ${run.runId === selectedRunId ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'}`}
                onClick={() => {
                  selectRun(run.runId);
                  navigate('summary');
                }}
              >
                <div className="text-sm font-medium text-text mb-0.5">{run.project || 'Unknown Project'}</div>
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span className={`w-2 h-2 rounded-full ${getStatusDot(run.status || '')}`}></span>
                  <span>{run.environment || 'default'}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-text-muted py-8 text-sm">
            No projects
          </div>
        )}
      </div>
    </aside>
  );
}

function getStatusDot(status: string): string {
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
      return 'bg-text-muted';
  }
}
