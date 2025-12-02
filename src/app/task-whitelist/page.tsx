"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  CheckCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

interface WhitelistEntry {
  id: string;
  type: 'ip' | 'email';
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface WhitelistAPIEntry {
  id: number;
  type: 'ip' | 'email';
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TaskWhitelistPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add new entry form
  const [newEntryType, setNewEntryType] = useState<'ip' | 'email'>('ip');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [newEntryDescription, setNewEntryDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit entry
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    setMounted(true);
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/task-whitelist');
      const data = await response.json();
      
      if (data.success) {
        const mappedEntries = data.data.map((entry: WhitelistAPIEntry) => ({
          id: entry.id.toString(),
          type: entry.type,
          value: entry.value,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        }));
        setEntries(mappedEntries);
        console.log('[Task Whitelist] Loaded', mappedEntries.length, 'entries');
      } else {
        console.error('[Task Whitelist] Failed to load:', data.error);
      }
    } catch (error) {
      console.error('[Task Whitelist] Error loading:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addEntry = async () => {
    if (!newEntryValue.trim()) return;
    
    setIsAdding(true);
    try {
      const response = await fetch('/api/task-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newEntryType,
          value: newEntryValue.trim(),
          description: newEntryDescription.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Task Whitelist] ✓ Entry added');
        setNewEntryValue('');
        setNewEntryDescription('');
        loadEntries();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Task Whitelist] Error adding:', error);
      alert('Failed to add entry');
    } finally {
      setIsAdding(false);
    }
  };

  const updateEntry = async (id: string, description: string) => {
    try {
      const response = await fetch('/api/task-whitelist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(id), description })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Task Whitelist] ✓ Entry updated');
        setEditingId(null);
        setEditDescription('');
        loadEntries();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Task Whitelist] Error updating:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to remove this whitelist entry?')) return;
    
    try {
      const response = await fetch(`/api/task-whitelist?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[Task Whitelist] ✓ Entry removed');
        loadEntries();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('[Task Whitelist] Error deleting:', error);
      alert('Failed to delete entry');
    }
  };

  const startEdit = (entry: WhitelistEntry) => {
    setEditingId(entry.id);
    setEditDescription(entry.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDescription('');
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
            <CheckCircle className="h-8 w-8 text-green-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Task Whitelist</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Manage approved emails and IPs for task access
          </p>
        </div>

        {/* Add New Entry */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Whitelist Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <select
                  value={newEntryType}
                  onChange={(e) => setNewEntryType(e.target.value as 'ip' | 'email')}
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
                  placeholder={newEntryType === 'ip' ? '192.168.1.1' : 'user@example.com'}
                  value={newEntryValue}
                  onChange={(e) => setNewEntryValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Description (Optional)
                </label>
                <Input
                  placeholder="Description"
                  value={newEntryDescription}
                  onChange={(e) => setNewEntryDescription(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addEntry}
                  disabled={isAdding || !newEntryValue.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Whitelist Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Whitelist Entries ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading entries...
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No whitelist entries yet
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={entry.type === 'ip' ? 'default' : 'secondary'}>
                            {entry.type.toUpperCase()}
                          </Badge>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {entry.value}
                          </span>
                        </div>
                        
                        {editingId === entry.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Textarea
                              placeholder="Description"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              className="flex-1"
                              rows={2}
                            />
                            <Button
                              size="sm"
                              onClick={() => updateEntry(entry.id, editDescription)}
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
                            {entry.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Description: {entry.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              Created: {formatTimestamp(entry.createdAt)}
                            </p>
                          </>
                        )}
                      </div>
                      
                      {editingId !== entry.id && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteEntry(entry.id)}
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