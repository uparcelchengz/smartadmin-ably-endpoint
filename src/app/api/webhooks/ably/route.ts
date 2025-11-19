import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

interface AblyWebhookMessage {
  id?: string;
  name?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  let client;
  try {
    console.log('[Ably Webhook] ===== NEW WEBHOOK REQUEST =====');
    console.log('[Ably Webhook] Timestamp:', new Date().toISOString());
    
    // Log request headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('[Ably Webhook] Headers:', JSON.stringify(headers, null, 2));
    
    const body = await request.json();
    console.log('[Ably Webhook] Raw payload type:', typeof body);
    console.log('[Ably Webhook] Raw payload is array:', Array.isArray(body));
    console.log('[Ably Webhook] Raw payload:', JSON.stringify(body, null, 2));
    
    // Ably Integration Rules send data in a specific format
    // Let's handle both possible formats: direct array or enveloped format
    let messages = [];
    
    if (Array.isArray(body)) {
      console.log('[Ably Webhook] Processing as direct array format');
      messages = body;
    } else if (body.messages && Array.isArray(body.messages)) {
      console.log('[Ably Webhook] Processing as enveloped format with messages array');
      messages = body.messages;
    } else if (body.name && body.data) {
      console.log('[Ably Webhook] Processing as single message format');
      messages = [body];
    } else {
      console.log('[Ably Webhook] Unknown payload format, trying to extract messages');
      // Try to find messages in any nested structure
      const findMessages = (obj: unknown): unknown[] => {
        if (Array.isArray(obj)) return obj;
        if (obj && typeof obj === 'object') {
          const objRecord = obj as Record<string, unknown>;
          for (const key in objRecord) {
            if (key === 'messages' && Array.isArray(objRecord[key])) {
              return objRecord[key] as unknown[];
            }
            const found = findMessages(objRecord[key]);
            if (found.length > 0) return found;
          }
        }
        return [];
      };
      messages = findMessages(body);
      if (messages.length === 0 && body.name) {
        messages = [body]; // Fallback to treating the whole body as a message
      }
    }
    
    console.log(`[Ably Webhook] Found ${messages.length} messages to process`);
    
    client = await connectToDatabase();
    
    let processedCount = 0;
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      console.log(`[Ably Webhook] ===== PROCESSING MESSAGE ${i + 1}/${messages.length} =====`);
      console.log(`[Ably Webhook] Message structure:`, JSON.stringify(message, null, 2));
      
      const processed = await processAblyMessage(message, client);
      if (processed) processedCount++;
    }
    
    console.log(`[Ably Webhook] ===== WEBHOOK COMPLETE =====`);
    console.log(`[Ably Webhook] ✓ Processed ${processedCount} out of ${messages.length} messages`);
    
    return NextResponse.json({ 
      success: true, 
      processedMessages: processedCount,
      totalMessages: messages.length,
      debugInfo: {
        originalPayloadType: Array.isArray(body) ? 'array' : typeof body,
        hasMessagesProperty: !!(body.messages),
        messagesFound: messages.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[Ably Webhook] ===== ERROR =====');
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
    console.log(`[Ably Webhook] Processing individual message:`, JSON.stringify(message, null, 2));
    
    const { name: channelName, data: messageData, timestamp, id } = message;
    
    console.log(`[Ably Webhook] Extracted - Channel: ${channelName}, Data:`, messageData);
    
    if (!channelName) {
      console.log('[Ably Webhook] Skipping: Missing channel name');
      return false;
    }
    
    if (!messageData) {
      console.log('[Ably Webhook] Skipping: Missing message data');
      return false;
    }
    
    // Skip non-smartadmin channels
    if (!channelName.startsWith('smartadmin-')) {
      console.log(`[Ably Webhook] Skipping: Not a smartadmin channel (${channelName})`);
      return false;
    }
    
    let clientId: string;
    let type: 'sent' | 'received';
    let command: string;
    let payload: Record<string, unknown>;
    
    // Handle different message data structures
    if (channelName.includes('status')) {
      // Status update (received from client)
      clientId = (messageData as Record<string, unknown>).clientId as string || 
                (messageData as Record<string, unknown>).client_id as string || 'unknown';
      type = 'received';
      command = (messageData as Record<string, unknown>).type as string || 
               (messageData as Record<string, unknown>).command as string || 'status-update';
      payload = (messageData as Record<string, unknown>).data as Record<string, unknown> || 
               (messageData as Record<string, unknown>).payload as Record<string, unknown> || 
               messageData;
      
      console.log(`[Ably Webhook] Status message from client ${clientId}: ${command}`);
      
    } else if (channelName.includes('control')) {
      // Control command (sent to client)
      clientId = (messageData as Record<string, unknown>).targetClientId as string || 
                (messageData as Record<string, unknown>).target_client_id as string || 'broadcast';
      type = 'sent';
      command = (messageData as Record<string, unknown>).command as string || 
               (messageData as Record<string, unknown>).type as string || 'unknown';
      payload = (messageData as Record<string, unknown>).payload as Record<string, unknown> || 
               (messageData as Record<string, unknown>).data as Record<string, unknown> || 
               messageData;
      
      console.log(`[Ably Webhook] Control message to client ${clientId}: ${command}`);
      
    } else {
      // Generic smartadmin message - try to extract what we can
      clientId = (messageData as Record<string, unknown>).clientId as string || 
                (messageData as Record<string, unknown>).client_id as string || 
                (messageData as Record<string, unknown>).id as string || 'unknown';
      type = 'received';
      command = (messageData as Record<string, unknown>).command as string || 
               (messageData as Record<string, unknown>).type as string || 
               (messageData as Record<string, unknown>).action as string || 'message';
      payload = (messageData as Record<string, unknown>).payload as Record<string, unknown> || 
               (messageData as Record<string, unknown>).data as Record<string, unknown> || 
               messageData;
      
      console.log(`[Ably Webhook] Generic smartadmin message from ${clientId}: ${command}`);
    }
    
    console.log(`[Ably Webhook] Final processing - ClientId: ${clientId}, Command: ${command}, Type: ${type}`);
    
    if (!clientId || !command) {
      console.log(`[Ably Webhook] Skipping: Missing required fields (clientId: ${clientId}, command: ${command})`);
      return false;
    }
    
    const insertQuery = `
      INSERT INTO message_logs (message_id, client_id, type, channel, command, payload, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (message_id) DO NOTHING;
    `;
    
    const messageId = id || `webhook-${channelName}-${Date.now()}-${Math.random()}`;
    const values = [
      messageId,
      clientId,
      type,
      channelName,
      command,
      JSON.stringify(payload),
      new Date(timestamp || Date.now())
    ];
    
    console.log(`[Ably Webhook] Attempting to insert with values:`, values);
    
    const result = await client.query(insertQuery, values);
    
    if (result.rowCount > 0) {
      console.log(`[Ably Webhook] ✓ Successfully saved ${type} message: ${command} from ${clientId} (ID: ${messageId})`);
      return true;
    } else {
      console.log(`[Ably Webhook] ⚠ Message already exists or insert failed (ID: ${messageId})`);
      return false;
    }
    
  } catch (error) {
    console.error('[Ably Webhook] Error processing message:', error);
    console.error('[Ably Webhook] Message that failed:', JSON.stringify(message, null, 2));
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