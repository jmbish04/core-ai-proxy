// src/websocket.ts
// Hibernatable WebSocket Durable Object

import type { Env, WebSocketMessage } from './types';
import { WebSocketMessageSchema } from './types';
import { routeRequest } from './proxy/adapter';
import { executeTool } from './mcp/router';

/**
 * WebSocketDO - Hibernatable Durable Object for real-time communication
 *
 * Handles WebSocket connections for:
 * - AI Proxy streaming ({ type: 'proxy', payload: ChatCompletionRequest })
 * - MCP tool execution ({ type: 'mcp', payload: { tool, params } })
 * - A2A orchestration ({ type: 'a2a', payload: A2AMessage })
 */
export class WebSocketDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, string>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  /**
   * Handle HTTP requests (WebSocket upgrades)
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle a WebSocket session
   */
  async handleSession(ws: WebSocket, request: Request) {
    const sessionId = crypto.randomUUID();
    this.sessions.set(ws, sessionId);

    ws.accept();

    ws.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        const message = WebSocketMessageSchema.parse(data);

        await this.handleMessage(ws, message);
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Invalid message format',
          })
        );
      }
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
    });

    ws.addEventListener('error', () => {
      this.sessions.delete(ws);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws: WebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case 'proxy': {
        // Handle AI proxy request
        const response = await routeRequest(message.payload as never, this.env);

        if (response instanceof ReadableStream) {
          // Stream response chunks
          const reader = response.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            ws.send(decoder.decode(value));
          }
        } else {
          ws.send(JSON.stringify({ type: 'proxy', result: response }));
        }
        break;
      }

      case 'mcp': {
        // Handle MCP tool execution
        const { tool, params } = message.payload as { tool: string; params: unknown };
        const result = await executeTool(tool, params, this.env);

        ws.send(JSON.stringify({ type: 'mcp', result }));
        break;
      }

      case 'a2a': {
        // Handle A2A message - broadcast to other connected agents
        this.broadcast(message, ws);
        break;
      }

      case 'ping': {
        // Respond to ping
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  }

  /**
   * Broadcast a message to all connected clients except sender
   */
  broadcast(message: unknown, sender: WebSocket) {
    const messageStr = JSON.stringify(message);

    for (const [ws] of this.sessions) {
      if (ws !== sender && ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(messageStr);
      }
    }
  }
}