// localStorage helpers for credentials
import { Credentials, SchemaInfo } from './types';

const CREDENTIALS_KEY = 'supabase-query-agent-credentials';
const SCHEMA_KEY = 'supabase-query-agent-schema';

export function saveCredentials(credentials: Credentials): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function getCredentials(): Credentials | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CREDENTIALS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Credentials;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CREDENTIALS_KEY);
  localStorage.removeItem(SCHEMA_KEY);
}

export function saveSchema(schema: SchemaInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SCHEMA_KEY, JSON.stringify(schema));
}

export function getSchema(): SchemaInfo | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(SCHEMA_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as SchemaInfo;
  } catch {
    return null;
  }
}

export function hasCredentials(): boolean {
  return getCredentials() !== null;
}
