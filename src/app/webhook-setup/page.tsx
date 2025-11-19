'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SyncStats {
  totalMessages: number;
  lastMessage: string | null;
  firstMessage: string | null;
}

interface SyncResult {
  success: boolean;
  messagesSynced?: number;
  messagesProcessed?: number;
  lastSync?: string;
  channels?: string[];
  error?: string;
}

export default function WebhookSetupPage() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhooks/ably`
    : 'https://your-domain.com/api/webhooks/ably';

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/background/sync-messages');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const triggerSync = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/background/sync-messages', {
        method: 'POST',
      });
      const result = await response.json();
      setLastSync(result);
      await fetchStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      setLastSync({ success: false, error: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/webhooks/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-webhook' }),
      });
      const result = await response.json();
      console.log('Webhook test result:', result);
      await fetchStats();
    } catch (error) {
      console.error('Failed to test webhook:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ably Integration Rule Setup</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure Ably Integration Rules to automatically save smartadmin messages to PostgreSQL
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Total Messages</h3>
            <div className="text-3xl font-bold text-blue-600">
              {stats?.totalMessages || 0}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Last Message</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {stats?.lastMessage 
                ? new Date(stats.lastMessage).toLocaleString()
                : 'No messages yet'
              }
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">System Status</h3>
            <Badge variant={stats?.totalMessages ? 'default' : 'secondary'}>
              {stats?.totalMessages ? 'Active' : 'Pending Setup'}
            </Badge>
          </Card>
        </div>

        {/* Ably Integration Rule Setup */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Ably Integration Rule Configuration</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://ably.com/dashboard', '_blank')}
            >
              Open Ably Dashboard
            </Button>
          </div>
          
          <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">
                Step 1: Create New Integration Rule
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                In your Ably dashboard, go to: Your App → Integrations → Integration Rules → New Integration Rule
              </p>
              <div className="space-y-2 text-sm">
                <div><strong>Rule:</strong> Webhook</div>
                <div><strong>Integration Service:</strong> Webhook</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2">URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                    {webhookUrl}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    {copied ? '✓' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-2">Request Mode</label>
                <Badge variant="outline">Batch request</Badge>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Recommended for better performance
                </p>
              </div>

              <div>
                <label className="block font-medium mb-2">Source</label>
                <Badge variant="outline">Message Integration</Badge>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Delivers all messages published on matching channels
                </p>
              </div>

              <div>
                <label className="block font-medium mb-2">Channel Filter</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                    ^smartadmin.*
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard('^smartadmin.*')}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  This regex matches all smartadmin channels
                </p>
              </div>

              <div>
                <label className="block font-medium mb-2">Encoding</label>
                <Badge variant="outline">JSON</Badge>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="enveloped" defaultChecked className="rounded" />
                <label htmlFor="enveloped" className="font-medium">Enveloped</label>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Keep checked to include message metadata
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">
                Step 2: Test Your Integration
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                After creating the integration rule, test it by publishing to a smartadmin channel
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Manual Actions</h3>
            <div className="space-y-3">
              <Button 
                onClick={triggerSync} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Syncing...' : 'Trigger Background Sync'}
              </Button>
              
              <Button 
                onClick={testWebhook} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Test Webhook Endpoint
              </Button>
              
              <Button 
                onClick={fetchStats}
                variant="outline"
                className="w-full"
              >
                Refresh Stats
              </Button>
            </div>
          </Card>

          {/* Last Sync Result */}
          {lastSync && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Last Sync Result</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={lastSync.success ? 'default' : 'destructive'}>
                    {lastSync.success ? 'Success' : 'Failed'}
                  </Badge>
                  {lastSync.error && (
                    <span className="text-sm text-red-600">{lastSync.error}</span>
                  )}
                </div>
                
                {lastSync.success && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>Messages Synced: {lastSync.messagesSynced || 0}</div>
                    <div>Messages Processed: {lastSync.messagesProcessed || 0}</div>
                    <div>Channels: {lastSync.channels?.join(', ')}</div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Troubleshooting */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Troubleshooting</h3>
          <div className="space-y-3 text-sm">
            <div>
              <strong>No messages appearing?</strong>
              <ul className="list-disc list-inside mt-1 text-gray-600 dark:text-gray-400">
                <li>Verify the Integration Rule is active in Ably Dashboard</li>
                <li>Check that your smartadmin clients are publishing to channels starting with &quot;smartadmin&quot;</li>
                <li>Use the &quot;Test Webhook Endpoint&quot; button to verify the endpoint works</li>
                <li>Check browser console and server logs for errors</li>
              </ul>
            </div>
            <div>
              <strong>Integration Rule not triggering?</strong>
              <ul className="list-disc list-inside mt-1 text-gray-600 dark:text-gray-400">
                <li>Ensure your webhook URL is publicly accessible (not localhost)</li>
                <li>Verify the channel filter regex: <code>^smartadmin.*</code></li>
                <li>Check Ably logs in the dashboard for webhook delivery failures</li>
              </ul>
            </div>
          </div>
        </Card>


      </div>
    </div>
  );
}