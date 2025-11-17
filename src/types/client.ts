export interface ClientData {
  clientId: string;
  clientIP: string;
  clientTimezone: string;
  hostname: string;
  platform: string;
  appVersion: string;
  startTime: string;
  lastSeen?: string;
  status?: 'online' | 'offline' | 'idle';
  uptime?: number;
  memory?: number;
}

export interface StatusUpdate {
  clientId: string;
  type: 'heartbeat' | 'pong' | 'status' | 'action-result' | 'error';
  data: any;
  timestamp: string;
}

export interface CommandPayload {
  command: 'ping' | 'get-status' | 'execute-action' | 'restart' | 'shutdown';
  payload?: any;
  targetClientId?: string;
}

export interface MessageLog {
  id: string;
  clientId: string;
  type: 'sent' | 'received';
  command?: string;
  data: any;
  timestamp: string;
}
