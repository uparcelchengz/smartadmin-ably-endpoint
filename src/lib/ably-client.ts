import * as Ably from 'ably';

let ablyInstance: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!ablyInstance) {
    ablyInstance = new Ably.Realtime({
      key: "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU",
      clientId: "smartadmin-dashboard",
      // Configure for better message retention
      transportParams: {
        remainPresentFor: 30000 // Stay present for 30 seconds after disconnect
      }
    });

    // Auto-log all messages to MongoDB for long-term storage
    setupAutoLogging();
  }
  return ablyInstance;
}

/**
 * Setup automatic logging of all Ably messages to MongoDB
 */
function setupAutoLogging() {
  if (!ablyInstance) return;

  // Log status updates (messages FROM clients)
  const statusChannel = ablyInstance.channels.get('smartadmin-status');
  statusChannel.subscribe('*', (message) => logMessageToMongoDB(message, 'smartadmin-status'));

  // Log control commands (messages TO clients) - use wildcard subscription
  const broadcastChannel = ablyInstance.channels.get('smartadmin-control-broadcast');
  broadcastChannel.subscribe('*', (message) => logMessageToMongoDB(message, 'smartadmin-control-broadcast'));
}

/**
 * Automatically log Ably messages to MongoDB for long-term persistence
 */
async function logMessageToMongoDB(message: Ably.Message, channelName: string) {
  try {
    // Use the provided channel name
    const isStatusMessage = channelName.includes('status');
    const messageData = message.data;
    
    // Determine message type and extract clientId
    let clientId: string;
    let type: 'sent' | 'received';
    let command: string;
    let payload: Record<string, unknown>;
    
    if (isStatusMessage) {
      // Status update (received from client)
      clientId = messageData.clientId;
      type = 'received';
      command = messageData.type;
      payload = messageData.data;
    } else {
      // Control command (sent to client)
      clientId = messageData.targetClientId || 'broadcast';
      type = 'sent';
      command = messageData.command;
      payload = messageData.payload || {};
    }

    await fetch('/api/logs/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: message.id || `auto-${Date.now()}`,
        clientId,
        type,
        channel: channelName,
        command,
        payload,
        timestamp: new Date(message.timestamp || Date.now())
      })
    });
  } catch (error) {
    console.error('[Auto-Logger] Failed to log message to MongoDB:', error);
  }
}

export function closeAblyClient() {
  if (ablyInstance) {
    ablyInstance.connection.close();
    ablyInstance = null;
  }
}
