import * as Ably from 'ably';

let ablyInstance: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!ablyInstance) {
    console.log('[Ably Client] 🔌 Initializing new Ably client...');
    ablyInstance = new Ably.Realtime({
      key: "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU",
      clientId: "smartadmin-dashboard",
      // Configure for better message retention
      transportParams: {
        remainPresentFor: 30000 // Stay present for 30 seconds after disconnect
      }
    });

    console.log('[Ably Client] 🔧 Setting up auto-logging...');
    // Auto-log all messages to PostgreSQL for long-term storage
    setupAutoLogging();
    console.log('[Ably Client] ✅ Ably client initialized successfully');
  } else {
    console.log('[Ably Client] ♻️ Reusing existing Ably client instance');
  }
  return ablyInstance;
}

/**
 * Setup automatic logging of all Ably messages to PostgreSQL
 */
function setupAutoLogging() {
  if (!ablyInstance) {
    console.log('[Auto-Logger] ❌ No Ably instance available for auto-logging');
    return;
  }

  console.log('[Auto-Logger] 🚀 Setting up auto-logging for Ably channels...');

  // Log status updates (messages FROM clients)
  const statusChannel = ablyInstance.channels.get('smartadmin-status');
  statusChannel.subscribe('*', (message) => {
    console.log('[Auto-Logger] 📩 Status message received:', message.data?.type, 'from', message.data?.clientId);
    logMessageToPostgreSQL(message, 'smartadmin-status');
  });

  // Log control commands (messages TO clients) - use wildcard subscription
  const broadcastChannel = ablyInstance.channels.get('smartadmin-control-broadcast');
  broadcastChannel.subscribe('*', (message) => {
    console.log('[Auto-Logger] 📤 Control message received:', message.data?.command);
    logMessageToPostgreSQL(message, 'smartadmin-control-broadcast');
  });

  console.log('[Auto-Logger] ✅ Auto-logging setup complete');
}

/**
 * Automatically log Ably messages to PostgreSQL for long-term persistence
 */
async function logMessageToPostgreSQL(message: Ably.Message, channelName: string) {
  try {
    console.log('[Auto-Logger] 🔄 Processing message for logging:', {
      messageId: message.id,
      channelName,
      messageType: message.data?.type || message.data?.command,
      timestamp: message.timestamp
    });

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
      command = messageData.type; // This could be 'message-log', 'heartbeat', etc.
      payload = messageData.data;
      
      // Special handling for message-log type
      if (command === 'message-log') {
        console.log('[Auto-Logger] 📝 Processing message-log from client:', clientId);
        payload = {
          ...messageData.data,
          originalMessage: messageData.data.message,
          loggedAt: new Date().toISOString()
        };
      }
    } else {
      // Control command (sent to client)
      clientId = messageData.targetClientId || 'broadcast';
      type = 'sent';
      command = messageData.command;
      payload = messageData.payload || {};
    }

    const logData = {
      messageId: message.id || `auto-${Date.now()}`,
      clientId,
      type,
      channel: channelName,
      command,
      payload,
      timestamp: new Date(message.timestamp || Date.now())
    };

    console.log('[Auto-Logger] 🌐 Sending to API:', logData);

    const response = await fetch('/api/logs/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Auto-Logger] ✅ Successfully logged to PostgreSQL:', result);
    
    if (command === 'message-log') {
      console.log('[Auto-Logger] ✅ Message-log from client stored to PostgreSQL');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auto-Logger] ❌ Failed to log message to PostgreSQL:', errorMessage);
    if (error instanceof Error) {
      console.error('[Auto-Logger] Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
  }
}

export function closeAblyClient() {
  if (ablyInstance) {
    ablyInstance.connection.close();
    ablyInstance = null;
  }
}
