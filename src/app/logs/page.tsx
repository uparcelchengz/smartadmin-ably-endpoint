"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  Database, 
  Trash2, 
  RefreshCw,
  Filter,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Download,
  Clock
} from "lucide-react";

interface MessageLog {
  id: string;
  messageId: string;
  clientId: string;
  type: 'sent' | 'received';
  channel: string;
  command: string;
  payload: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
}

interface FilterState {
  clientId: string;
  command: string;
  type: string;
  startDate: string;
  endDate: string;
  search: string;
}

interface LogStats {
  totalCount: number;
  uniqueClients: string[];
  uniqueCommands: string[];
  recentCount: number;
}

export default function MessageLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    clientId: '',
    command: '',
    type: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const [stats, setStats] = useState<LogStats>({
    totalCount: 0,
    uniqueClients: [],
    uniqueCommands: [],
    recentCount: 0
  });

  useEffect(() => {
    setMounted(true);
    loadLogs();
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLogs = async (customFilters?: Partial<FilterState>) => {
    setIsLoading(true);
    try {
      const activeFilters = { ...filters, ...customFilters };
      const queryParams = new URLSearchParams();
      
      queryParams.append('limit', '500');
      
      if (activeFilters.clientId) queryParams.append('clientId', activeFilters.clientId);
      if (activeFilters.command) queryParams.append('command', activeFilters.command);
      if (activeFilters.type) queryParams.append('type', activeFilters.type);
      if (activeFilters.startDate) queryParams.append('startDate', activeFilters.startDate);
      if (activeFilters.endDate) queryParams.append('endDate', activeFilters.endDate);

      console.log('[Logs Page] Loading logs with filters:', activeFilters);
      
      const response = await fetch(`/api/logs/message?${queryParams.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        let filteredLogs = data.data;
        
        // Apply text search filter on frontend for better performance
        if (activeFilters.search.trim()) {
          const searchTerm = activeFilters.search.toLowerCase();
          filteredLogs = filteredLogs.filter((log: MessageLog) => 
            log.clientId.toLowerCase().includes(searchTerm) ||
            log.command.toLowerCase().includes(searchTerm) ||
            log.channel.toLowerCase().includes(searchTerm) ||
            JSON.stringify(log.payload).toLowerCase().includes(searchTerm)
          );
        }
        
        setLogs(filteredLogs);
        console.log(`[Logs Page] ✓ Loaded ${filteredLogs.length} logs`);
      } else {
        console.error('[Logs Page] Failed to load:', data.error);
        setLogs([]);
      }
    } catch (error) {
      console.error('[Logs Page] Error loading:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/logs/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('[Logs Page] Error loading stats:', error);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    loadLogs(filters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      clientId: '',
      command: '',
      type: '',
      startDate: '',
      endDate: '',
      search: ''
    };
    setFilters(clearedFilters);
    loadLogs(clearedFilters);
  };

  const toggleLogSelection = (logId: string) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedLogs(newSelected);
  };

  const selectAll = () => {
    if (selectedLogs.size === logs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(logs.map(log => log.id)));
    }
  };

  const deleteSelectedLogs = async () => {
    if (selectedLogs.size === 0) return;
    
    const confirmMessage = selectedLogs.size === logs.length 
      ? 'Are you sure you want to delete ALL visible logs?' 
      : `Are you sure you want to delete ${selectedLogs.size} selected log(s)?`;
    
    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      const logIds = Array.from(selectedLogs);
      console.log('[Logs Page] Deleting logs:', logIds.length);
      
      const response = await fetch('/api/logs/message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logIds })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`[Logs Page] ✓ Deleted ${data.deletedCount} logs`);
        setSelectedLogs(new Set());
        loadLogs();
        loadStats();
        alert(`Successfully deleted ${data.deletedCount} log(s)`);
      } else {
        console.error('[Logs Page] Delete failed:', data.error);
        alert(`Failed to delete logs: ${data.error}`);
      }
    } catch (error) {
      console.error('[Logs Page] Error deleting:', error);
      alert('Failed to delete logs. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllLogs = async () => {
    const confirmMessage = 'Are you sure you want to delete ALL message logs? This action cannot be undone!';
    if (!confirm(confirmMessage)) return;

    const doubleConfirm = prompt('Type "DELETE ALL" to confirm this action:');
    if (doubleConfirm !== 'DELETE ALL') {
      alert('Deletion cancelled - confirmation text did not match.');
      return;
    }

    setIsDeleting(true);
    try {
      console.log('[Logs Page] Deleting ALL logs');
      
      const response = await fetch('/api/logs/message?deleteAll=true', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`[Logs Page] ✓ Deleted all logs (${data.deletedCount} total)`);
        setSelectedLogs(new Set());
        setLogs([]);
        loadStats();
        alert(`Successfully deleted all ${data.deletedCount} log(s)`);
      } else {
        console.error('[Logs Page] Delete all failed:', data.error);
        alert(`Failed to delete all logs: ${data.error}`);
      }
    } catch (error) {
      console.error('[Logs Page] Error deleting all:', error);
      alert('Failed to delete all logs. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const navigateToClient = (clientId: string) => {
    router.push(`/client/${encodeURIComponent(clientId)}`);
  };

  const exportLogs = () => {
    const exportData = logs.map(log => ({
      timestamp: log.timestamp,
      clientId: log.clientId,
      type: log.type,
      command: log.command,
      channel: log.channel,
      payload: log.payload
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTypeColor = (type: string) => {
    return type === 'sent' ? 'default' : 'outline';
  };

  const getCommandColor = (command: string) => {
    if (command === 'message-log') return 'secondary';
    if (command === 'heartbeat') return 'outline';
    return 'default';
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
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

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Message Logs</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            View, filter, and manage all message logs from PostgreSQL
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.totalCount.toLocaleString()}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Logs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{logs.length.toLocaleString()}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Filtered Results</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{stats.uniqueClients.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Clients</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{selectedLogs.size}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Selected</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Actions
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadLogs()}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Quick Search */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Search logs (client ID, command, channel, payload...)"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && applyFilters()}
                  className="w-full"
                />
              </div>
              <Button onClick={applyFilters} className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Client ID</label>
                  <select
                    value={filters.clientId}
                    onChange={(e) => handleFilterChange('clientId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Clients</option>
                    {stats.uniqueClients.map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Command</label>
                  <select
                    value={filters.command}
                    onChange={(e) => handleFilterChange('command', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Commands</option>
                    {stats.uniqueCommands.map(cmd => (
                      <option key={cmd} value={cmd}>{cmd}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Types</option>
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Start Date</label>
                  <Input
                    type="datetime-local"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">End Date</label>
                  <Input
                    type="datetime-local"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={selectAll}
                className="gap-2"
                disabled={logs.length === 0}
              >
                <CheckCircle2 className="h-4 w-4" />
                {selectedLogs.size === logs.length ? 'Deselect All' : 'Select All'}
              </Button>
              
              <Button
                variant="outline"
                onClick={clearFilters}
                className="gap-2"
              >
                Clear Filters
              </Button>
              
              <Button
                variant="outline"
                onClick={exportLogs}
                disabled={logs.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export ({logs.length})
              </Button>
              
              <Button
                variant="destructive"
                onClick={deleteSelectedLogs}
                disabled={selectedLogs.size === 0 || isDeleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedLogs.size})
              </Button>
              
              <Button
                variant="destructive"
                onClick={deleteAllLogs}
                disabled={isDeleting}
                className="gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Delete All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Message Logs ({logs.length.toLocaleString()} {logs.length === 500 ? '- showing first 500' : ''})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600 dark:text-gray-400">Loading message logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No logs found matching your filters</p>
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800">
                      <th className="p-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedLogs.size === logs.length && logs.length > 0}
                          onChange={selectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="p-3 text-left">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Timestamp
                        </div>
                      </th>
                      <th className="p-3 text-left">Client ID</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Command</th>
                      <th className="p-3 text-left">Channel</th>
                      <th className="p-3 text-left">Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          selectedLogs.has(log.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedLogs.has(log.id)}
                            onChange={() => toggleLogSelection(log.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => navigateToClient(log.clientId)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-mono text-xs flex items-center gap-1"
                          >
                            {log.clientId}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="p-3">
                          <Badge variant={getTypeColor(log.type)} className="text-xs">
                            {log.type}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={getCommandColor(log.command)} className="text-xs">
                            {log.command}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {log.channel}
                        </td>
                        <td className="p-3 max-w-xs">
                          {log.command === 'message-log' && typeof log.payload?.message === 'string' ? (
                            <div className="text-sm">
                              <div className="font-medium text-blue-700 dark:text-blue-400">
                                📝 {log.payload.message}
                              </div>
                              {Object.keys(log.payload).length > 1 && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-xs text-gray-500">
                                    Full data...
                                  </summary>
                                  <pre className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded overflow-auto max-h-32">
                                    {JSON.stringify(log.payload, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ) : (
                            <details>
                              <summary className="cursor-pointer text-xs text-gray-500">
                                View payload...
                              </summary>
                              <pre className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded overflow-auto max-h-32">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}