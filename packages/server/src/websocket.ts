import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { V1WebSocketEvent, WebSocketClientMessage } from './schema.js';

interface ClientSubscription {
  ws: WebSocket;
  runIds: Set<string>;
  projectFilters: Set<string>; // "project/environment"
}

/**
 * WebSocket manager for real-time updates
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    // Forward server-level errors (e.g. EADDRINUSE) so they don't crash
    // as unhandled 'error' events on the WebSocketServer instance.
    this.wss.on('error', () => {
      // Handled by the HTTP server's own error listener in createServer
    });
    
    this.wss.on('connection', (ws) => {
      console.log('🔌 WebSocket client connected');
      
      // Initialize client subscription
      this.clients.set(ws, {
        ws,
        runIds: new Set(),
        projectFilters: new Set()
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketClientMessage;
          this.handleClientMessage(ws, message);
        } catch (e) {
          console.error('Invalid WebSocket message:', e);
        }
      });
      
      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }
  
  private handleClientMessage(ws: WebSocket, message: WebSocketClientMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;
    
    switch (message.type) {
      case 'subscribe':
        if (message.runId) {
          client.runIds.add(message.runId);
        }
        if (message.project && message.environment) {
          client.projectFilters.add(`${message.project}/${message.environment}`);
        }
        // If no specific filter, subscribe to all
        if (!message.runId && !message.project) {
          client.projectFilters.add('*');
        }
        break;
        
      case 'unsubscribe':
        if (message.runId) {
          client.runIds.delete(message.runId);
        }
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }
  
  /**
   * Broadcast an event to all subscribed clients
   */
  broadcast(event: V1WebSocketEvent, runId: string, project?: string, environment?: string): void {
    const projectKey = project && environment ? `${project}/${environment}` : undefined;
    
    for (const [ws, client] of this.clients.entries()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      
      // Check if client is subscribed
      const isSubscribed = 
        client.runIds.has(runId) ||
        client.projectFilters.has('*') ||
        (projectKey && client.projectFilters.has(projectKey));
      
      if (isSubscribed) {
        ws.send(JSON.stringify(event));
      }
    }
  }
  
  /**
   * Get count of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Close all connections
   */
  close(): void {
    for (const ws of this.clients.keys()) {
      ws.close();
    }
    this.clients.clear();
    this.wss.close();
  }
}
