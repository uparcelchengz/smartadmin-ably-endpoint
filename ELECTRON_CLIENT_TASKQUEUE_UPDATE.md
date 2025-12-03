/**
 * UPDATE YOUR ELECTRON CLIENT'S processAblyReceivedMessage FUNCTION
 * 
 * Add the 'taskqueue' case to your switch statement in the processAblyReceivedMessage function.
 * This replaces task-related 'notification' commands with 'taskqueue' commands.
 */

// Your existing processAblyReceivedMessage function should look like this:
async function processAblyReceivedMessage(message) {
    log.app("Message Received:", JSON.stringify(message.data, null, 2));
    
    const { command, payload, targetClientId } = message.data;
    
    // If targetClientId is specified and doesn't match this client, ignore
    if (targetClientId && targetClientId !== clientId) {
        return;
    }
    
    try {
        switch (command) {
            case 'ping':
                await sendStatusUpdate('pong', { timestamp: Date.now() });
                break;
                
            case 'getstatus':
                await sendStatusUpdate('status', await getClientStatus());
                break;
            
            case 'notification':
                // Show OS notification (for general notifications, not task-related)
                showCustomNotification(payload);
                break;

            // NEW CASE - Add this to handle task queue updates
            case 'taskqueue':
                // Handle task queue updates
                const { type, taskId, status, message: taskMessage, data } = payload;
                
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
                    log.app(`Custom task message: ${taskMessage}`);
                    
                    if (taskMessage) {
                        showCustomNotification({
                            title: 'Task Update',
                            body: taskMessage,
                            type: 'info'
                        });
                    }
                    
                    await sendMessageLog(`Task queue message: ${taskMessage}`, {
                        taskId,
                        messageType: type
                    });
                }
                
                break;

            case 'execute-action':
                // Execute action script
                const { filename, parameters } = payload;
                log.app(`Executing action: ${filename}`);
                // Call your action handler here
                // const result = await runActionScript(filename, parameters);
                // await sendStatusUpdate('action-result', result);
                break;
                
            case 'restart':
                log.app("Restart command received");
                // Properly leave presence before restart
                await closeAbly();
                // Small delay to ensure Ably has time to send the leave event
                await new Promise(resolve => setTimeout(resolve, 500));
                app.relaunch();
                app.exit();
                break;
                
            case 'shutdown':
                log.app("Shutdown command received");
                // Small delay to ensure Ably has time to send the leave event
                await new Promise(resolve => setTimeout(resolve, 500));
                // Properly leave presence before shutdown
                await closeAbly();
                app.quit();
                break;
                
            default:
                log.app(`Unknown command: ${command}`);
        }
    } catch (error) {
        log.error("Error processing Ably message:", error);
        await sendStatusUpdate('error', { 
            command, 
            error: error.message 
        });
    }
}

/**
 * SUMMARY OF CHANGES:
 * 
 * 1. Added new 'taskqueue' case to handle task-related messages
 * 2. 'notification' case now only handles general OS notifications
 * 3. Task status updates show appropriate notifications
 * 4. Custom task messages are logged and displayed
 * 5. All task updates are sent to message log for tracking
 * 
 * WHAT YOUR CLIENT WILL NOW RECEIVE:
 * 
 * For task approvals/rejections:
 * {
 *   command: 'taskqueue',
 *   payload: {
 *     type: 'task-status-update',
 *     taskId: '233a6833-d73e-447e-98a7-f81475f722f9',
 *     status: 'approved',
 *     timestamp: '2025-12-03T08:15:30.522Z',
 *     data: { email: null, ip: '192.168.1.100', objectData: {...} }
 *   }
 * }
 * 
 * For custom task messages:
 * {
 *   command: 'taskqueue',
 *   payload: {
 *     type: 'custom-update',
 *     taskId: 'abc123...',
 *     message: 'Your task has been processed successfully!',
 *     timestamp: '2025-12-03T08:15:30.522Z'
 *   }
 * }
 */