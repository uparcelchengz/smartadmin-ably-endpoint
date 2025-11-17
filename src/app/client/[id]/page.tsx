"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAblyClient } from "@/lib/ably-client";
import { ClientData, MessageLog } from "@/types/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  Activity, 
  Zap, 
  RotateCw, 
  Power, 
  Send,
  MapPin,
  Monitor,
  Clock,
  MemoryStick,
  Shield
} from "lucide-react";
import * as Ably from 'ably';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = decodeURIComponent(params.id as string);
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [customCommand, setCustomCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const ably = getAblyClient();
    
    // Subscribe to presence channel
    const presenceChannel = ably.channels.get("smartadmin-presence");
    
    presenceChannel.presence.get().then((members) => {
      const member = members?.find(m => m.clientId === clientId);
      if (member) {
        setClient({
          ...member.data,
          status: 'online',
          lastSeen: new Date().toISOString()
        });
      }
    }).catch((err) => {
      console.error("Error getting presence:", err);
    });

    // Subscribe to presence leave events - redirect when client disconnects
    presenceChannel.presence.subscribe("leave", (member) => {
      if (member.clientId === clientId) {
        console.log("Client disconnected:", clientId);
        router.push("/");
      }
    });

    // Load message history from Ably channel history instead of MongoDB
    const loadMessageHistory = async () => {
      setIsLoadingHistory(true);
      console.log('[Client Detail] Loading message history from Ably for:', clientId);
      
      try {
        // Get status channel history (messages FROM client)
        const statusChannel = ably.channels.get("smartadmin-status");
        const statusHistory = await statusChannel.history({ limit: 100 });
        
        // Get control channel history (messages TO client)
        const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
        const controlHistory = await controlChannel.history({ limit: 100 });
        
        const historicalMessages: MessageLog[] = [];
        
        // Process status updates (received from client)
        statusHistory.items.forEach((msg: Ably.Message) => {
          const update = msg.data;
          if (update.clientId === clientId) {
            historicalMessages.push({
              id: msg.id || `status-${msg.timestamp}`,
              clientId: update.clientId,
              type: 'received',
              command: update.type,
              data: update.data,
              timestamp: update.timestamp || new Date(msg.timestamp ?? Date.now()).toISOString()
            });
          }
        });
        
        // Process control commands (sent to client)
        controlHistory.items.forEach((msg: Ably.Message) => {
          const cmd = msg.data;
          if (cmd.targetClientId === clientId) {
            historicalMessages.push({
              id: msg.id || `cmd-${msg.timestamp}`,
              clientId,
              type: 'sent',
              command: cmd.command,
              data: cmd.payload || {},
              timestamp: cmd.timestamp || new Date(msg.timestamp ?? Date.now()).toISOString()
            });
          }
        });
        
        // Sort by timestamp (oldest first)
        historicalMessages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        setMessages(historicalMessages);
        console.log(`[Client Detail] ✓ Loaded ${historicalMessages.length} messages from Ably`);
      } catch (err) {
        console.error("[Client Detail] ✗ Error loading message history from Ably:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadMessageHistory();

    // Subscribe to new status updates
    const statusChannel = ably.channels.get("smartadmin-status");
    statusChannel.subscribe("status-update", async (message: Ably.Message) => {
      const update = message.data;
      
      if (update.clientId === clientId) {
        setClient(prev => prev ? {
          ...prev,
          ...update.data,
          lastSeen: update.timestamp,
          status: 'online'
        } : null);

        const newMessage = {
          id: message.id || Date.now().toString(),
          clientId: update.clientId,
          type: 'received' as const,
          command: update.type,
          data: update.data,
          timestamp: update.timestamp
        };

        setMessages(prev => {
          const isDuplicate = prev.some(msg => msg.id === message.id);
          if (isDuplicate) return prev;
          return [...prev, newMessage];
        });

        // Log received message to MongoDB (including disconnecting)
        console.log('[Client Detail] New message received:', update.type);
        console.log('[Client Detail] Logging received message to MongoDB:', update.type);
        try {
          const response = await fetch('/api/logs/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: update.clientId,
              messageId: message.id || `${update.type}-${Date.now()}`,
              type: 'received',
              channel: 'smartadmin-status',
              command: update.type,
              payload: update.data,
              timestamp: new Date(update.timestamp)
            })
          });
          
          const data = await response.json();
          if (data.success) {
            console.log('[Client Detail] ✓ Received message logged to MongoDB:', update.type);
          } else {
            console.error('[Client Detail] ✗ Failed to log received message:', data.error);
          }
        } catch (err) {
          console.error('[Client Detail] ✗ Error logging received message:', err);
        }
      }
    });

    // Subscribe to control channel to capture sent commands
    const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
    controlChannel.subscribe("command", (message: Ably.Message) => {
      const cmd = message.data;
      if (cmd.targetClientId === clientId) {
        const newMessage = {
          id: message.id || Date.now().toString(),
          clientId,
          type: 'sent' as const,
          command: cmd.command,
          data: cmd.payload || {},
          timestamp: cmd.timestamp
        };

        setMessages(prev => {
          const isDuplicate = prev.some(msg => msg.id === message.id);
          if (isDuplicate) return prev;
          return [...prev, newMessage];
        });
      }
    });

    return () => {
      presenceChannel.presence.unsubscribe();
      statusChannel.unsubscribe();
      controlChannel.unsubscribe();
    };
  }, [clientId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendCommand = async (command: string, payload?: any) => {
    setIsLoading(true);
    const ably = getAblyClient();
    const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
    
    const timestamp = new Date().toISOString();
    const message = {
      command,
      payload,
      targetClientId: clientId,
      timestamp
    };

    await controlChannel.publish("command", message);
    
    // Log sent message to MongoDB
    console.log('[Client Detail] Logging command to MongoDB:', command);
    try {
      const response = await fetch('/api/logs/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          messageId: `cmd-${Date.now()}`,
          type: 'sent',
          channel: `smartadmin-control-${clientId}`,
          command,
          payload: payload || {},
          timestamp: new Date(timestamp)
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[Client Detail] ✓ Command logged to MongoDB');
      } else {
        console.error('[Client Detail] ✗ Failed to log command:', data.error);
      }
    } catch (error) {
      console.error('[Client Detail] ✗ Error logging command:', error);
    }

    setIsLoading(false);
    console.log(`Sent ${command} to ${clientId}`);

    if (command === 'restart' || command === 'shutdown') {
    //   setTimeout(() => {
    //     router.push('/');
    //   }, 1500);
    }
  };

  const handleBanClient = async () => {
    if (!client?.clientIP) {
      alert('Cannot ban: Client IP not available');
      return;
    }

    if (!confirm(`Are you sure you want to ban IP: ${client.clientIP}?\n\nThis will prevent this client from connecting.`)) {
      return;
    }

    setIsBanning(true);
    try {
      const response = await fetch('/api/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ip',
          value: client.clientIP,
          reason: `Banned from detail page for client: ${clientId}`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Client Detail] ✓ IP banned successfully');
        alert(`IP ${client.clientIP} has been banned successfully.\n\nDisconnecting client...`);
        
        // Send shutdown command
        await sendCommand('shutdown');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        if (data.error.includes('already banned')) {
          alert(`This IP is already banned.`);
        } else {
          alert(`Failed to ban IP: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('[Client Detail] ✗ Error banning IP:', error);
      alert('Failed to ban IP. Please try again.');
    } finally {
      setIsBanning(false);
    }
  };

  const handleCustomCommand = async () => {
    if (!customCommand.trim()) return;
    
    try {
      const parsed = JSON.parse(customCommand);
      await sendCommand(parsed.command, parsed.payload);
      setCustomCommand("");
    } catch (error) {
      await sendCommand(customCommand, {});
      setCustomCommand("");
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatMemory = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (!mounted) {
    return null;
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-400">Loading client details...</p>
        </div>
      </div>
    );
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                    <Badge variant={client.status === 'online' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Monitor className="h-4 w-4" />
                    <span>Hostname</span>
                  </div>
                  <p className="font-mono text-sm">{client.hostname}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <MapPin className="h-4 w-4" />
                    <span>Location</span>
                  </div>
                  <p className="text-sm">{client.clientIP}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{client.clientTimezone}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Clock className="h-4 w-4" />
                    <span>Uptime</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {client.uptime ? `${Math.floor(client.uptime / 3600)}h ${Math.floor((client.uptime % 3600) / 60)}m` : 'N/A'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <MemoryStick className="h-4 w-4" />
                    <span>Memory Usage</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatMemory(client?.memory)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Platform</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{client.platform}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">App Version</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{client.appVersion}</p>
                </div>
              </CardContent>
            </Card>

            {/* Control Panel */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Control Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => sendCommand('ping')}
                  disabled={isLoading}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Ping
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => sendCommand('get-status')}
                  disabled={isLoading}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Get Status
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => sendCommand('restart')}
                  disabled={isLoading}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Restart
                </Button>
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={() => sendCommand('shutdown')}
                  disabled={isLoading}
                >
                  <Power className="h-4 w-4 mr-2" />
                  Shutdown
                </Button>
                
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={handleBanClient}
                    disabled={isBanning}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {isBanning ? 'Banning...' : 'Ban Client IP'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Message Log */}
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-12rem)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Message Log
                  <Badge variant="outline" className="text-xs">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                    Live from Ably
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-[calc(100%-5rem)]">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {isLoadingHistory ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Activity className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading message history from Ably...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No messages yet. Send a command to start.
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.type === 'sent'
                            ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                            : 'bg-gray-50 dark:bg-gray-800 mr-8'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={msg.type === 'sent' ? 'default' : 'outline'} className="text-xs">
                            {msg.type === 'sent' ? 'Sent' : 'Received'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {msg.command}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <pre className="text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify(msg.data, null, 2)}
                          </pre>
                          <p className="text-xs opacity-70 mt-1">
                            {formatTimestamp(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder='Enter command (e.g., "ping" or {"command":"ping"})'
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomCommand()}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleCustomCommand}
                    disabled={isLoading || !customCommand.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
