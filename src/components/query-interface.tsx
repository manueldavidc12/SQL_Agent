'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Credentials, SchemaInfo } from '@/lib/types';
import {
  Send,
  Loader2,
  AlertCircle,
  Database,
  Code2,
  Copy,
  LogOut,
  Table as TableIcon,
  Terminal,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from 'lucide-react';

interface QueryInterfaceProps {
  credentials: Credentials;
  schema: SchemaInfo;
  onDisconnect: () => void;
}

interface QueryResponse {
  success: boolean;
  explanation?: string;
  sql?: string;
  steps?: string[];
  data?: Record<string, unknown>[];
  error?: string;
  note?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: QueryResponse;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

export function QueryInterface({ credentials, schema, onDisconnect }: QueryInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversationId]);

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New conversation',
      messages: [],
      createdAt: new Date(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const toggleSteps = (messageId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    let conversationId = activeConversationId;

    if (!conversationId) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: input.slice(0, 40) + (input.length > 40 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
      };
      setConversations(prev => [newConversation, ...prev]);
      conversationId = newConversation.id;
      setActiveConversationId(conversationId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setConversations(prev => prev.map(c => {
      if (c.id === conversationId) {
        const isFirstMessage = c.messages.length === 0;
        return {
          ...c,
          title: isFirstMessage ? input.slice(0, 40) + (input.length > 40 ? '...' : '') : c.title,
          messages: [...c.messages, userMessage],
        };
      }
      return c;
    }));

    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input, credentials, schema }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.explanation || (data.error ? `Error: ${data.error}` : 'Query executed'),
        response: data,
        timestamp: new Date(),
      };

      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return { ...c, messages: [...c.messages, assistantMessage] };
        }
        return c;
      }));
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Failed to process query',
        response: { success: false, error: err instanceof Error ? err.message : 'Failed to process query' },
        timestamp: new Date(),
      };

      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return { ...c, messages: [...c.messages, errorMessage] };
        }
        return c;
      }));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-white">
      {/* Sidebar */}
      <aside
        className={`
          h-full border-r border-neutral-200 flex flex-col bg-neutral-50/50
          transition-all duration-200 ease-in-out
          ${sidebarCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-64'}
        `}
      >
        {/* New Conversation Button */}
        <div className="p-3">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New conversation</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-8 px-4">
              No conversations yet
            </p>
          ) : (
            <div className="space-y-0.5">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`
                    group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm
                    ${activeConversationId === conv.id
                      ? 'bg-neutral-200/70 text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-100'
                    }
                  `}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-200 rounded transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-neutral-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schema Section */}
        <div className="border-t border-neutral-200">
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            {showSchema ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <TableIcon className="h-4 w-4 opacity-60" />
            <span>Schema</span>
            <span className="ml-auto text-xs text-neutral-400">{schema.tables.length}</span>
          </button>
          {showSchema && (
            <div className="px-4 pb-3 max-h-48 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {schema.tables.map((table) => (
                  <span
                    key={table.table_name}
                    className="inline-flex px-2 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded"
                  >
                    {table.table_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 p-3">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-500">
            <Database className="h-3.5 w-3.5" />
            <span className="truncate">{credentials.llmModel || credentials.llmProvider}</span>
          </div>
          <button
            onClick={onDisconnect}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors mt-1"
          >
            <LogOut className="h-4 w-4 opacity-60" />
            <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Bar */}
        <header className="h-12 flex-shrink-0 flex items-center px-4 border-b border-neutral-200">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors mr-3"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-700">Query Agent</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-neutral-400">{schema.tables.length} tables</span>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full">
            {/* Welcome Header - Always visible */}
            <div className="py-12 px-6 text-center border-b border-neutral-100">
              <h1 className="text-xl font-semibold text-neutral-800 mb-1">
                Query your database
              </h1>
              <p className="text-neutral-500 text-sm mb-6">
                Ask questions in plain English and get SQL queries with results
              </p>
              {(!activeConversation || activeConversation.messages.length === 0) && (
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Show me all tables",
                    "Count records per table",
                    "Recent entries"
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="px-3 py-1.5 text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Messages */}
            {activeConversation && activeConversation.messages.length > 0 && (
              <div>
              {activeConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`px-6 py-6 ${message.role === 'assistant' ? 'bg-neutral-50/50' : ''}`}
                >
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium
                      ${message.role === 'user'
                        ? 'bg-neutral-200 text-neutral-600'
                        : 'bg-emerald-100 text-emerald-700'
                      }
                    `}>
                      {message.role === 'user' ? 'Y' : 'Q'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-4">
                      {/* Message Text */}
                      <p className="text-neutral-800 text-[15px] leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>

                      {/* Response Details */}
                      {message.response && message.role === 'assistant' && (
                        <div className="space-y-4">
                          {/* Steps (Collapsible) */}
                          {message.response.steps && message.response.steps.length > 0 && (
                            <div>
                              <button
                                onClick={() => toggleSteps(message.id)}
                                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                              >
                                {expandedSteps.has(message.id) ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                <Terminal className="h-3 w-3" />
                                <span>{message.response.steps.length} steps</span>
                              </button>
                              {expandedSteps.has(message.id) && (
                                <div className="mt-2 pl-4 border-l-2 border-neutral-200 space-y-1">
                                  {message.response.steps.map((step, i) => (
                                    <code key={i} className="block text-xs text-neutral-500 font-mono">
                                      {step.replace(/^\$\s*/, '$ ')}
                                    </code>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* SQL */}
                          {message.response.sql && (
                            <div className="rounded-lg border border-neutral-200 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2 bg-neutral-100 border-b border-neutral-200">
                                <div className="flex items-center gap-2 text-xs text-neutral-600">
                                  <Code2 className="h-3.5 w-3.5" />
                                  <span>SQL</span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(message.response!.sql!, message.id)}
                                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                                >
                                  {copiedId === message.id ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-4 overflow-x-auto bg-neutral-50 text-sm text-neutral-800 font-mono">
                                {message.response.sql}
                              </pre>
                            </div>
                          )}

                          {/* Note */}
                          {message.response.note && (
                            <div className="flex gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>{message.response.note}</span>
                            </div>
                          )}

                          {/* Error */}
                          {message.response.error && !message.response.success && (
                            <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>{message.response.error}</span>
                            </div>
                          )}

                          {/* Results Table */}
                          {message.response.data && message.response.data.length > 0 && (
                            <div className="rounded-lg border border-neutral-200 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2 bg-neutral-100 border-b border-neutral-200">
                                <div className="flex items-center gap-2 text-xs text-neutral-600">
                                  <TableIcon className="h-3.5 w-3.5" />
                                  <span>Results</span>
                                </div>
                                <span className="text-xs text-neutral-500">
                                  {message.response.data.length} rows
                                </span>
                              </div>
                              <div className="overflow-x-auto max-h-80">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                                      {Object.keys(message.response.data[0]).map((key) => (
                                        <TableHead
                                          key={key}
                                          className="text-xs font-semibold text-neutral-700 whitespace-nowrap h-10"
                                        >
                                          {key}
                                        </TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {message.response.data.slice(0, 50).map((row, i) => (
                                      <TableRow key={i} className="hover:bg-neutral-50">
                                        {Object.values(row).map((value, j) => (
                                          <TableCell
                                            key={j}
                                            className="text-sm text-neutral-700 whitespace-nowrap py-2"
                                          >
                                            {value === null ? (
                                              <span className="text-neutral-400">null</span>
                                            ) : (
                                              String(value)
                                            )}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {message.response.data.length > 50 && (
                                <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
                                  Showing 50 of {message.response.data.length} rows
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

                {/* Loading */}
                {loading && (
                  <div className="px-6 py-6 bg-neutral-50/50">
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                        Q
                      </div>
                      <div className="flex items-center gap-2 text-neutral-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-neutral-200 p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 border border-neutral-300 rounded-xl px-4 py-3 bg-white focus-within:border-neutral-400 focus-within:ring-1 focus-within:ring-neutral-400 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your data..."
                rows={1}
                className="flex-1 resize-none text-[15px] text-neutral-800 placeholder-neutral-400 bg-transparent border-0 focus:outline-none focus:ring-0 max-h-32 min-h-[24px]"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-neutral-400 text-center mt-2">
              Enter to send · Shift + Enter for new line
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
