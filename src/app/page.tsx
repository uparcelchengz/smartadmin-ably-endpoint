"use client";

import { useEffect, useState } from "react";
import { getAblyClient } from "@/lib/ably-client";
import { ClientData, StatusUpdate } from "@/types/client";
import { ClientCard } from "@/components/client-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Activity } from "lucide-react";
import * as Ably from 'ably';

export default function Home() {
  const [clients, setClients] = useState<Map<string, ClientData>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('initialized');
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    setMounted(true);
    const ably = getAblyClient();
    
    ably.connection.on('connected', () => {
      setIsConnected(true);
      setConnectionState('connected');
      console.log("Dashboard connected to Ably");
    });

    ably.connection.on('connecting', () => {
      setConnectionState('connecting');
      console.log("Dashboard connecting to Ably");
    });

    ably.connection.on('disconnected', () => {
      setIsConnected(false);
      setConnectionState('disconnected');
      console.log("Dashboard disconnected from Ably");
    });

    ably.connection.on('suspended', () => {
      setIsConnected(false);
      setConnectionState('suspended');
      console.log("Dashboard connection suspended");
    });

    ably.connection.on('failed', () => {
      setIsConnected(false);
      setConnectionState('failed');
      console.log("Dashboard connection failed");
    });

    const presenceChannel = ably.channels.get("smartadmin-presence");
    
    presenceChannel.presence.subscribe("enter", async (member) => {
      console.log("Client entered:", member.data);
      const clientData = {
        ...member.data,
        status: 'online' as const,
        lastSeen: new Date().toISOString()
      };
      
      setClients(prev => {
        const newClients = new Map(prev);
        newClients.set(member.clientId || '', clientData);
        return newClients;
      });
    });

    presenceChannel.presence.subscribe("leave", async (member) => {
      console.log('[Dashboard] Client left:', member.clientId);
      
      // DELAY removing from UI to allow disconnect message to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setClients(prev => {
        const newClients = new Map(prev);
        newClients.delete(member.clientId || '');
        console.log('[Dashboard] Removed from UI. Remaining clients:', newClients.size);
        return newClients;
      });
    });

    presenceChannel.presence.get().then((members) => {
      console.log("Current members:", members);
      const newClients = new Map<string, ClientData>();
      members?.forEach(member => {
        newClients.set(member.clientId || '', {
          ...member.data,
          status: 'online',
          lastSeen: new Date().toISOString()
        });
      });
      setClients(newClients);
    }).catch((err) => {
      console.error("Error getting presence:", err);
    });

    const statusChannel = ably.channels.get("smartadmin-status");
    statusChannel.subscribe("status-update", async (message: Ably.Message) => {
      const update = message.data as StatusUpdate;
      
      setClients(prev => {
        const newClients = new Map(prev);
        const client = newClients.get(update.clientId);
        if (client) {
          if (update.type === 'heartbeat') {
            newClients.set(update.clientId, {
              ...client,
              uptime: update.data.uptime,
              memory: update.data.memory,
              lastSeen: update.timestamp,
              status: 'online'
            });
          } else if (update.type === 'status') {
            newClients.set(update.clientId, {
              ...client,
              ...update.data,
              lastSeen: update.timestamp,
              status: 'online'
            });
          } else if (update.type === 'disconnecting') {
            console.log('[Dashboard] Client is disconnecting:', update.clientId);
            newClients.set(update.clientId, {
              ...client,
              status: 'offline',
              lastSeen: update.timestamp
            });
          }
        }
        return newClients;
      });
    });

    return () => {
      presenceChannel.presence.unsubscribe();
      statusChannel.unsubscribe();
    };
  }, []);

  const handleBanClient = async (clientIP: string, clientId: string) => {
    console.log('[Dashboard] Banning IP:', clientIP);
    
    try {
      const response = await fetch('/api/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ip',
          value: clientIP,
          reason: `Banned from dashboard for client: ${clientId}`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Dashboard] ✓ IP banned successfully');
        alert(`IP ${clientIP} has been banned successfully.\n\nThe client will be disconnected on next heartbeat or reconnection attempt.`);
        
        // Send shutdown command to disconnect the client
        const ably = getAblyClient();
        const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
        await controlChannel.publish("command", {
          command: 'shutdown',
          targetClientId: clientId,
          timestamp: new Date().toISOString()
        });
        
        // Remove from UI
        setClients(prev => {
          const newClients = new Map(prev);
          newClients.delete(clientId);
          return newClients;
        });
      } else {
        if (data.error.includes('already banned')) {
          alert(`This IP is already banned.`);
        } else {
          alert(`Failed to ban IP: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('[Dashboard] ✗ Error banning IP:', error);
      alert('Failed to ban IP. Please try again.');
    }
  };

  const getConnectionStatus = () => {
    switch (connectionState) {
      case 'connected':
        return { label: 'Online', desc: 'Receiving updates', color: 'green' };
      case 'connecting':
        return { label: 'Connecting', desc: 'Establishing connection', color: 'yellow' };
      case 'disconnected':
        return { label: 'Offline', desc: 'No connection', color: 'red' };
      case 'suspended':
        return { label: 'Suspended', desc: 'Connection paused', color: 'orange' };
      case 'failed':
        return { label: 'Failed', desc: 'Connection error', color: 'red' };
      default:
        return { label: 'Initializing', desc: 'Starting up', color: 'gray' };
    }
  };

  if (!mounted) {
    return null;
  }

  const status = getConnectionStatus();
  const clientsArray = Array.from(clients.values());

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-500" />
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">SmartAdmin Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              {mounted && (
                <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                    {currentTime.toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {currentTime.toLocaleDateString()}
                  </div>
                </div>
              )}
              <ThemeToggle />
              {mounted && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <div className={`w-3 h-3 rounded-full ${
                    status.color === 'green' ? 'bg-green-500 animate-pulse' :
                    status.color === 'yellow' ? 'bg-yellow-500 animate-pulse' :
                    status.color === 'orange' ? 'bg-orange-500' :
                    status.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{status.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{status.desc}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Monitor and control your clients in real-time</p>
        </div>

        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Connected Clients</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{clients.size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-sm text-green-500 font-semibold">Active</p>
            </div>
          </div>
        </div>

        {clientsArray.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
              <Activity className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">No clients connected</h3>
              <p className="text-gray-500 dark:text-gray-400">Waiting for clients to connect...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientsArray.map(client => (
              <ClientCard
                key={client.clientId}
                client={client}
                onBan={handleBanClient}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
