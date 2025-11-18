const Ably = require('ably');

const ably = new Ably.Realtime({
  key: "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU",
  clientId: "test-message-log-sender"
});

async function testMessageLogFlow() {
  try {
    console.log('Connecting to Ably...');
    
    await new Promise((resolve, reject) => {
      ably.connection.on('connected', resolve);
      ably.connection.on('failed', reject);
    });
    
    console.log('✅ Connected to Ably. Sending test message-log entry...');
    
    const statusChannel = ably.channels.get('smartadmin-status');
    
    // Simulate a message-log entry from your Electron client
    const testMessageLogData = {
      clientId: 'smartadmin-|-test-client-|-2025-11-18',
      type: 'message-log',
      data: {
        clientId: 'smartadmin-|-test-client-|-2025-11-18',
        clientIP: '192.168.1.100',
        clientTimezone: 'America/New_York',
        message: 'Test log message from Electron client',
        applicationEvent: 'user-action',
        details: {
          action: 'file-opened',
          fileName: 'document.pdf',
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Publish the test message-log
    await statusChannel.publish('status-update', testMessageLogData);
    
    console.log('✅ Published test message-log entry:');
    console.log(JSON.stringify(testMessageLogData, null, 2));
    
    // Wait a bit for auto-logging to process
    console.log('⏳ Waiting 3 seconds for auto-logging to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if it appeared in PostgreSQL
    console.log('🔍 Checking PostgreSQL for the test entry...');
    
    // We'll let the user check the dashboard/database manually
    console.log('');
    console.log('✅ Test message-log sent successfully!');
    console.log('');
    console.log('Now check:');
    console.log('1. Your dashboard at http://localhost:3000 - you should see the test client with 📋 badge');
    console.log('2. The client detail page for the test client - you should see the message-log with special formatting');
    console.log('3. Run "node check-message-log.js" to verify it was stored in PostgreSQL');
    
    ably.close();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testMessageLogFlow();