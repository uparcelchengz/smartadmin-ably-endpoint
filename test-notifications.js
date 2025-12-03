// Test the Ably notification system
const API_BASE = 'http://localhost:3001/api';

async function testNotifications() {
  console.log('=== Testing Task Notifications ===');
  
  try {
    // Test approving a task to trigger notification
    console.log('1. Approving a task to trigger Ably notification...');
    const updateResponse = await fetch(`${API_BASE}/task-queue`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: '0d13d8d6-83c2-4a8c-a099-7e2e7a1856f4',
        status: 'approved'
      })
    });
    const updateResult = await updateResponse.json();
    console.log('Update result:', updateResult);
    
    // Test sending custom notification
    console.log('2. Sending custom notification...');
    const notifyResponse = await fetch(`${API_BASE}/task-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: '0d13d8d6-83c2-4a8c-a099-7e2e7a1856f4',
        message: 'Your task has been processed successfully! 🎉',
        notificationType: 'success-message'
      })
    });
    const notifyResult = await notifyResponse.json();
    console.log('Notification result:', notifyResult);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run test
testNotifications();