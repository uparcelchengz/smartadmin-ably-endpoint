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
  type: 'heartbeat' | 'pong' | 'status' | 'action-result' | 'error' | 'disconnecting' | 'message-log'; // Added 'message-log'
  data: Record<string, unknown> | MessageLogData;
  timestamp: string;
}

export interface CommandPayload {
  command: 'ping' | 'get-status' | 'execute-action' | 'restart' | 'shutdown';
  payload?: Record<string, unknown> | string | number | boolean | null;
  targetClientId?: string;
}

export interface MessageLog {
  id: string;
  clientId: string;
  type: 'sent' | 'received';
  command?: string;
  data: Record<string, unknown> | MessageLogData;
  timestamp: string;
}

// New interface for message log data structure
export interface MessageLogData {
  clientId: string;
  clientIP: string;
  clientTimezone: string;
  message: string;
  [key: string]: unknown; // For additional data
}
