import { NextRequest, NextResponse } from 'next/server';
import * as Ably from 'ably';

// POST - Send general messages/commands to Electron clients
export async function POST(request: NextRequest) {
  try {
    const { 
      command, 
      payload = {}, 
      targetClientId, 
      targetChannel = 'smartadmin-control-broadcast',
      message
    } = await request.json();

    if (!command && !message) {
      return NextResponse.json({
        success: false,
        error: 'Command or message is required'
      }, { status: 400 });
    }

    const ably = new Ably.Rest({
      key: process.env.ABLY_API_KEY || "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU"
    });

    let messageData;
    
    if (command) {
      // Structured command
      messageData = {
        command,
        payload,
        targetClientId,
        timestamp: new Date().toISOString(),
        source: 'dashboard'
      };
    } else {
      // General message
      messageData = {
        command: 'notification',
        payload: {
          title: 'SmartAdmin Dashboard',
          body: message,
          type: 'info'
        },
        targetClientId,
        timestamp: new Date().toISOString(),
        source: 'dashboard'
      };
    }

    let messagesSent = 0;

    // Send to specific client if targetClientId provided
    if (targetClientId) {
      try {
        const clientChannel = ably.channels.get(`smartadmin-control-${targetClientId}`);
        await clientChannel.publish('command', messageData);
        messagesSent++;
        console.log(`[Client Messaging API] ✓ Sent to client: ${targetClientId}`);
      } catch (error) {
        console.warn(`[Client Messaging API] Failed to send to specific client:`, error);
      }
    }

    // Send to specified channel (broadcast by default)
    if (!targetClientId || targetChannel) {
      try {
        const channel = ably.channels.get(targetChannel);
        await channel.publish('command', messageData);
        messagesSent++;
        console.log(`[Client Messaging API] ✓ Sent to channel: ${targetChannel}`);
      } catch (error) {
        console.warn(`[Client Messaging API] Failed to send to channel:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
      messagesSent,
      targetChannel,
      targetClientId,
      command: command || 'notification'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Client Messaging API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}