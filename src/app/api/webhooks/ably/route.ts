import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

interface AblyWebhookMessage {
  id?: string;
  data?: {
    clientId?: string;
    type?: string;
    command?: string;
    targetClientId?: string;
    payload?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  let client;
  try {
    console.log('[Ably Webhook] Received webhook from Ably');
    
    const body = await request.json();
    console.log('[Ably Webhook] Payload:', JSON.stringify(body, null, 2));
    
    // Ably sends an array of messages in webhooks
    const messages = Array.isArray(body) ? body : [body];
    
    client = await connectToDatabase();
    
    let processedCount = 0;
    for (const message of messages) {
      const processed = await processAblyMessage(message, client);
      if (processed) processedCount++;
    }
    
    console.log(`[Ably Webhook] ✓ Processed ${processedCount} messages`);
    return NextResponse.json({ 
      success: true, 
      processedMessages: processedCount,
      totalMessages: messages.length
    });
    
  } catch (error) {
    console.error('[Ably Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function processAblyMessage(message: AblyWebhookMessage, client: { query: (text: string, params: unknown[]) => Promise<{ rowCount: number }> }): Promise<boolean> {
  try {
    const { name: channelName, data: messageData, timestamp, id } = message;
    
    console.log(`[Ably Webhook] Processing message from channel: ${channelName}`);
    
    if (!channelName || !messageData) {
      console.log('[Ably Webhook] Skipping: Missing channel name or message data');
      return false;
    }
    
    // Skip non-smartadmin channels
    if (!channelName.startsWith('smartadmin-')) {
      console.log('[Ably Webhook] Skipping: Not a smartadmin channel');
      return false;
    }
    
    let clientId: string;
    let type: 'sent' | 'received';
    let command: string;
    let payload: Record<string, unknown>;
    
    if (channelName.includes('status')) {
      // Status update (received from client)
      clientId = messageData.clientId || 'unknown';
      type = 'received';
      command = messageData.type || 'status-update';
      payload = messageData.data || {};
      
      console.log(`[Ably Webhook] Status message from client ${clientId}: ${command}`);
      
    } else if (channelName.includes('control')) {
      // Control command (sent to client)
      clientId = messageData.targetClientId || 'broadcast';
      type = 'sent';
      command = messageData.command || 'unknown';
      payload = messageData.payload || {};
      
      console.log(`[Ably Webhook] Control message to client ${clientId}: ${command}`);
      
    } else {
      console.log(`[Ably Webhook] Skipping: Unknown channel type: ${channelName}`);
      return false;
    }
    
    if (!clientId || !command) {
      console.log('[Ably Webhook] Skipping: Missing clientId or command');
      return false;
    }
    
    const insertQuery = `
      INSERT INTO message_logs (message_id, client_id, type, channel, command, payload, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (message_id) DO NOTHING;
    `;
    
    const values = [
      id || `webhook-${channelName}-${Date.now()}-${Math.random()}`,
      clientId,
      type,
      channelName,
      command,
      JSON.stringify(payload),
      new Date(timestamp || Date.now())
    ];
    
    const result = await client.query(insertQuery, values);
    
    if (result.rowCount > 0) {
      console.log(`[Ably Webhook] ✓ Saved ${type} message: ${command} from ${clientId}`);
      return true;
    } else {
      console.log(`[Ably Webhook] ⚠ Message already exists (duplicate): ${id}`);
      return false;
    }
    
  } catch (error) {
    console.error('[Ably Webhook] Error processing message:', error);
    return false;
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}