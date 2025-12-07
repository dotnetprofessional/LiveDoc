import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { setConnectionStatus, addRun, setRuns, updateFeature, selectRun, navigate, setProjectHierarchy, removeRun } = useStore();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    setConnectionStatus('connecting');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      
      // Clear any pending reconnect
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
      
      // Reconnect after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };
  }, [setConnectionStatus]);

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'runs':
        // Initial list of runs
        setRuns(message.data || []);
        if (message.data?.length > 0) {
          selectRun(message.data[0].runId);
        }
        break;
        
      case 'runStart':
      case 'run:started':
        // New run started - refresh hierarchy
        fetchProjectHierarchy();
        break;
        
      case 'run:completed':
        // Run completed - refresh hierarchy
        fetchProjectHierarchy();
        break;
        
      case 'run:deleted':
        // Run deleted
        if (message.runId) {
          removeRun(message.runId);
          fetchProjectHierarchy();
        }
        break;
        
      case 'feature':
        // Feature update
        if (message.data) {
          updateFeature(message.projectId, message.data);
        }
        break;
        
      case 'scenario':
        // Scenario update (real-time)
        // Handle individual scenario updates for live progress
        break;
        
      case 'runComplete':
        // Run completed - could trigger final state refresh
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }, [setRuns, addRun, updateFeature, selectRun, removeRun]);

  // Fetch project hierarchy for navigation
  const fetchProjectHierarchy = useCallback(async () => {
    try {
      const response = await fetch('/api/hierarchy');
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.projects) {
        // Transform the API data to match our store structure
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
      // Fetch project hierarchy first
      await fetchProjectHierarchy();
      
      // Then get the list of runs
      const runsListResponse = await fetch('/api/runs');
      if (!runsListResponse.ok) return;
      
      const runsList = await runsListResponse.json();
      if (!runsList || runsList.length === 0) {
        setRuns([]);
        return;
      }
      
      // Fetch full details for each run
      const fullRuns = await Promise.all(
        runsList.map(async (run: any) => {
          try {
            const response = await fetch(`/api/runs/${run.runId}`);
            if (response.ok) {
              const fullRun = await response.json();
              // Transform the data to match our store structure
              return transformRunData(fullRun);
            }
          } catch (e) {
            console.error(`Failed to fetch run ${run.runId}:`, e);
          }
          return null;
        })
      );
      
      const validRuns = fullRuns.filter(Boolean);
      setRuns(validRuns);
      
      if (validRuns.length > 0) {
        selectRun(validRuns[0].runId);
      }
    } catch (error) {
      console.error('Failed to fetch initial runs:', error);
    }
  }, [setRuns, selectRun, fetchProjectHierarchy]);

  // Transform API response to match our store structure
  function transformRunData(apiRun: any): any {
    // The API stores features at the run level
    const features = (apiRun.features || []).map((feature: any) => ({
      id: feature.id,
      title: feature.title || feature.displayTitle,
      description: feature.description || feature.rawDescription,
      filename: feature.filename || feature.file,
      status: mapStatus(feature.status),
      duration: feature.duration,
      tags: feature.tags,
      background: feature.background ? {
        id: feature.background.id || 'background',
        title: feature.background.title || 'Background',
        description: feature.background.description,
        steps: (feature.background.steps || []).map(mapStep),
      } : undefined,
      scenarios: (feature.scenarios || []).map((scenario: any) => ({
        id: scenario.id,
        title: scenario.title || scenario.displayTitle,
        description: scenario.description,
        type: scenario.type || 'Scenario',
        status: mapStatus(scenario.status),
        duration: scenario.duration,
        steps: (scenario.steps || []).map(mapStep),
        tags: scenario.tags,
        outlineId: scenario.outlineId,
        exampleValues: scenario.exampleValues,
        exampleIndex: scenario.exampleIndex,
      })),
    }));

    return {
      runId: apiRun.runId,
      project: apiRun.project || 'Test Results',
      environment: apiRun.environment || 'default',
      framework: apiRun.framework || 'vitest',
      timestamp: new Date(apiRun.timestamp).getTime(),
      status: apiRun.status || 'completed',
      duration: apiRun.duration,
      summary: apiRun.summary,
      features, // Store features directly on run
      projects: [], // Keep empty for backwards compatibility
    };
  }

  function mapStep(step: any) {
    return {
      type: step.type || step.keyword,
      title: step.rawTitle || step.title || step.displayTitle,
      status: mapStatus(step.status),
      duration: step.duration,
      docString: step.docString,
      dataTable: step.dataTable,
      error: step.error,
    };
  }

  function mapStatus(status: string | undefined): 'pass' | 'fail' | 'skip' | 'pending' {
    switch (status) {
      case 'passed':
      case 'pass':
        return 'pass';
      case 'failed':
      case 'fail':
        return 'fail';
      case 'skipped':
      case 'skip':
        return 'skip';
      default:
        return 'pending';
    }
  }

  useEffect(() => {
    // Fetch initial data
    fetchInitialData();
    
    // Connect to WebSocket
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

  // Return methods for sending messages if needed
  return {
    send: (data: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
  };
}
