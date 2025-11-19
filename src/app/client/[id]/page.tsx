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
import { LogoutButton } from "@/components/logout-button";
import { 
  ArrowLeft, 
  Activity, 
  Send,
  MapPin,
  Monitor,
  Clock,
  MemoryStick
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
  
  // Notification modal states
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    body: '',
    iconAnimation: 'null' as 'rotate' | 'flip' | 'null',
    sound: true,
    notificationType: 'small' as 'small' | 'large' | 'image',
    imageUrl: '',
    timeout: 5000
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const ably = getAblyClient();
    
    // Set a timeout for overall loading
    const loadingTimeout = setTimeout(() => {
      if (isLoadingHistory) {
        console.warn('[Client Detail] Loading timeout - setting offline status');
        setIsLoadingHistory(false);
        setClient(prev => prev ? { ...prev, status: 'offline' } : {
          clientId,
          clientIP: 'unknown',
          clientTimezone: 'unknown',
          hostname: 'unknown',
          platform: 'unknown', 
          appVersion: 'unknown',
          startTime: 'unknown',
          status: 'offline',
          lastSeen: new Date().toISOString()
        });
      }
    }, 10000); // 10 second timeout

    // Subscribe to presence channel with timeout
    const presenceChannel = ably.channels.get("smartadmin-presence");
    
    // Use Promise.race to add timeout to presence.get()
    Promise.race([
      presenceChannel.presence.get() as Promise<Ably.PresenceMessage[]>,
      new Promise<Ably.PresenceMessage[]>((_, reject) => 
        setTimeout(() => reject(new Error('Presence timeout')), 5000)
      )
    ]).then((members: Ably.PresenceMessage[]) => {
      const member = members?.find((m: Ably.PresenceMessage) => m.clientId === clientId);
      if (member) {
        setClient({
          ...member.data,
          status: 'online',
          lastSeen: new Date().toISOString()
        });
        console.log('[Client Detail] ✓ Client found in presence:', clientId);
      } else {
        console.log('[Client Detail] Client not found in presence - checking for offline data');
        // Client not in presence, try to load from recent logs
        loadOfflineClientData();
      }
    }).catch((err) => {
      console.warn("[Client Detail] Error getting presence (client might be offline):", err.message);
      // Try to load offline data
      loadOfflineClientData();
    });

    // Function to load client data from logs when offline
    const loadOfflineClientData = async () => {
      try {
        const response = await fetch(`/api/logs/message?clientId=${encodeURIComponent(clientId)}&limit=1`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
          const lastLog = data.data[0];
          setClient({
            clientId,
            clientIP: lastLog.payload?.clientIP || 'unknown',
            clientTimezone: lastLog.payload?.clientTimezone || 'unknown', 
            hostname: lastLog.payload?.hostname || 'unknown',
            platform: lastLog.payload?.platform || 'unknown',
            appVersion: lastLog.payload?.appVersion || 'unknown',
            startTime: lastLog.payload?.startTime || 'unknown',
            status: 'offline',
            lastSeen: lastLog.timestamp
          });
          console.log('[Client Detail] ✓ Loaded offline client data from logs');
        } else {
          // No data found, create minimal client object
          setClient({
            clientId,
            clientIP: 'unknown',
            clientTimezone: 'unknown',
            hostname: 'unknown', 
            platform: 'unknown',
            appVersion: 'unknown',
            startTime: 'unknown',
            status: 'offline',
            lastSeen: 'Never'
          });
          console.log('[Client Detail] No client data found - created minimal client object');
        }
      } catch (error) {
        console.error('[Client Detail] Error loading offline client data:', error);
        // Fallback to minimal client object
        setClient({
          clientId,
          clientIP: 'unknown',
          clientTimezone: 'unknown', 
          hostname: 'unknown',
          platform: 'unknown',
          appVersion: 'unknown',
          startTime: 'unknown',
          status: 'offline',
          lastSeen: 'Unknown'
        });
      }
    };

    // Subscribe to presence leave events - redirect when client disconnects
    presenceChannel.presence.subscribe("leave", (member) => {
      if (member.clientId === clientId) {
        console.log("Client disconnected:", clientId);
        router.push("/");
      }
    });

    // Enhanced message loading with Ably history + PostgreSQL fallback
    const loadMessageHistory = async () => {
      setIsLoadingHistory(true);
      console.log('[Client Detail] Loading enhanced message history for:', clientId);
      
      try {
        const allMessages: MessageLog[] = [];
        
        // 1. First, get recent messages from Ably (fast, up to 72 hours) with timeout
        console.log('[Client Detail] Loading from Ably channel history...');
        
        const statusChannel = ably.channels.get("smartadmin-status");
        const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
        const broadcastChannel = ably.channels.get("smartadmin-control-broadcast");
        
        try {
          // Add timeout to Ably history calls
          const historyPromises = [
            Promise.race([
              statusChannel.history({ limit: 100 }) as Promise<Ably.PaginatedResult<Ably.Message>>,
              new Promise<Ably.PaginatedResult<Ably.Message>>((_, reject) => setTimeout(() => reject(new Error('Ably timeout')), 5000))
            ]),
            Promise.race([
              controlChannel.history({ limit: 50 }) as Promise<Ably.PaginatedResult<Ably.Message>>,
              new Promise<Ably.PaginatedResult<Ably.Message>>((_, reject) => setTimeout(() => reject(new Error('Ably timeout')), 5000))
            ]),
            Promise.race([
              broadcastChannel.history({ limit: 50 }) as Promise<Ably.PaginatedResult<Ably.Message>>,
              new Promise<Ably.PaginatedResult<Ably.Message>>((_, reject) => setTimeout(() => reject(new Error('Ably timeout')), 5000))
            ])
          ];
          
          const [statusHistory, controlHistory, broadcastHistory] = await Promise.all(historyPromises);
          
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
            if (!cmd.targetClientId) { // Only broadcast messages
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
          
          // Process control commands (sent to client)
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
        } catch (ablyError) {
          console.warn('[Client Detail] Ably history failed (client might be offline):', ablyError);
          // Continue to PostgreSQL even if Ably fails
        }
        
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
    // Cleanup function
    return () => {
      clearTimeout(loadingTimeout);
      console.log('[Client Detail] Cleanup - cleared timeout and subscriptions');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSendNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.body.trim()) {
      alert('Title and body are required');
      return;
    }

    const payload = {
      title: notificationForm.title,
      body: notificationForm.body,
      iconAnimation: notificationForm.iconAnimation === 'null' ? null : notificationForm.iconAnimation,
      sound: notificationForm.sound,
      notificationType: notificationForm.notificationType,
      imageUrl: notificationForm.notificationType === 'image' ? notificationForm.imageUrl : undefined,
      timeout: notificationForm.timeout
    };

    try {
      await sendCommand('notification', payload);
      setShowNotificationModal(false);
      // Reset form
      setNotificationForm({
        title: '',
        body: '',
        iconAnimation: 'null',
        sound: true,
        notificationType: 'small',
        imageUrl: '',
        timeout: 5000
      });
      console.log('[Client Detail] ✓ Notification sent successfully');
    } catch (error) {
      console.error('[Client Detail] ✗ Error sending notification:', error);
      alert('Failed to send notification. Please try again.');
    }
  };

  const resetNotificationForm = () => {
    setNotificationForm({
      title: '',
      body: '',
      iconAnimation: 'null',
      sound: true,
      notificationType: 'small',
      imageUrl: '',
      timeout: 5000
    });
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
          <div className="flex items-center gap-2">
            <LogoutButton />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Info */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-8rem)]">
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
          </div>

          {/* Message Log */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-8rem)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Message Log
                  <Badge variant="outline" className="text-xs">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                    Live + PostgreSQL
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {messages.length} messages
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-[calc(100%-4rem)]">
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
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
                        className={`p-2 rounded-lg ${
                          msg.type === 'sent'
                            ? 'bg-blue-50 dark:bg-blue-900/20 ml-6'
                            : 'bg-gray-50 dark:bg-gray-800 mr-6'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
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
                        <div className="text-xs">
                          {msg.command === 'message-log' && typeof msg.data.message === 'string' ? (
                            // Special display for message-log entries
                            <div className="space-y-1">
                              <div className="font-medium text-blue-700 dark:text-blue-400">
                                📄 {msg.data.message}
                              </div>
                              
                              {/* Show client info if available */}
                              {(typeof msg.data.clientIP === 'string' || typeof msg.data.clientTimezone === 'string') && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                  {typeof msg.data.clientIP === 'string' && (
                                    <div>🌐 IP: {msg.data.clientIP}</div>
                                  )}
                                  {typeof msg.data.clientTimezone === 'string' && (
                                    <div>🕐 Timezone: {msg.data.clientTimezone}</div>
                                  )}
                                </div>
                              )}
                              
                              {/* Show any additional data beyond the core message-log fields */}
                              {(() => {
                                const additionalFields = Object.fromEntries(
                                  Object.entries(msg.data).filter(([key]) => 
                                    !['message', 'clientId', 'clientIP', 'clientTimezone'].includes(key)
                                  )
                                );
                                return Object.keys(additionalFields).length > 0 ? (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                                      📋 Additional Data ({Object.keys(additionalFields).length} fields)
                                    </summary>
                                    <pre className="mt-1 whitespace-pre-wrap break-all bg-gray-100 dark:bg-gray-700 p-1 rounded text-xs">
                                      {JSON.stringify(additionalFields, null, 2)}
                                    </pre>
                                  </details>
                                ) : null;
                              })()}
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
                
                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-1 mt-2">
                  <Button
                    onClick={() => setShowNotificationModal(true)}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs px-2 py-1"
                  >
                    🔔 Notify
                  </Button>
                  <Button
                    onClick={() => sendCommand('ping')}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs px-2 py-1"
                  >
                    📡 Ping
                  </Button>
                  <Button
                    onClick={() => sendCommand('getstatus')}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs px-2 py-1"
                  >
                    📊 Status
                  </Button>
                  <Button
                    onClick={() => sendCommand('restart')}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs px-2 py-1"
                  >
                    🔄 Restart
                  </Button>
                  <Button
                    onClick={() => sendCommand('shutdown')}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs px-2 py-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    ⚡ Shutdown
                  </Button>
                  <Button
                    onClick={handleBanClient}
                    disabled={isBanning || !client?.clientIP}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs px-2 py-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    🛡️ {isBanning ? 'Banning...' : 'Ban'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Send Notification</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowNotificationModal(false);
                    resetNotificationForm();
                  }}
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <Input
                    placeholder="Notification title"
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                {/* Body */}
                <div>
                  <label className="block text-sm font-medium mb-1">Body *</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                    placeholder="Notification message"
                    rows={3}
                    value={notificationForm.body}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, body: e.target.value }))}
                  />
                </div>
                
                {/* Notification Type */}
                <div>
                  <label className="block text-sm font-medium mb-1">Notification Type</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                    value={notificationForm.notificationType}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, notificationType: e.target.value as 'small' | 'large' | 'image' }))}
                  >
                    <option value="small">Small</option>
                    <option value="large">Large</option>
                    <option value="image">Image</option>
                  </select>
                </div>
                
                {/* Image URL (only for image type) */}
                {notificationForm.notificationType === 'image' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Image URL</label>
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={notificationForm.imageUrl}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    />
                  </div>
                )}
                
                {/* Icon Animation */}
                <div>
                  <label className="block text-sm font-medium mb-1">Icon Animation</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                    value={notificationForm.iconAnimation}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, iconAnimation: e.target.value as 'rotate' | 'flip' | 'null' }))}
                  >
                    <option value="null">None</option>
                    <option value="rotate">Rotate</option>
                    <option value="flip">Flip</option>
                  </select>
                </div>
                
                {/* Timeout */}
                <div>
                  <label className="block text-sm font-medium mb-1">Auto-close timeout (ms)</label>
                  <Input
                    type="number"
                    min="1000"
                    max="30000"
                    step="1000"
                    value={notificationForm.timeout}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, timeout: parseInt(e.target.value) || 5000 }))}
                  />
                </div>
                
                {/* Sound */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sound"
                    checked={notificationForm.sound}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, sound: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="sound" className="text-sm font-medium">Play sound</label>
                </div>
                
                {/* Preview */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Preview:</h4>
                  <div className="text-xs space-y-1">
                    <div><strong>Title:</strong> {notificationForm.title || 'No title'}</div>
                    <div><strong>Body:</strong> {notificationForm.body || 'No body'}</div>
                    <div><strong>Type:</strong> {notificationForm.notificationType}</div>
                    <div><strong>Animation:</strong> {notificationForm.iconAnimation === 'null' ? 'None' : notificationForm.iconAnimation}</div>
                    <div><strong>Sound:</strong> {notificationForm.sound ? 'Yes' : 'No'}</div>
                    <div><strong>Timeout:</strong> {notificationForm.timeout}ms</div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSendNotification}
                    disabled={!notificationForm.title.trim() || !notificationForm.body.trim() || isLoading}
                    className="flex-1"
                  >
                    🔔 Send Notification
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNotificationModal(false);
                      resetNotificationForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
