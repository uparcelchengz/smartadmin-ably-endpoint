import { NextRequest, NextResponse } from 'next/server';
import * as Ably from 'ably';

// POST - Send task notification to client via Ably
export async function POST(request: NextRequest) {
  try {
    const { taskId, clientIdentifier, message, notificationType = 'task-update' } = await request.json();

    if (!taskId || !message) {
      return NextResponse.json({
        success: false,
        error: 'Task ID and message are required'
      }, { status: 400 });
    }

    const ably = new Ably.Rest({
      key: process.env.ABLY_API_KEY || "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU"
    });

    const notification = {
      command: 'taskqueue',
      payload: {
        type: notificationType,
        taskId,
        message,
        timestamp: new Date().toISOString(),
        source: 'dashboard'
      },
      targetClientId: clientIdentifier
    };

    let notificationsSent = 0;

    // If we have a specific client identifier, try to send directly
    if (clientIdentifier) {
      try {
        const clientChannel = ably.channels.get(`smartadmin-control-${clientIdentifier}`);
        await clientChannel.publish('command', notification);
        notificationsSent++;
        console.log(`[Task Notification API] ✓ Sent taskqueue command to client: ${clientIdentifier}`);
      } catch (error) {
        console.warn(`[Task Notification API] Failed to send to specific client:`, error);
      }
    }

    // Always send to broadcast channel as fallback
    const broadcastChannel = ably.channels.get('smartadmin-control-broadcast');
    await broadcastChannel.publish('command', notification);
    notificationsSent++;

    console.log(`[Task Notification API] ✓ Task notification sent for ${taskId}`);

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      notificationsSent,
      taskId
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Notification API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}