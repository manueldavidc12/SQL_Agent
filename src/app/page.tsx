'use client';

import { useState, useEffect } from 'react';
import { ConnectionForm } from '@/components/connection-form';
import { QueryInterface } from '@/components/query-interface';
import { Credentials, SchemaInfo } from '@/lib/types';
import {
  saveCredentials,
  getCredentials,
  clearCredentials,
  saveSchema,
  getSchema,
} from '@/lib/storage';
import { Database, Github } from 'lucide-react';

export default function Home() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    setMounted(true);
    const savedCredentials = getCredentials();
    const savedSchema = getSchema();
    if (savedCredentials && savedSchema) {
      setCredentials(savedCredentials);
      setSchema(savedSchema);
    }
  }, []);

  const handleConnect = (creds: Credentials, schemaInfo: SchemaInfo) => {
    setCredentials(creds);
    setSchema(schemaInfo);
    saveCredentials(creds);
    saveSchema(schemaInfo);
  };

  const handleDisconnect = () => {
    setCredentials(null);
    setSchema(null);
    clearCredentials();
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Show query interface if connected
  if (credentials && schema) {
    return (
      <QueryInterface
        credentials={credentials}
        schema={schema}
        onDisconnect={handleDisconnect}
      />
    );
  }

  // Show landing page with connection form
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-neutral-700" />
            <span className="font-semibold text-neutral-900">Query Agent</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Hero Text */}
          <div className="text-center mb-10">
            <h1 className="text-2xl font-semibold text-neutral-900 mb-3">
              Query your database with natural language
            </h1>
            <p className="text-neutral-500 text-sm">
              Connect your Supabase project, ask questions in plain English, and get instant SQL queries with results.
            </p>
          </div>

          {/* Connection Form */}
          <ConnectionForm onConnect={handleConnect} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6">
        <p className="text-center text-xs text-neutral-400">
          Your credentials are stored locally in your browser and never sent to our servers.
        </p>
      </footer>
    </div>
  );
}
