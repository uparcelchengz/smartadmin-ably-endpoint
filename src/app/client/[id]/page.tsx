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

    // Enhanced message loading with Ably history + MongoDB fallback
    const loadMessageHistory = async () => {
      setIsLoadingHistory(true);
      console.log('[Client Detail] Loading enhanced message history for:', clientId);
      
      try {
        const allMessages: MessageLog[] = [];
        
        // 1. First, get recent messages from Ably (fast, up to 72 hours)
        console.log('[Client Detail] Loading from Ably channel history...');
        
        const statusChannel = ably.channels.get("smartadmin-status");
        const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
        const broadcastChannel = ably.channels.get("smartadmin-control-broadcast");
        
        const [statusHistory, controlHistory, broadcastHistory] = await Promise.all([
          statusChannel.history({ limit: 100 }),
          controlChannel.history({ limit: 50 }),
          broadcastChannel.history({ limit: 50 })
        ]);
        
        // Process status updates (received from client)
        statusHistory.items.forEach((msg: Ably.Message) => {
          const update = msg.data;
          if (update.clientId === clientId) {
            allMessages.push({
              id: msg.id || `status-${msg.timestamp}`,
              clientId: update.clientId,
              type: 'received',
              command: update.type,
              data: update.data,
              timestamp: update.timestamp || new Date(msg.timestamp ?? Date.now()).toISOString()
            });
          }
        });
        
        // Process control commands (sent to specific client)
        controlHistory.items.forEach((msg: Ably.Message) => {
          const cmd = msg.data;
          if (cmd.targetClientId === clientId) {
            allMessages.push({
              id: msg.id || `cmd-${msg.timestamp}`,
              clientId,
              type: 'sent',
              command: cmd.command,
              data: cmd.payload || {},
              timestamp: cmd.timestamp || new Date(msg.timestamp ?? Date.now()).toISOString()
            });
          }
        });
        
        // Process broadcast commands (sent to all clients)
        broadcastHistory.items.forEach((msg: Ably.Message) => {
          const cmd = msg.data;
          // Include broadcast messages that don't have a specific target or target this client
          if (!cmd.targetClientId || cmd.targetClientId === clientId) {
            allMessages.push({
              id: msg.id || `broadcast-${msg.timestamp}`,
              clientId,
              type: 'sent',
              command: cmd.command,
              data: cmd.payload || {},
              timestamp: cmd.timestamp || new Date(msg.timestamp ?? Date.now()).toISOString()
            });
          }
        });
        
        console.log(`[Client Detail] ✓ Loaded ${allMessages.length} messages from Ably`);
        
        // 2. Get older messages from MongoDB if Ably history is limited
        const ablyOldestTimestamp = allMessages.length > 0 
          ? Math.min(...allMessages.map(m => new Date(m.timestamp).getTime()))
          : Date.now();
        
        console.log('[Client Detail] Loading older messages from PostgreSQL...');
        const mongoResponse = await fetch(
          `/api/logs/message?clientId=${clientId}&endDate=${new Date(ablyOldestTimestamp).toISOString()}&limit=100`
        );
        
        if (mongoResponse.ok) {
          const mongoData = await mongoResponse.json();
          if (mongoData.success && mongoData.data.length > 0) {
            mongoData.data.forEach((msg: { _id?: string; messageId?: string; clientId: string; type: string; command: string; payload: Record<string, unknown>; timestamp: string }) => {
              allMessages.push({
                id: msg._id || msg.messageId || `postgres-${Date.now()}`,
                clientId: msg.clientId,
                type: msg.type as 'sent' | 'received',
                command: msg.command,
                data: msg.payload,
                timestamp: new Date(msg.timestamp).toISOString()
              });
            });
            console.log(`[Client Detail] ✓ Added ${mongoData.data.length} older messages from PostgreSQL`);
          }
        }
        
        // 3. Sort all messages by timestamp and remove duplicates
        const uniqueMessages = allMessages.filter((msg, index, self) => 
          index === self.findIndex(m => m.id === msg.id)
        ).sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        setMessages(uniqueMessages);
        console.log(`[Client Detail] ✓ Total loaded: ${uniqueMessages.length} messages (Ably + PostgreSQL)`);
        
      } catch (err) {
        console.error("[Client Detail] ✗ Error loading message history:", err);
        
        // Fallback to PostgreSQL only
        try {
          console.log('[Client Detail] Falling back to PostgreSQL only...');
          const mongoResponse = await fetch(`/api/logs/message?clientId=${clientId}&limit=200`);
          const mongoData = await mongoResponse.json();
          
          if (mongoData.success) {
            const mongoMessages = mongoData.data.map((msg: { _id?: string; messageId?: string; clientId: string; type: string; command: string; payload: Record<string, unknown>; timestamp: string }) => ({
              id: msg._id || msg.messageId || `fallback-${Date.now()}`,
              clientId: msg.clientId,
              type: msg.type as 'sent' | 'received',
              command: msg.command,
              data: msg.payload,
              timestamp: new Date(msg.timestamp).toISOString()
            }));
            
            setMessages(mongoMessages);
            console.log(`[Client Detail] ✓ Fallback loaded ${mongoMessages.length} messages from PostgreSQL`);
          }
        } catch (fallbackErr) {
          console.error("[Client Detail] ✗ Fallback also failed:", fallbackErr);
        }
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

        // Create message log entry for different types
        let newMessage;
        
        if (update.type === 'message-log') {
          // Special handling for message-log type
          newMessage = {
            id: message.id || `msg-log-${Date.now()}`,
            clientId: update.clientId,
            type: 'received' as const,
            command: 'message-log',
            data: {
              message: update.data.message,
              clientIP: update.data.clientIP,
              clientTimezone: update.data.clientTimezone,
              ...update.data
            },
            timestamp: update.timestamp
          };
        } else {
          // Standard handling for other status update types
          newMessage = {
            id: message.id || Date.now().toString(),
            clientId: update.clientId,
            type: 'received' as const,
            command: update.type,
            data: update.data,
            timestamp: update.timestamp
          };
        }

        setMessages(prev => {
          const isDuplicate = prev.some(msg => msg.id === message.id);
          if (isDuplicate) return prev;
          return [...prev, newMessage];
        });

        // Log received message to PostgreSQL (including disconnecting)
        console.log('[Client Detail] New message received:', update.type);
        console.log('[Client Detail] Logging received message to PostgreSQL:', update.type);
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
            console.log('[Client Detail] ✓ Received message logged to PostgreSQL:', update.type);
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

  const sendCommand = async (command: string, payload?: Record<string, unknown>) => {
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
    
    // Log sent message to PostgreSQL
    console.log('[Client Detail] Logging command to PostgreSQL:', command);
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
        console.log('[Client Detail] ✓ Command logged to PostgreSQL');
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
    } catch {
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
                    Live + PostgreSQL
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-[calc(100%-5rem)]">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {isLoadingHistory ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Activity className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading message history from Ably + PostgreSQL...
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
                          <Badge 
                            variant={msg.command === 'message-log' ? 'secondary' : 'outline'} 
                            className="text-xs"
                          >
                            {msg.command}
                          </Badge>
                          {msg.command === 'message-log' && (
                            <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                              🗄️ Client Log
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm">
                          {msg.command === 'message-log' && typeof msg.data.message === 'string' ? (
                            // Special display for message-log entries
                            <div className="space-y-2">
                              <div className="font-medium text-blue-700 dark:text-blue-400">
                                📄 {msg.data.message}
                              </div>
                              {Object.keys(msg.data).length > 3 && ( // Show additional data if available
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
                                    Additional Data
                                  </summary>
                                  <pre className="mt-2 whitespace-pre-wrap break-all bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                    {JSON.stringify(
                                      Object.fromEntries(
                                        Object.entries(msg.data).filter(([key]) => 
                                          !['message', 'clientId', 'clientIP', 'clientTimezone'].includes(key)
                                        )
                                      ), 
                                      null, 
                                      2
                                    )}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ) : (
                            // Standard JSON display for other message types
                            <pre className="text-xs whitespace-pre-wrap break-all">
                              {JSON.stringify(msg.data, null, 2)}
                            </pre>
                          )}
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
