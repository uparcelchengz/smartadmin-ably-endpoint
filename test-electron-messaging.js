// Test sending messages to your Electron client using the new API
const API_BASE = 'http://localhost:3001/api';

async function testClientMessaging() {
  console.log('=== Testing Electron Client Message Reception ===');
  
  try {
    // Test 1: Send a notification
    console.log('1. Sending notification to client...');
    const notificationResponse = await fetch(`${API_BASE}/client-messaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello from SmartAdmin Dashboard! 🚀 Your client should receive this notification.'
      })
    });
    
    const notificationResult = await notificationResponse.json();
    console.log('✓ Notification sent:', notificationResult);
    
    // Test 2: Send a ping command
    console.log('\n2. Sending ping command...');
    const pingResponse = await fetch(`${API_BASE}/client-messaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'ping',
        payload: { 
          timestamp: Date.now(),
          message: 'Ping from dashboard'
        }
      })
    });
    
    const pingResult = await pingResponse.json();
    console.log('✓ Ping command sent:', pingResult);
    
    // Test 3: Send status request
    console.log('\n3. Sending status request...');
    const statusResponse = await fetch(`${API_BASE}/client-messaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'getstatus',
        payload: {
          requestId: `status-req-${Date.now()}`
        }
      })
    });
    
    const statusResult = await statusResponse.json();
    console.log('✓ Status request sent:', statusResult);
    
    // Test 4: Send custom action command
    console.log('\n4. Sending custom action...');
    const actionResponse = await fetch(`${API_BASE}/client-messaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'execute-action',
        payload: {
          filename: 'test-script.js',
          parameters: {
            mode: 'development',
            debug: true
          }
        }
      })
    });
    
    const actionResult = await actionResponse.json();
    console.log('✓ Custom action sent:', actionResult);
    
    console.log('\n🎉 All test messages sent successfully!');
    console.log('\n📋 What to check in your Electron client:');
    console.log('   • Check client logs for "Message Received" entries');
    console.log('   • Look for OS notifications from the first test');
    console.log('   • Verify ping response in Ably status channel');
    console.log('   • Check if status data is returned');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testClientMessaging();