// Test with actual task ID from database
const API_BASE = 'http://localhost:3001/api';

async function testWithRealTask() {
  console.log('=== Testing with Real Task ===');
  
  try {
    // First get all tasks to find a valid one
    console.log('1. Getting current tasks...');
    const getResponse = await fetch(`${API_BASE}/task-queue`);
    const getResult = await getResponse.json();
    console.log('Available tasks:', getResult.data);
    
    if (getResult.data && getResult.data.length > 0) {
      const firstTask = getResult.data[0];
      console.log(`2. Testing with task ID: ${firstTask.taskId}`);
      
      // Approve the task to trigger notification
      const updateResponse = await fetch(`${API_BASE}/task-queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: firstTask.taskId,
          status: 'approved'
        })
      });
      const updateResult = await updateResponse.json();
      console.log('Task update result:', updateResult);
      
      // Send custom notification
      console.log('3. Sending custom notification for the approved task...');
      const notifyResponse = await fetch(`${API_BASE}/task-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: firstTask.taskId,
          message: `Task ${firstTask.taskId.substring(0, 8)} has been approved! 🎉`,
          notificationType: 'task-approved'
        })
      });
      const notifyResult = await notifyResponse.json();
      console.log('Custom notification result:', notifyResult);
      
    } else {
      console.log('No tasks found in queue');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testWithRealTask();