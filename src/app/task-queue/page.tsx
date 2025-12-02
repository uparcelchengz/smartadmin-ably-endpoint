"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  ListTodo, 
  Check,
  X,
  Trash2,
  Filter,
  RefreshCw
} from "lucide-react";
import { useRouter } from "next/navigation";

interface TaskQueueItem {
  id: string;
  taskId: string;
  email?: string;
  ip?: string;
  status: 'pending' | 'approved' | 'rejected';
  objectData?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface TaskAPIItem {
  id: number;
  taskId: string;
  email?: string;
  ip?: string;
  status: 'pending' | 'approved' | 'rejected';
  objectData?: unknown;
  createdAt: string;
  updatedAt: string;
}

export default function TaskQueuePage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskQueueItem[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = statusFilter ? `/api/task-queue?status=${statusFilter}` : '/api/task-queue';
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        const mappedTasks = data.data.map((task: TaskAPIItem) => ({
          id: task.id.toString(),
          taskId: task.taskId,
          email: task.email,
          ip: task.ip,
          status: task.status,
          objectData: task.objectData,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        }));
        setTasks(mappedTasks);
        console.log('[Task Queue] Loaded', mappedTasks.length, 'tasks');
      } else {
        console.error('[Task Queue] Failed to load:', data.error);
      }
    } catch (error) {
      console.error('[Task Queue] Error loading:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadTasks();
    }
  }, [statusFilter, mounted, loadTasks]);

  const updateTaskStatus = async (taskId: string, status: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/task-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`[Task Queue] ✓ Task ${taskId} ${status}`);
        loadTasks();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Task Queue] Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSelectedTasks = async () => {
    if (selectedTasks.size === 0) return;
    
    const confirmMessage = selectedTasks.size === tasks.length 
      ? 'Are you sure you want to clear ALL visible tasks?' 
      : `Are you sure you want to clear ${selectedTasks.size} selected task(s)?`;
    
    if (!confirm(confirmMessage)) return;

    setIsProcessing(true);
    try {
      const taskIds = Array.from(selectedTasks).map(id => 
        tasks.find(task => task.id === id)?.taskId
      ).filter(Boolean);
      
      console.log('[Task Queue] Clearing tasks:', taskIds.length);
      
      const response = await fetch('/api/task-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`[Task Queue] ✓ Cleared ${data.deletedCount} tasks`);
        setSelectedTasks(new Set());
        loadTasks();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Task Queue] Error clearing tasks:', error);
      alert('Failed to clear tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllTasks = async () => {
    if (!confirm('Are you sure you want to clear ALL tasks from the queue?')) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/task-queue?clearAll=true', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`[Task Queue] ✓ Cleared all tasks (${data.deletedCount})`);
        setSelectedTasks(new Set());
        loadTasks();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Task Queue] Error clearing all tasks:', error);
      alert('Failed to clear all tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const toggleAllTasks = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(task => task.id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ListTodo className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Task Queue</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Review and manage pending tasks
          </p>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <Button
                onClick={loadTasks}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              
              {selectedTasks.size > 0 && (
                <Button
                  onClick={clearSelectedTasks}
                  variant="destructive"
                  size="sm"
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Selected ({selectedTasks.size})
                </Button>
              )}
              
              <Button
                onClick={clearAllTasks}
                variant="destructive"
                size="sm"
                disabled={isProcessing || tasks.length === 0}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tasks ({tasks.length})</CardTitle>
              {tasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedTasks.size === tasks.length}
                    onCheckedChange={toggleAllTasks}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Select All
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No tasks in queue
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${getStatusColor(task.status)} text-white`}>
                            {task.status.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            ID: {task.taskId}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-3">
                          {task.email && (
                            <div>
                              <span className="font-medium">Email:</span> {task.email}
                            </div>
                          )}
                          {task.ip && (
                            <div>
                              <span className="font-medium">IP:</span> {task.ip}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Created:</span> {formatTimestamp(task.createdAt)}
                          </div>
                          {task.status !== 'pending' && (
                            <div>
                              <span className="font-medium">Updated:</span> {formatTimestamp(task.updatedAt)}
                            </div>
                          )}
                        </div>
                        
                        {task.objectData && (
                          <div className="mb-3">
                            <details>
                              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                                Object Data
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                                {JSON.stringify(task.objectData, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                      
                      {task.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateTaskStatus(task.taskId, 'approved')}
                            disabled={isProcessing}
                            className="gap-1 bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateTaskStatus(task.taskId, 'rejected')}
                            disabled={isProcessing}
                            className="gap-1"
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}