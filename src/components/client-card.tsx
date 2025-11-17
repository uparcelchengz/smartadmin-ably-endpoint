"use client";

import { ClientData } from "@/types/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Monitor, Clock, Activity, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface ClientCardProps {
  client: ClientData;
  onQuickAction?: (clientId: string, action: string) => void;
  onBan?: (clientIP: string, clientId: string) => void;
}

export function ClientCard({ client, onBan }: ClientCardProps) {
  const [isBanning, setIsBanning] = useState(false);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'default';
      case 'offline': return 'secondary';
      case 'idle': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleBan = async () => {
    if (!confirm(`Are you sure you want to ban IP: ${client.clientIP}?\n\nThis will prevent this client from connecting.`)) {
      return;
    }

    setIsBanning(true);
    try {
      if (onBan) {
        await onBan(client.clientIP, client.clientId);
      }
    } finally {
      setIsBanning(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg dark:text-white">{client.hostname}</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{client.clientId}</p>
          </div>
          <Badge variant={getStatusColor(client.status)} className={client.status === 'online' ? 'bg-green-500' : ''}>
            {client.status || 'unknown'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="dark:text-gray-300">{client.clientIP}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="dark:text-gray-300">{client.clientTimezone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="dark:text-gray-300">{client.platform}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="dark:text-gray-300">{formatUptime(client.uptime)}</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Link href={`/client/${encodeURIComponent(client.clientId)}`} className="flex-1">
              <Button size="sm" variant="default" className="w-full">
                Details
              </Button>
            </Link>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBan}
              disabled={isBanning}
              className="gap-1"
            >
              <Shield className="h-3 w-3" />
              Ban
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
