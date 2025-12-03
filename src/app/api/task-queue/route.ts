import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import * as Ably from 'ably';

// GET - Retrieve all tasks or get specific task by task_id
export async function GET(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);

    client = await connectToDatabase();

    if (taskId) {
      // Get specific task by task_id
      const result = await client.query(
        'SELECT * FROM task_queue WHERE task_id = $1 LIMIT 1',
        [taskId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Task not found'
        }, { status: 404 });
      }

      const task = result.rows[0];
      return NextResponse.json({
        success: true,
        data: {
          id: task.id,
          taskId: task.task_id,
          email: task.email,
          ip: task.ip,
          status: task.status,
          objectData: task.object_data,
          createdAt: task.created_at,
          updatedAt: task.updated_at
        }
      });
    }

    // Get all tasks with optional status filter
    let query = 'SELECT * FROM task_queue';
    const conditions = [];
    const values = [];
    let paramCount = 0;

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      conditions.push(`status = $${++paramCount}`);
      values.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (++paramCount);
    values.push(limit);

    const result = await client.query(query, values);

    const tasks = result.rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      email: row.email,
      ip: row.ip,
      status: row.status,
      objectData: row.object_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Queue API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// POST - Add new task to queue
export async function POST(request: NextRequest) {
  let client;
  try {
    const { email, ip, objectData } = await request.json();

    if (!email && !ip) {
      return NextResponse.json({
        success: false,
        error: 'Either email or ip is required'
      }, { status: 400 });
    }

    client = await connectToDatabase();

    // Generate unique task ID
    const taskId = uuidv4();

    const insertResult = await client.query(
      'INSERT INTO task_queue (task_id, email, ip, status, object_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [taskId, email || null, ip || null, 'pending', objectData || null]
    );

    const newTask = insertResult.rows[0];
    console.log(`[Task Queue API] ✓ Created task: ${taskId}`);

    return NextResponse.json({
      success: true,
      data: {
        id: newTask.id,
        taskId: newTask.task_id,
        email: newTask.email,
        ip: newTask.ip,
        status: newTask.status,
        objectData: newTask.object_data,
        createdAt: newTask.created_at,
        updatedAt: newTask.updated_at
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Queue API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// PATCH - Update task status (approve/reject)
export async function PATCH(request: NextRequest) {
  let client;
  try {
    const { taskId, status } = await request.json();

    if (!taskId || !status) {
      return NextResponse.json({
        success: false,
        error: 'Task ID and status are required'
      }, { status: 400 });
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Status must be "pending", "approved", or "rejected"'
      }, { status: 400 });
    }

    client = await connectToDatabase();

    const updateResult = await client.query(
      'UPDATE task_queue SET status = $1, updated_at = NOW() WHERE task_id = $2 RETURNING *',
      [status, taskId]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Task not found'
      }, { status: 404 });
    }

    const updatedTask = updateResult.rows[0];
    console.log(`[Task Queue API] ✓ Updated task ${taskId} status to: ${status}`);

    // Send Ably notification to client
    try {
      await sendTaskStatusNotification({
        taskId: updatedTask.task_id,
        status: updatedTask.status,
        email: updatedTask.email,
        ip: updatedTask.ip,
        objectData: updatedTask.object_data
      });
      console.log(`[Task Queue API] ✓ Sent Ably notification for task ${taskId}`);
    } catch (ablyError) {
      console.error(`[Task Queue API] ⚠️ Failed to send Ably notification:`, ablyError);
      // Don't fail the request if Ably notification fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTask.id,
        taskId: updatedTask.task_id,
        email: updatedTask.email,
        ip: updatedTask.ip,
        status: updatedTask.status,
        objectData: updatedTask.object_data,
        createdAt: updatedTask.created_at,
        updatedAt: updatedTask.updated_at
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Queue API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// DELETE - Remove tasks from queue
export async function DELETE(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get('clearAll') === 'true';

    client = await connectToDatabase();

    if (clearAll) {
      const result = await client.query('DELETE FROM task_queue RETURNING id');
      const deletedCount = result.rows.length;
      
      console.log(`[Task Queue API] ✓ Cleared all ${deletedCount} tasks`);
      
      return NextResponse.json({
        success: true,
        message: `Cleared all ${deletedCount} tasks`,
        deletedCount
      });
    } else {
      const { taskIds } = await request.json();
      
      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No task IDs provided'
        }, { status: 400 });
      }

      const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(', ');
      const deleteQuery = `DELETE FROM task_queue WHERE task_id IN (${placeholders}) RETURNING task_id`;
      const result = await client.query(deleteQuery, taskIds);
      const deletedCount = result.rows.length;
      
      console.log(`[Task Queue API] ✓ Deleted ${deletedCount} specific tasks`);
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} tasks`,
        deletedCount
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Queue API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
// Helper function to send task status notifications via Ably
async function sendTaskStatusNotification(task: {
  taskId: string;
  status: string;
  email?: string;
  ip?: string;
  objectData?: Record<string, unknown>;
}) {
  try {
    const ably = new Ably.Rest({
      key: process.env.ABLY_API_KEY || "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU"
    });

    const notification = {
      command: 'taskqueue',
      payload: {
        type: 'task-status-update',
        taskId: task.taskId,
        status: task.status,
        timestamp: new Date().toISOString(),
        data: {
          email: task.email,
          ip: task.ip,
          objectData: task.objectData
        }
      }
    };

    // Strategy 1: Send to specific client if we can identify them
    if (task.email || task.ip) {
      try {
        const presenceChannel = ably.channels.get('smartadmin-presence');
        const members = await presenceChannel.presence.get();
        const memberArray = Array.isArray(members) ? members : [];
        const matchingClients = memberArray.filter((member: Record<string, unknown>) => {
          const clientData = member.data as Record<string, unknown>;
          return (task.email && clientData.email === task.email) || 
                 (task.ip && clientData.clientIP === task.ip);
        });

        for (const client of matchingClients) {
          const clientChannel = ably.channels.get(`smartadmin-control-${client.clientId}`);
          await clientChannel.publish('command', {
            ...notification,
            targetClientId: client.clientId
          });
          console.log(`[Task Notification] ✓ Sent taskqueue command to specific client: ${client.clientId}`);
        }
      } catch (presenceError) {
        console.warn('[Task Notification] Could not check presence:', presenceError);
      }
    }

    // Strategy 2: Always broadcast to all clients (they can filter)
    const broadcastChannel = ably.channels.get('smartadmin-control-broadcast');
    await broadcastChannel.publish('command', notification);
    console.log(`[Task Notification] ✓ Broadcast taskqueue command sent for task ${task.taskId}`);

    // Strategy 3: Send to dedicated task notifications channel
    const taskChannel = ably.channels.get('smartadmin-task-notifications');
    await taskChannel.publish('status-update', notification);
    console.log(`[Task Notification] ✓ Sent taskqueue command to task notifications channel`);

  } catch (error) {
    console.error('[Task Notification] Error sending taskqueue command:', error);
    throw error;
  }
}
