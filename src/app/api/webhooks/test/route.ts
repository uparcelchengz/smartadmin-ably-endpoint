import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[Webhook Test] Received request');
    
    // Get all headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Get the body
    const body = await request.json();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      headers,
      body,
      bodyType: typeof body,
      bodyIsArray: Array.isArray(body),
      bodyKeys: body && typeof body === 'object' ? Object.keys(body) : null
    };
    
    console.log('[Webhook Test] Complete payload:', JSON.stringify(debugInfo, null, 2));
    
    return NextResponse.json({
      success: true,
      message: 'Webhook test received successfully',
      debug: debugInfo
    });
    
  } catch (error) {
    console.error('[Webhook Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to parse webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webhook test endpoint - send POST requests here to debug webhook payloads',
    usage: 'This endpoint logs all incoming webhook data for debugging purposes'
  });
}