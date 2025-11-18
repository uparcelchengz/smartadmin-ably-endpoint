import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  let client;
  try {
    console.log('[Stats API] Loading message log statistics...');
    
    client = await connectToDatabase();
    
    // Get total count
    const totalResult = await client.query('SELECT COUNT(*) FROM message_logs');
    const totalCount = parseInt(totalResult.rows[0].count);
    
    // Get unique clients
    const clientsResult = await client.query(`
      SELECT DISTINCT client_id 
      FROM message_logs 
      ORDER BY client_id
    `);
    const uniqueClients = clientsResult.rows.map(row => row.client_id);
    
    // Get unique commands
    const commandsResult = await client.query(`
      SELECT DISTINCT command 
      FROM message_logs 
      ORDER BY command
    `);
    const uniqueCommands = commandsResult.rows.map(row => row.command);
    
    // Get recent activity (last 24 hours)
    const recentResult = await client.query(`
      SELECT COUNT(*) 
      FROM message_logs 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);
    const recentCount = parseInt(recentResult.rows[0].count);
    
    console.log(`[Stats API] ✓ Stats loaded - Total: ${totalCount}, Clients: ${uniqueClients.length}, Commands: ${uniqueCommands.length}`);
    
    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        uniqueClients,
        uniqueCommands,
        recentCount
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Stats API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}