import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import * as Ably from 'ably';

const ABLY_API_KEY = process.env.ABLY_API_KEY || "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU";

interface AblyMessage {
  id?: string;
  name?: string;
  data?: any;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  let dbClient;
  try {
    console.log('[Background Sync] Starting message synchronization...');
    
    const ably = new Ably.Rest({ key: ABLY_API_KEY });
    dbClient = await connectToDatabase();
    
    // Get last sync timestamp from database
    const lastSyncResult = await dbClient.query(
      'SELECT MAX(timestamp) as last_sync FROM message_logs'
    );
    const lastSync = lastSyncResult.rows[0]?.last_sync || new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log(`[Background Sync] Syncing messages since: ${lastSync}`);
    
    // Sync messages from all smartadmin channels
    const channels = [
      'smartadmin-status',
      'smartadmin-control-broadcast'
    ];
    
    let totalSynced = 0;
    let totalProcessed = 0;
    
    for (const channelName of channels) {
      const channel = ably.channels.get(channelName);
      
      try {
        console.log(`[Background Sync] Fetching history for ${channelName}...`);
        
        const history = await channel.history({ 
          start: lastSync.getTime(),
          limit: 1000 
        });
        
        console.log(`[Background Sync] Found ${history.items.length} messages in ${channelName}`);
        
        for (const message of history.items) {
          totalProcessed++;
          const synced = await processHistoricalMessage(message, channelName, dbClient);
          if (synced) totalSynced++;
        }
        
        console.log(`[Background Sync] Processed ${history.items.length} messages from ${channelName}`);
        
      } catch (error) {
        console.error(`[Background Sync] Error syncing ${channelName}:`, error);
      }
    }
    
    console.log(`[Background Sync] ✓ Completed. Synced ${totalSynced}/${totalProcessed} messages`);
    
    return NextResponse.json({ 
      success: true, 
      messagesSynced: totalSynced,
      messagesProcessed: totalProcessed,
      lastSync: lastSync.toISOString(),
      channels: channels
    });
    
  } catch (error) {
    console.error('[Background Sync] Error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
}

async function processHistoricalMessage(message: AblyMessage, channelName: string, client: any): Promise<boolean> {
  try {
    const { data: messageData, timestamp, id } = message;
    
    if (!channelName || !messageData) {
      return false;
    }
    
    // Skip non-smartadmin channels
    if (!channelName.startsWith('smartadmin-')) {
      return false;
    }
    
    let clientId: string;
    let type: 'sent' | 'received';
    let command: string;
    let payload: Record<string, unknown>;
    
    if (channelName.includes('status')) {
      // Status update (received from client)
      clientId = messageData.clientId;
      type = 'received';
      command = messageData.type || 'status-update';
      payload = messageData.data || {};
      
    } else if (channelName.includes('control')) {
      // Control command (sent to client)
      clientId = messageData.targetClientId || 'broadcast';
      type = 'sent';
      command = messageData.command;
      payload = messageData.payload || {};
      
    } else {
      return false;
    }
    
    if (!clientId || !command) {
      return false;
    }
    
    const insertQuery = `
      INSERT INTO message_logs (message_id, client_id, type, channel, command, payload, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (message_id) DO NOTHING;
    `;
    
    const values = [
      id || `sync-${channelName}-${Date.now()}-${Math.random()}`,
      clientId,
      type,
      channelName,
      command,
      JSON.stringify(payload),
      new Date(timestamp || Date.now())
    ];
    
    const result = await client.query(insertQuery, values);
    
    if (result.rowCount > 0) {
      console.log(`[Background Sync] ✓ Synced ${type} message: ${command} from ${clientId}`);
      return true;
    } else {
      // Message already exists
      return false;
    }
    
  } catch (error) {
    console.error('[Background Sync] Error processing historical message:', error);
    return false;
  }
}

// GET endpoint to check sync status
export async function GET() {
  try {
    const dbClient = await connectToDatabase();
    
    const result = await dbClient.query(`
      SELECT 
        COUNT(*) as total_messages,
        MAX(timestamp) as last_message,
        MIN(timestamp) as first_message
      FROM message_logs
    `);
    
    const stats = result.rows[0];
    
    dbClient.release();
    
    return NextResponse.json({
      success: true,
      stats: {
        totalMessages: parseInt(stats.total_messages),
        lastMessage: stats.last_message,
        firstMessage: stats.first_message
      }
    });
    
  } catch (error) {
    console.error('[Background Sync] Error getting stats:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}