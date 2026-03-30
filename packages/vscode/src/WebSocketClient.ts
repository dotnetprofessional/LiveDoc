import * as vscode from 'vscode';
import WebSocket from 'ws';
import type { V1WebSocketEvent, WebSocketClientMessage } from '@swedevtools/livedoc-server';

export class LiveDocWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private url: string;
  private onEventCallback: ((event: V1WebSocketEvent) => void) | null = null;
  private isDisposed = false;
  private outputChannel: vscode.OutputChannel;

  constructor(url: string, outputChannel: vscode.OutputChannel) {
    this.url = url;
    this.outputChannel = outputChannel;
  }

  public connect() {
    if (this.isDisposed) return;

    try {
      this.outputChannel.appendLine(`[WebSocket] Connecting to ${this.url}...`);
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.outputChannel.appendLine('[WebSocket] Connected');
        this.send({ type: 'subscribe' });
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = data.toString();
          const event = JSON.parse(message) as V1WebSocketEvent;
          if (this.onEventCallback) {
            this.onEventCallback(event);
          }
        } catch (e) {
          this.outputChannel.appendLine(`[WebSocket] Error parsing message: ${e}`);
        }
      });

      this.ws.on('close', () => {
        this.outputChannel.appendLine('[WebSocket] Disconnected');
        this.ws = null;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        this.outputChannel.appendLine(`[WebSocket] Error: ${err.message}`);
        // Close will be called after error
      });

    } catch (e) {
      this.outputChannel.appendLine(`[WebSocket] Connection error: ${e}`);
      this.scheduleReconnect();
    }
  }

  public onEvent(callback: (event: V1WebSocketEvent) => void) {
    this.onEventCallback = callback;
  }

  public send(message: WebSocketClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public dispose() {
    this.isDisposed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDisposed) return;
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000); // Retry every 3 seconds
  }
}
