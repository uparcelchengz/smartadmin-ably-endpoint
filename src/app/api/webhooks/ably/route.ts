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
    } else if (body.items && Array.isArray(body.items)) {
      console.log('[Ably Webhook] Processing as Ably webhook items format');
      // This is the correct format for Ably Integration Rules
      for (const item of body.items) {
        if (item.data && item.data.messages && Array.isArray(item.data.messages)) {
          const channelId = item.data.channelId;
          console.log(`[Ably Webhook] Found ${item.data.messages.length} messages from channel: ${channelId}`);
          
          // Add channel info to each message for processing
          const channelMessages = item.data.messages.map((msg: Record<string, unknown>) => ({
            ...msg,
            channelName: channelId, // Add the actual channel name
            webhookSource: item
          }));
          
          messages.push(...channelMessages);
        }
      }
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
    console.log(`[Ably Webhook] ===== PROCESSING MESSAGE =====`);
    console.log(`[Ably Webhook] Full message object:`, JSON.stringify(message, null, 2));
    
    // For Ably webhook format, the channel name is in channelName field we added
    const channelName = (message as Record<string, unknown>).channelName as string || message.name;
    const messageData = message.data;
    const timestamp = message.timestamp;
    const id = message.id;
    
    console.log(`[Ably Webhook] Extracted fields:`);
    console.log(`  - Channel: ${channelName}`);
    console.log(`  - Data:`, JSON.stringify(messageData, null, 2));
    console.log(`  - Timestamp: ${timestamp}`);
    console.log(`  - ID: ${id}`);
    
    if (!channelName) {
      console.log('[Ably Webhook] ❌ SKIPPED: Missing channel name');
      return false;
    }
    
    // More permissive channel filtering
    console.log(`[Ably Webhook] Channel check: "${channelName}" contains "smartadmin"?`, channelName.includes('smartadmin'));
    
    if (!channelName.includes('smartadmin')) {
      console.log(`[Ably Webhook] ❌ SKIPPED: Not a smartadmin channel (${channelName})`);
      return false;
    }
    
    // For Ably webhook messages, the actual data might be JSON string in the 'data' field
    let actualData: Record<string, unknown>;
    
    if (typeof messageData === 'string') {
      try {
        actualData = JSON.parse(messageData);
        console.log(`[Ably Webhook] Parsed JSON data:`, actualData);
      } catch {
        console.log(`[Ably Webhook] Failed to parse JSON data, using as-is`);
        actualData = { rawData: messageData };
      }
    } else if (messageData && typeof messageData === 'object') {
      actualData = messageData as Record<string, unknown>;
    } else {
      console.log('[Ably Webhook] ❌ SKIPPED: No usable message data');
      return false;
    }
    
    // Try multiple ways to extract client info
    let clientId: string = 'unknown';
    let type: 'sent' | 'received' = 'received';
    let command: string = 'unknown';
    let payload: Record<string, unknown> = {};
    
    console.log(`[Ably Webhook] Attempting to extract client info from:`, Object.keys(actualData));
    
    // Extract clientId - try multiple field names
    const possibleClientIds = [
      actualData.clientId,
      actualData.client_id,
      actualData.id,
      actualData.from,
      actualData.sender,
      (message as Record<string, unknown>).clientId  // Also check the message level
    ].filter(Boolean);
    
    if (possibleClientIds.length > 0) {
      clientId = String(possibleClientIds[0]);
    }
    
    // Extract command/type - try multiple field names
    const possibleCommands = [
      actualData.command,
      actualData.type,
      actualData.action,
      actualData.event,
      actualData.name,
      (message as Record<string, unknown>).name  // Also check the message level
    ].filter(Boolean);
    
    if (possibleCommands.length > 0) {
      command = String(possibleCommands[0]);
    }
    
    // Extract payload - try to get the most relevant data
    if (actualData.data && typeof actualData.data === 'object') {
      payload = actualData.data as Record<string, unknown>;
    } else if (actualData.payload && typeof actualData.payload === 'object') {
      payload = actualData.payload as Record<string, unknown>;
    } else {
      payload = actualData;
    }
    
    // Handle different channel types for better classification
    if (channelName.includes('status')) {
      type = 'received';
      if (command === 'unknown') command = 'status-update';
    } else if (channelName.includes('control')) {
      type = 'sent';
      // For control messages, try to get target client
      const targetIds = [
        actualData.targetClientId,
        actualData.target_client_id,
        actualData.to,
        actualData.recipient
      ].filter(Boolean);
      
      if (targetIds.length > 0) {
        clientId = String(targetIds[0]);
      }
    }
    
    console.log(`[Ably Webhook] Extracted values:`);
    console.log(`  - Client ID: "${clientId}"`);
    console.log(`  - Command: "${command}"`);
    console.log(`  - Type: "${type}"`);
    console.log(`  - Payload:`, JSON.stringify(payload, null, 2));
    
    // Save the message to database
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
    
    console.log(`[Ably Webhook] Attempting database insert with values:`, values);
    
    const result = await client.query(insertQuery, values);
    
    if (result.rowCount > 0) {
      console.log(`[Ably Webhook] ✅ Successfully saved ${type} message: ${command} from ${clientId} (ID: ${messageId})`);
      return true;
    } else {
      console.log(`[Ably Webhook] ⚠️ Message already exists or insert failed (ID: ${messageId})`);
      return false;
    }
    
  } catch (error) {
    console.error('[Ably Webhook] ❌ ERROR processing message:', error);
    console.error('[Ably Webhook] Failed message:', JSON.stringify(message, null, 2));
    console.error('[Ably Webhook] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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