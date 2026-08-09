import { Response } from 'express';
import { SSEEventType } from '../shared/types';
import logger from '../logging/logger';

// Track all connected SSE clients
const clients = new Map<string, Response>();
let clientCounter = 0;

export function addSSEClient(res: Response): string {
  const id = `client_${++clientCounter}_${Date.now()}`;
  clients.set(id, res);
  logger.debug(`SSE client connected: ${id} (total: ${clients.size})`);
  return id;
}

export function removeSSEClient(id: string): void {
  clients.delete(id);
  logger.debug(`SSE client disconnected: ${id} (total: ${clients.size})`);
}

export function emitSSE(type: SSEEventType, data: unknown): void {
  if (clients.size === 0) return;

  const payload = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });

  const message = `data: ${payload}\n\n`;
  const dead: string[] = [];

  for (const [id, res] of clients) {
    try {
      res.write(message);
    } catch {
      dead.push(id);
    }
  }

  dead.forEach(id => clients.delete(id));
}

// Heartbeat every 25 seconds to keep connections alive
setInterval(() => {
  emitSSE('heartbeat', { ts: Date.now(), clients: clients.size });
}, 25000);

export function getSSEClientCount(): number {
  return clients.size;
}
