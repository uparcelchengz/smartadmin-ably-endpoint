'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientControlPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [customCommand, setCustomCommand] = useState('');
  const [customPayload, setCustomPayload] = useState('{}');
  const [notificationMessage, setNotificationMessage] = useState('');

  const sendCommand = async (command: string, payload: any = {}) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/client-messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          payload
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!notificationMessage.trim()) return;
    
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/client-messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: notificationMessage
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const sendCustomCommand = async () => {
    if (!customCommand.trim()) return;
    
    try {
      const payload = JSON.parse(customPayload);
      await sendCommand(customCommand, payload);
    } catch (error) {
      setResult({ 
        success: false, 
        error: 'Invalid JSON in payload field' 
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Client Control Panel</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Commands */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => sendCommand('ping', { timestamp: Date.now() })}
                disabled={loading}
                variant="outline"
              >
                Ping
              </Button>
              <Button 
                onClick={() => sendCommand('getstatus')}
                disabled={loading}
                variant="outline"
              >
                Get Status
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => sendCommand('restart')}
                disabled={loading}
                variant="destructive"
              >
                Restart Client
              </Button>
              <Button 
                onClick={() => sendCommand('shutdown')}
                disabled={loading}
                variant="destructive"
              >
                Shutdown Client
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Send Notification */}
        <Card>
          <CardHeader>
            <CardTitle>Send Notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter notification message..."
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <Button 
              onClick={sendNotification}
              disabled={loading || !notificationMessage.trim()}
              className="w-full"
            >
              Send Notification
            </Button>
          </CardContent>
        </Card>

        {/* Custom Command */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Custom Command</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Command</label>
                <Input
                  placeholder="execute-action"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payload (JSON)</label>
                <Textarea
                  placeholder='{"filename": "script.js", "parameters": {}}'
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <Button 
              onClick={sendCustomCommand}
              disabled={loading || !customCommand.trim()}
              className="w-full"
            >
              Send Custom Command
            </Button>
          </CardContent>
        </Card>

        {/* Result Display */}
        {result && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Command Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className={`p-4 rounded-lg text-sm overflow-auto ${
                result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p>This control panel sends commands to your Electron client via Ably channels:</p>
            <ul>
              <li><strong>Ping:</strong> Tests connectivity - client should respond with "pong"</li>
              <li><strong>Get Status:</strong> Requests client information (uptime, memory, etc.)</li>
              <li><strong>Restart/Shutdown:</strong> Controls client lifecycle</li>
              <li><strong>Send Notification:</strong> Shows OS notification on client machine</li>
              <li><strong>Custom Command:</strong> Send any command with custom payload</li>
            </ul>
            <p className="text-sm text-gray-600 mt-4">
              Commands are sent to <code>smartadmin-control-broadcast</code> channel. 
              Check your Electron client logs to see received messages.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}