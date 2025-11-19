import { NextRequest, NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  try {
    // Verify cron job authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('[Cron Job] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron Job] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Cron Job] Starting scheduled message sync...');
    
    // Call the background sync endpoint
    const response = await fetch(`${SITE_URL}/api/background/sync-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Sync endpoint returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[Cron Job] Message sync completed:', result);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      syncResult: result
    });
    
  } catch (error) {
    console.error('[Cron Job] Sync failed:', error);
    return NextResponse.json({ 
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST endpoint for manual trigger (with auth)
export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();
    
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    console.log('[Cron Job] Manual trigger requested...');
    
    // Call the background sync endpoint
    const response = await fetch(`${SITE_URL}/api/background/sync-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Manual sync triggered',
      timestamp: new Date().toISOString(),
      syncResult: result
    });
    
  } catch (error) {
    console.error('[Cron Job] Manual trigger failed:', error);
    return NextResponse.json({ 
      error: 'Manual trigger failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}