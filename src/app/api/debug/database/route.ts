import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  let client;
  try {
    client = await connectToDatabase();
    
    // Check if the table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'message_logs'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    if (!tableExists) {
      return NextResponse.json({
        success: false,
        error: 'message_logs table does not exist',
        suggestion: 'Please create the table first'
      });
    }
    
    // Get table structure
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'message_logs' 
      ORDER BY ordinal_position;
    `);
    
    // Get row count
    const countResult = await client.query('SELECT COUNT(*) as total FROM message_logs');
    const totalMessages = parseInt(countResult.rows[0].total);
    
    // Get recent messages
    const recentMessages = await client.query(`
      SELECT * FROM message_logs 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    return NextResponse.json({
      success: true,
      table: {
        exists: tableExists,
        structure: tableStructure.rows,
        totalMessages,
        recentMessages: recentMessages.rows
      },
      debug: {
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
    
  } catch (error) {
    console.error('[Database Debug] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const { action } = await request.json();
    
    if (action === 'insert-test') {
      client = await connectToDatabase();
      
      const testMessage = {
        message_id: `test-${Date.now()}`,
        client_id: 'debug-client',
        type: 'received',
        channel: 'smartadmin-test',
        command: 'test-command',
        payload: JSON.stringify({ test: true, timestamp: Date.now() }),
        timestamp: new Date()
      };
      
      const insertQuery = `
        INSERT INTO message_logs (message_id, client_id, type, channel, command, payload, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      
      const values = [
        testMessage.message_id,
        testMessage.client_id,
        testMessage.type,
        testMessage.channel,
        testMessage.command,
        testMessage.payload,
        testMessage.timestamp
      ];
      
      const result = await client.query(insertQuery, values);
      
      return NextResponse.json({
        success: true,
        message: 'Test message inserted successfully',
        insertedRow: result.rows[0],
        rowCount: result.rowCount
      });
      
    } else if (action === 'clear-test') {
      client = await connectToDatabase();
      
      const deleteResult = await client.query(`
        DELETE FROM message_logs 
        WHERE client_id = 'debug-client' OR message_id LIKE 'test-%'
      `);
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deleteResult.rowCount} test messages`
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unknown action. Use "insert-test" or "clear-test"'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Database Debug] POST Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}