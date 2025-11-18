import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  let client;
  try {
    const { messageId, clientId, type, channel, command, payload, timestamp } = await request.json();
    
    console.log(`[Message Logger] Logging ${type} message for ${clientId}: ${command}`);
    
    client = await connectToDatabase();
    
    // Insert message log entry
    const insertQuery = `
      INSERT INTO message_logs (message_id, client_id, type, channel, command, payload, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    
    const values = [
      messageId,
      clientId,
      type, // 'sent' or 'received'
      channel,
      command,
      payload,
      new Date(timestamp)
    ];
    
    const result = await client.query(insertQuery, values);
    const logId = result.rows[0].id;
    
    console.log(`[Message Logger] ✓ Message logged with ID: ${logId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Message logged successfully',
      id: logId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Message Logger] Error:', errorMessage);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
  }
}

export async function GET(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000); // Cap at 1000
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log(`[Message Logger] Fetching messages for client: ${clientId}, limit: ${limit}`);
    
    client = await connectToDatabase();
    
    // Build SQL query
    let query = 'SELECT * FROM message_logs';
    const conditions = [];
    const values = [];
    let paramCount = 0;
    
    if (clientId && clientId !== 'all') {
      conditions.push(`client_id = $${++paramCount}`);
      values.push(clientId);
    }
    
    if (startDate) {
      conditions.push(`timestamp >= $${++paramCount}`);
      values.push(new Date(startDate));
    }
    
    if (endDate) {
      conditions.push(`timestamp < $${++paramCount}`);
      values.push(new Date(endDate));
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC LIMIT $' + (++paramCount);
    values.push(limit);
    
    console.log(`[Message Logger] Query:`, query, 'Values:', values);
    
    const result = await client.query(query, values);
    const messages = result.rows;
    
    // Transform snake_case to camelCase for compatibility
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      messageId: msg.message_id,
      clientId: msg.client_id,
      type: msg.type,
      channel: msg.channel,
      command: msg.command,
      payload: msg.payload,
      timestamp: msg.timestamp.toISOString(),
      createdAt: msg.created_at.toISOString()
    }));
    
    console.log(`[Message Logger] ✓ Found ${messages.length} messages`);
    
    return NextResponse.json({ 
      success: true, 
      data: transformedMessages,
      count: messages.length,
      query: { conditions, values } // Include query for debugging
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Message Logger] Error:', errorMessage);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
  }
}