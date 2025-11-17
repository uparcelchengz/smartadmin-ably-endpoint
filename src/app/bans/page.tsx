"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  Shield, 
  Plus,
  Trash2,
  Edit2,
  Save,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Ban {
  _id: string;
  type: 'ip' | 'email';
  value: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export default function BansPage() {
  const router = useRouter();
  const [bans, setBans] = useState<Ban[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add new ban form
  const [newBanType, setNewBanType] = useState<'ip' | 'email'>('ip');
  const [newBanValue, setNewBanValue] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit ban
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    setMounted(true);
    loadBans();
  }, []);

  const loadBans = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/bans');
      const data = await response.json();
      
      if (data.success) {
        setBans(data.data);
        console.log('[Bans] Loaded', data.count, 'bans');
      } else {
        console.error('[Bans] Failed to load:', data.error);
      }
    } catch (error) {
      console.error('[Bans] Error loading:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBan = async () => {
    if (!newBanValue.trim()) return;
    
    setIsAdding(true);
    try {
      const response = await fetch('/api/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newBanType,
          value: newBanValue.trim(),
          reason: newBanReason.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Bans] ✓ Ban added');
        setNewBanValue('');
        setNewBanReason('');
        loadBans();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Bans] Error adding:', error);
      alert('Failed to add ban');
    } finally {
      setIsAdding(false);
    }
  };

  const updateBan = async (id: string, reason: string) => {
    try {
      const response = await fetch('/api/bans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Bans] ✓ Ban updated');
        setEditingId(null);
        setEditReason('');
        loadBans();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Bans] Error updating:', error);
      alert('Failed to update ban');
    }
  };

  const deleteBan = async (id: string) => {
    if (!confirm('Are you sure you want to remove this ban?')) return;
    
    try {
      const response = await fetch(`/api/bans?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Bans] ✓ Ban removed');
        loadBans();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Bans] Error deleting:', error);
      alert('Failed to delete ban');
    }
  };

  const startEdit = (ban: Ban) => {
    setEditingId(ban._id);
    setEditReason(ban.reason || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditReason('');
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
            <Shield className="h-8 w-8 text-red-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Ban Management</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Manage banned IPs and emails
          </p>
        </div>

        {/* Add New Ban */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Ban
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <select
                  value={newBanType}
                  onChange={(e) => setNewBanType(e.target.value as 'ip' | 'email')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="ip">IP Address</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Value *
                </label>
                <Input
                  placeholder={newBanType === 'ip' ? '192.168.1.1' : 'user@example.com'}
                  value={newBanValue}
                  onChange={(e) => setNewBanValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Reason (Optional)
                </label>
                <Input
                  placeholder="Spam, abuse, etc."
                  value={newBanReason}
                  onChange={(e) => setNewBanReason(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addBan}
                  disabled={isAdding || !newBanValue.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ban
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bans List */}
        <Card>
          <CardHeader>
            <CardTitle>Banned List ({bans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading bans...
              </div>
            ) : bans.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No bans yet
              </div>
            ) : (
              <div className="space-y-3">
                {bans.map((ban) => (
                  <div
                    key={ban._id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={ban.type === 'ip' ? 'default' : 'secondary'}>
                            {ban.type.toUpperCase()}
                          </Badge>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {ban.value}
                          </span>
                        </div>
                        
                        {editingId === ban._id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              placeholder="Reason"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={() => updateBan(ban._id, editReason)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            {ban.reason && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Reason: {ban.reason}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              Created: {formatTimestamp(ban.createdAt)}
                            </p>
                          </>
                        )}
                      </div>
                      
                      {editingId !== ban._id && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(ban)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteBan(ban._id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
