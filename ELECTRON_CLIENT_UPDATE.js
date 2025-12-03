// Add this to your processAblyReceivedMessage function in your Electron client

// In your switch statement, add this new case:
case 'taskqueue':
    // Handle task queue updates
    const { type, taskId, status, message, data } = payload;
    
    log.app(`Task Queue Update - Type: ${type}, Task: ${taskId || 'N/A'}`);
    
    if (type === 'task-status-update') {
        log.app(`Task ${taskId} status changed to: ${status}`);
        
        // Show notification for task status changes
        showCustomNotification({
            title: `Task ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `Your task ${taskId?.substring(0, 8)} has been ${status}`,
            type: status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info'
        });
        
        // Log the task update
        await sendMessageLog(`Task ${taskId?.substring(0, 8)} ${status}`, {
            taskId,
            status,
            taskData: data
        });
        
    } else if (type === 'custom-update' || type === 'test-message') {
        // Handle custom task queue messages
        log.app(`Custom task message: ${message}`);
        
        if (message) {
            showCustomNotification({
                title: 'Task Update',
                body: message,
                type: 'info'
            });
        }
        
        await sendMessageLog(`Task queue message: ${message}`, {
            taskId,
            messageType: type
        });
    }
    
    break;

// This replaces your existing 'notification' case for task-related messages
// Keep the original 'notification' case for general OS notifications:

case 'notification':
    // Show OS notification (for general notifications, not task-related)
    showCustomNotification(payload);
    break;