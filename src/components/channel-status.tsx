"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Clock, Settings, CheckCircle, AlertCircle } from "lucide-react";

interface ChannelRule {
  pattern: string;
  options: {
    history?: {
      enabled: boolean;
      ttl: number;
    };
  };
}

export function ChannelStatus() {
  const [rules, setRules] = useState<ChannelRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const loadChannelRules = async () => {
    setIsLoading(true);
    try {
      console.log('[ChannelStatus] Loading channel rules...');
      const response = await fetch('/api/ably/channel-rules');
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data || []);
        console.log(`[ChannelStatus] ✓ Loaded ${data.data?.length || 0} channel rules`);
      } else {
        console.error('[ChannelStatus] Failed to load rules:', data.error);
      }
    } catch (error) {
      console.error('[ChannelStatus] Error loading channel rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupChannelRules = async () => {
    setIsConfiguring(true);
    try {
      console.log('[ChannelStatus] Setting up 72-hour retention...');
      const response = await fetch('/api/ably/channel-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: 'smartadmin-*',
          ttlHours: 72 // Maximum 72 hours
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[ChannelStatus] ✓ Channel rules configured successfully');
        alert('✅ Channel rules configured for 72-hour message retention!\n\n• Recent messages: Fast access via Ably\n• Older messages: Long-term storage in MongoDB\n• Auto-logging: All messages saved automatically');
        loadChannelRules();
      } else {
        console.error('[ChannelStatus] Setup failed:', data.error);
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      console.error('[ChannelStatus] Error setting up channel rules:', error);
      alert('❌ Failed to setup channel rules. Please check console for details.');
    } finally {
      setIsConfiguring(false);
    }
  };

  useEffect(() => {
    loadChannelRules();
  }, []);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} (${hours}h)`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const hasSmartAdminRule = rules.some(rule => 
    rule.pattern.includes('smartadmin') && rule.options.history?.enabled
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Message Retention Status
          {hasSmartAdminRule && (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            Loading channel configuration...
          </div>
        ) : rules.length === 0 || !hasSmartAdminRule ? (
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Enhanced Message Retention Available</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
              Currently using default 2-minute retention. Configure extended storage for better message history and persistence.
            </p>
            
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-4">
              <h4 className="font-medium mb-2">🚀 What you&apos;ll get:</h4>
              <ul className="text-sm text-left space-y-1 max-w-sm mx-auto">
                <li>• <strong>72-hour Ably retention</strong> - Fast access to recent messages</li>
                <li>• <strong>Unlimited PostgreSQL storage</strong> - Long-term message history</li>
                <li>• <strong>Automatic message logging</strong> - All commands & status updates</li>
                <li>• <strong>Hybrid loading strategy</strong> - Best performance & coverage</li>
                <li>• <strong>Message recovery on reconnect</strong> - No lost commands</li>
              </ul>
            </div>
            
            <Button 
              onClick={setupChannelRules} 
              disabled={isConfiguring}
              className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isConfiguring ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Setting up...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4" />
                  Setup Enhanced Retention
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule, index) => (
              <div key={index} className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">
                      {rule.pattern}
                    </Badge>
                    {rule.options.history?.enabled && (
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        History Enabled
                      </Badge>
                    )}
                  </div>
                </div>
                
                {rule.options.history?.ttl && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Ably Retention:</span>
                    <span className="text-green-700 dark:text-green-400">
                      {formatDuration(rule.options.history.ttl)}
                    </span>
                  </div>
                )}
                
                <div className="text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-800/30 rounded px-2 py-1">
                  📊 Enhanced message persistence active - Recent messages via Ably, unlimited history via PostgreSQL
                </div>
              </div>
            ))}
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-400 mb-2">
                🎯 How it works:
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>• <strong>Real-time messaging:</strong> Immediate delivery via Ably channels</p>
                <p>• <strong>Recent history:</strong> Fast access to last 72 hours via Ably</p>
                <p>• <strong>Long-term storage:</strong> Unlimited history in PostgreSQL</p>
                <p>• <strong>Smart loading:</strong> Client details load from both sources</p>
                <p>• <strong>Auto-recovery:</strong> Clients get recent messages on reconnect</p>
              </div>
            </div>
            
            <div className="text-center pt-2">
              <Button 
                variant="outline" 
                onClick={loadChannelRules}
                className="gap-2"
                disabled={isLoading}
              >
                🔄 Refresh Status
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}