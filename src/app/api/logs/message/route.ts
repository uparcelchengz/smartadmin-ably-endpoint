import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { messageId, clientId, type, channel, command, payload, timestamp } = await request.json();
    
    console.log(`[Message Logger] Logging ${type} message for ${clientId}: ${command}`);
    
    const db = await connectToDatabase();
    
    // Create message log entry
    const messageLog = {
      messageId,
      clientId,
      type, // 'sent' or 'received'
      channel,
      command,
      payload,
      timestamp: new Date(timestamp),
      createdAt: new Date()
    };
    
    const result = await db.collection('message_logs').insertOne(messageLog);
    console.log(`[Message Logger] ✓ Message logged with ID: ${result.insertedId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Message logged successfully',
      id: result.insertedId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Message Logger] Error:', errorMessage);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000); // Cap at 1000
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log(`[Message Logger] Fetching messages for client: ${clientId}, limit: ${limit}`);
    
    const db = await connectToDatabase();
    
    // Build query
    const query: Record<string, unknown> = {};
    if (clientId && clientId !== 'all') {
      query.clientId = clientId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) (query.timestamp as Record<string, unknown>).$gte = new Date(startDate);
      if (endDate) (query.timestamp as Record<string, unknown>).$lt = new Date(endDate);
    }
    
    console.log(`[Message Logger] Query:`, JSON.stringify(query, null, 2));
    
    const messages = await db.collection('message_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    console.log(`[Message Logger] ✓ Found ${messages.length} messages`);
    
    return NextResponse.json({ 
      success: true, 
      data: messages,
      count: messages.length,
      query // Include query for debugging
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Message Logger] Error:', errorMessage);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}