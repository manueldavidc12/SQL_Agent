'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Credentials, SchemaInfo } from '@/lib/types';
import { Loader2, AlertCircle } from 'lucide-react';

interface ConnectionFormProps {
  onConnect: (credentials: Credentials, schema: SchemaInfo) => void;
}

// Model options per provider
const MODEL_OPTIONS = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)' },
    { id: 'gpt-4o', name: 'GPT-4o (More Capable)' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Balanced)' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5 (Most Capable)' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast)' },
    { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro (Most Capable)' },
  ],
};

export function ConnectionForm({ onConnect }: ConnectionFormProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [llmProvider, setLlmProvider] = useState<Credentials['llmProvider']>('openai');
  const [llmModel, setLlmModel] = useState<string>('gpt-4o-mini');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // Update model when provider changes
  const handleProviderChange = (provider: Credentials['llmProvider']) => {
    setLlmProvider(provider);
    setLlmModel(MODEL_OPTIONS[provider][0].id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatus('Connecting to your Supabase project...');

    try {
      // Fetch schema from user's Supabase
      setStatus('Fetching database schema...');
      const response = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, supabaseAnonKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setStatus('Schema loaded successfully!');

      const credentials: Credentials = {
        supabaseUrl,
        supabaseAnonKey,
        llmProvider,
        llmModel,
        llmApiKey,
      };

      onConnect(credentials, data.schema);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabaseUrl">Supabase Project URL</Label>
            <Input
              id="supabaseUrl"
              type="url"
              placeholder="https://your-project.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Found in your Supabase project settings → API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabaseAnonKey">Supabase Anon Key</Label>
            <Input
              id="supabaseAnonKey"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              The &quot;anon&quot; public key from your project settings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmProvider">LLM Provider</Label>
            <Select value={llmProvider} onValueChange={(v) => handleProviderChange(v as Credentials['llmProvider'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmModel">Model</Label>
            <Select value={llmModel} onValueChange={setLlmModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS[llmProvider].map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmApiKey">LLM API Key</Label>
            <Input
              id="llmApiKey"
              type="password"
              placeholder={
                llmProvider === 'openai' ? 'sk-...' :
                llmProvider === 'anthropic' ? 'sk-ant-...' :
                'AI...'
              }
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Your API key from{' '}
              {llmProvider === 'openai' && 'OpenAI'}
              {llmProvider === 'anthropic' && 'Anthropic'}
              {llmProvider === 'google' && 'Google AI Studio'}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {status && !error && loading && (
            <div className="flex items-center gap-2 text-sm text-neutral-600 bg-neutral-50 p-3 rounded-md border border-neutral-200">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              {status}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
        </form>
    </div>
  );
}
