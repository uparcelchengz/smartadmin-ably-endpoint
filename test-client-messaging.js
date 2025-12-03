// Test sending messages to your Electron client
const API_BASE = 'http://localhost:3001/api';

async function testClientMessaging() {
  console.log('=== Testing Client Message Reception ===');
  
  try {
    // Test 1: Send a notification to your client
    console.log('1. Sending notification to client...');
    const notificationResponse = await fetch(`${API_BASE}/task-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test notification from SmartAdmin Dashboard! 🚀',
        notificationType: 'test-message',
        targetChannel: 'smartadmin-control-broadcast' // Your client listens to this
      })
    });
    
    const notificationResult = await notificationResponse.json();
    console.log('Notification sent:', notificationResult);
    
    // Test 2: Send a ping command
    console.log('\n2. Sending ping command...');
    const pingResponse = await fetch(`${API_BASE}/task-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: JSON.stringify({
          command: 'ping',
          payload: { timestamp: Date.now() }
        }),
        notificationType: 'command',
        targetChannel: 'smartadmin-control-broadcast'
      })
    });
    
    const pingResult = await pingResponse.json();
    console.log('Ping command sent:', pingResult);
    
    // Test 3: Send status request
    console.log('\n3. Sending status request...');
    const statusResponse = await fetch(`${API_BASE}/task-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: JSON.stringify({
          command: 'getstatus',
          payload: {}
        }),
        notificationType: 'command',
        targetChannel: 'smartadmin-control-broadcast'
      })
    });
    
    const statusResult = await statusResponse.json();
    console.log('Status request sent:', statusResult);
    
    console.log('\n✅ All test messages sent successfully!');
    console.log('Check your Electron client logs to see if messages were received.');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testClientMessaging();