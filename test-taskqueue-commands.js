// Test the updated taskqueue command system
const API_BASE = 'http://localhost:3001/api';

async function testTaskqueueCommand() {
  console.log('=== Testing Taskqueue Command System ===');
  
  try {
    // Test 1: Approve a task (should send taskqueue command)
    console.log('1. Getting available tasks...');
    const getResponse = await fetch(`${API_BASE}/task-queue`);
    const getResult = await getResponse.json();
    
    if (getResult.data && getResult.data.length > 0) {
      const taskToTest = getResult.data.find(task => task.status === 'pending') || getResult.data[0];
      console.log(`Found task: ${taskToTest.taskId} (status: ${taskToTest.status})`);
      
      // Test 2: Update task status (this should send taskqueue command)
      console.log('\n2. Updating task status to trigger taskqueue command...');
      const newStatus = taskToTest.status === 'approved' ? 'rejected' : 'approved';
      
      const updateResponse = await fetch(`${API_BASE}/task-queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskToTest.taskId,
          status: newStatus
        })
      });
      
      const updateResult = await updateResponse.json();
      console.log('✓ Task update result:', updateResult.success ? 'SUCCESS' : 'FAILED');
      if (updateResult.success) {
        console.log(`  Task ${taskToTest.taskId} status changed to: ${newStatus}`);
        console.log('  This should have sent a taskqueue command to your Electron client!');
      }
      
      // Test 3: Send custom taskqueue command
      console.log('\n3. Sending custom taskqueue command...');
      const customResponse = await fetch(`${API_BASE}/task-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskToTest.taskId,
          message: `Custom taskqueue message for task ${taskToTest.taskId.substring(0, 8)}`,
          notificationType: 'custom-update'
        })
      });
      
      const customResult = await customResponse.json();
      console.log('✓ Custom taskqueue command:', customResult.success ? 'SENT' : 'FAILED');
      
    } else {
      console.log('No tasks found. Creating a test task first...');
      
      const createResponse = await fetch(`${API_BASE}/task-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: '192.168.1.100',
          objectData: {
            action: 'test-taskqueue-command',
            description: 'Testing taskqueue command system'
          }
        })
      });
      
      const createResult = await createResponse.json();
      if (createResult.success) {
        console.log(`✓ Created test task: ${createResult.data.taskId}`);
        console.log('Run this test again to approve the task and trigger taskqueue command!');
      }
    }
    
    console.log('\n📋 What your Electron client should receive:');
    console.log('   • Command: "taskqueue" (not "notification")');
    console.log('   • Payload with task status updates and custom messages');
    console.log('   • Check client logs for "Message Received" with command: "taskqueue"');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Test using client-messaging API with taskqueue command
async function testClientTaskqueueCommand() {
  console.log('\n=== Testing Client Messaging with Taskqueue ===');
  
  try {
    const response = await fetch(`${API_BASE}/client-messaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'taskqueue',
        payload: {
          type: 'test-message',
          taskId: 'test-' + Date.now(),
          status: 'approved',
          message: 'This is a test taskqueue command from the dashboard!',
          timestamp: new Date().toISOString()
        }
      })
    });
    
    const result = await response.json();
    console.log('✓ Direct taskqueue command sent:', result.success ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('❌ Client messaging error:', error);
  }
}

// Run both tests
testTaskqueueCommand().then(() => testClientTaskqueueCommand());