import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    const webhookUrl = `${baseUrl}/api/webhooks/ably`;
    
    const integrationConfig = {
      rule: 'Webhook',
      service: 'Webhook',
      url: webhookUrl,
      requestMode: 'batch', // Better performance for multiple messages
      source: 'message', // Message Integration
      channelFilter: '^smartadmin.*', // Regex to match smartadmin channels
      encoding: 'json',
      enveloped: true // Include metadata
    };
    
    const setupInstructions = `Ably Integration Rule Setup Instructions:

1. Go to Ably Dashboard (https://ably.com/dashboard)
2. Navigate to: Your App → Integrations → Integration Rules
3. Click "New Integration Rule"
4. Configure as follows:

   Rule: Webhook
   Integration Service: Webhook
   
   Settings:
   - URL: ${webhookUrl}
   - Request Mode: Batch request (recommended)
   
   Source:
   - Type: Message Integration
   - Channel Filter: ^smartadmin.*
   
   Encoding: JSON
   ✓ Enveloped (keep checked)

5. Click "Create" to save the integration rule
6. Test by publishing messages to any channel starting with "smartadmin"`;

    return NextResponse.json({
      success: true,
      config: integrationConfig,
      instructions: setupInstructions,
      endpoints: {
        webhook: `${baseUrl}/api/webhooks/ably`,
        backgroundSync: `${baseUrl}/api/background/sync-messages`,
        cronJob: `${baseUrl}/api/cron/sync-messages`,
        setup: `${baseUrl}/api/webhooks/setup`,
      },
      notes: [
        'This creates an Integration Rule that sends data FROM Ably TO your application',
        'Messages published to smartadmin-* channels will trigger webhook calls',
        'Use batch mode for better performance with multiple messages',
        'The webhook URL must be publicly accessible (not localhost for production)',
      ]
    });
  } catch (error) {
    console.error('[Webhook Setup] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate setup configuration' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (action === 'test-webhook') {
      // Simulate a webhook call for testing
      const testPayload = {
        name: 'smartadmin-status',
        messages: [{
          id: `test-${Date.now()}`,
          timestamp: Date.now(),
          data: {
            clientId: 'test-client',
            type: 'status',
            data: { status: 'online', version: '1.0.0' }
          }
        }]
      };

      // Call our own webhook endpoint
      const response = await fetch(`${baseUrl}/api/webhooks/ably`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      const result = await response.json();

      return NextResponse.json({
        success: response.ok,
        testResult: result,
        message: response.ok ? 'Webhook test successful' : 'Webhook test failed'
      });
      
    } else if (action === 'trigger-sync') {
      // Trigger background sync
      const response = await fetch(`${baseUrl}/api/background/sync-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      return NextResponse.json({
        success: true,
        syncResult: result,
        message: 'Background sync triggered'
      });
      
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Webhook Setup] Action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}