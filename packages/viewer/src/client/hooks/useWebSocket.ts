import { useEffect, useRef, useCallback } from 'react';
import { useStore, Run } from '../store';
import { getApiBaseUrl, getWsBaseUrl } from '../config';
import { Node } from '@livedoc/schema';

// Transform API response to match our store structure
function transformRunData(apiRun: any): Run {
  const nodeMap: Record<string, Node> = {};
  
  const buildNodeMap = (nodes: Node[]) => {
    for (const node of nodes) {
      nodeMap[node.id] = node;
      if ((node as any).children) {
        buildNodeMap((node as any).children);
      }
      if ((node as any).examples) {
        buildNodeMap((node as any).examples);
      }

      // Feature.background is not part of children, but we still want it in the map.
      if ((node as any).background) {
        buildNodeMap([(node as any).background]);
      }
    }
  };

  const documents = apiRun.documents || apiRun.nodes || [];
  buildNodeMap(documents);

  return {
    runId: apiRun.runId,
    project: apiRun.project || 'Test Results',
    environment: apiRun.environment || 'default',
    framework: apiRun.framework || 'vitest',
    timestamp: new Date(apiRun.timestamp).getTime(),
    status: apiRun.status || 'pending',
    summary: apiRun.summary || apiRun.stats || { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
    duration: apiRun.duration || 0,
    documents,
    nodeMap
  };
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    setConnectionStatus, 
    setRuns, 
    addRun, 
    updateRun, 
    removeRun, 
    selectRun, 
    setProjectHierarchy,
    addOrUpdateNode
  } = useStore();

  const fetchRunById = useCallback(async (runId: string): Promise<Run | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/runs/${runId}`, {
        cache: 'no-store'
      });
      if (!response.ok) return null;
      const fullRun = await response.json();
      return transformRunData(fullRun);
    } catch (e) {
      console.error(`Failed to fetch run ${runId}:`, e);
      return null;
    }
  }, []);

  // Fetch project hierarchy for navigation
  const fetchProjectHierarchy = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/hierarchy`, {
        cache: 'no-store'
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.projects) {
        const hierarchy = data.projects.map((project: any) => ({
          name: project.name,
          environments: project.environments.map((env: any) => ({
            name: env.name,
            latestRun: env.latestRun ? transformRunData(env.latestRun) : undefined,
            historyCount: env.historyCount,
            history: env.history || [],
          })),
        }));
        setProjectHierarchy(hierarchy);
      }
    } catch (error) {
      console.error('Failed to fetch project hierarchy:', error);
    }
  }, [setProjectHierarchy]);

  // Fetch initial data via REST API
  const fetchInitialData = useCallback(async () => {
    try {
      await fetchProjectHierarchy();
      
      const runsListResponse = await fetch(`${getApiBaseUrl()}/api/runs`, {
        cache: 'no-store'
      });
      if (!runsListResponse.ok) return;
      
      const runsList = await runsListResponse.json();
      if (!runsList || runsList.length === 0) {
        setRuns([]);
        return;
      }
      
      const fullRuns = await Promise.all(
        runsList.map(async (run: any) => {
          return fetchRunById(run.runId);
        })
      );
      
      const validRuns = fullRuns.filter((r): r is Run => r !== null);
      setRuns(validRuns);
      
      if (validRuns.length > 0) {
        selectRun(validRuns[0].runId);
      }
    } catch (error) {
      console.error('Failed to fetch initial runs:', error);
    }
  }, [fetchProjectHierarchy, fetchRunById, selectRun, setRuns]);

  const handleRunCompleted = useCallback(async (runId: string) => {
    const full = await fetchRunById(runId);
    if (!full) return;

    const existing = useStore.getState().runs.some((r) => r.runId === runId);
    if (existing) {
      updateRun(runId, full);
    } else {
      addRun(full);
    }

    // Keep the Viewer on the latest run by default.
    selectRun(runId);
    fetchProjectHierarchy();
  }, [addRun, fetchProjectHierarchy, fetchRunById, selectRun, updateRun]);

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'run:started':
        addRun(transformRunData({
          runId: message.runId,
          project: message.project,
          environment: message.environment,
          framework: message.framework,
          timestamp: message.timestamp,
          status: 'running',
          summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
          duration: 0,
          documents: []
        }));
        if (message.runId) {
          selectRun(message.runId);
        }
        fetchProjectHierarchy();
        break;
        
      case 'run:completed':
        if (message.runId) {
          void handleRunCompleted(message.runId);
        }
        break;
        
      case 'run:updated':
        if (message.runId && message.patch) {
          updateRun(message.runId, message.patch);
        }
        break;

      case 'run:deleted':
        if (message.runId) {
          removeRun(message.runId);
          fetchProjectHierarchy();
        }
        break;
        
      case 'node:added':
        if (message.runId && message.node) {
          addOrUpdateNode(message.runId, message.parentId, message.node);
        }
        break;

      case 'node:updated':
        if (message.runId && message.nodeId && message.patch) {
          // For now, we'll just update the node in the map if it exists
          // A more robust solution would be to update it in the tree as well
          const run = useStore.getState().runs.find(r => r.runId === message.runId);
          if (run && run.nodeMap[message.nodeId]) {
            const updatedNode = { ...run.nodeMap[message.nodeId], ...message.patch };
            addOrUpdateNode(message.runId, undefined, updatedNode);
          }
        }
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [addOrUpdateNode, addRun, fetchProjectHierarchy, handleRunCompleted, removeRun, updateRun]);

  const connect = useCallback(() => {
    const wsUrl = `${getWsBaseUrl()}/ws`;
    
    setConnectionStatus('connecting');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');

      // Subscribe to all project/environment updates so we receive run events.
      // Without this, the server won't broadcast to this client.
      try {
        ws.send(JSON.stringify({ type: 'subscribe' }));
      } catch {
        // ignore
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };
  }, [setConnectionStatus, handleMessage]);

  useEffect(() => {
    fetchInitialData();
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, fetchInitialData]);

  return {
    send: (data: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
  };
}
