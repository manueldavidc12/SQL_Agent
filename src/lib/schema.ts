// Schema introspection from user's Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SchemaInfo, TableInfo, ColumnInfo, ForeignKeyInfo } from './types';

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey);
}

export async function fetchSchema(supabase: SupabaseClient): Promise<SchemaInfo> {
  // Fetch tables
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables' as never)
    .select('table_schema, table_name, table_type')
    .in('table_schema', ['public'])
    .in('table_type', ['BASE TABLE', 'VIEW']);

  if (tablesError) {
    // Fallback: use raw SQL query via RPC or direct query
    let tablesResult = null;
    try {
      const rpcResult = await supabase.rpc('get_tables_info');
      tablesResult = rpcResult.data;
    } catch {
      // RPC not available
    }
    if (!tablesResult) {
      throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    }
  }

  // Fetch columns
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns' as never)
    .select('table_schema, table_name, column_name, data_type, is_nullable, column_default, character_maximum_length')
    .eq('table_schema', 'public');

  if (columnsError) {
    throw new Error(`Failed to fetch columns: ${columnsError.message}`);
  }

  // Fetch foreign keys (this query is more complex)
  const foreignKeysQuery = `
    SELECT
      tc.constraint_name,
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `;

  // Try to execute via RPC or fall back to empty array
  let foreignKeys: ForeignKeyInfo[] = [];
  try {
    const { data: fkData } = await supabase.rpc('execute_sql', { query: foreignKeysQuery });
    if (fkData) {
      foreignKeys = fkData as ForeignKeyInfo[];
    }
  } catch {
    // Foreign keys are optional, continue without them
    console.warn('Could not fetch foreign keys');
  }

  return {
    tables: (tables || []) as TableInfo[],
    columns: (columns || []) as ColumnInfo[],
    foreignKeys,
  };
}

// Alternative: Fetch schema via PostgREST introspection endpoint
export async function fetchSchemaViaRest(supabaseUrl: string, anonKey: string): Promise<SchemaInfo> {
  // Use the OpenAPI spec endpoint to get schema info
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch schema from REST endpoint');
  }

  const openApiSpec = await response.json();

  // Parse OpenAPI spec to extract table info
  const tables: TableInfo[] = [];
  const columns: ColumnInfo[] = [];

  if (openApiSpec.definitions) {
    for (const [tableName, definition] of Object.entries(openApiSpec.definitions)) {
      // Skip internal tables
      if (tableName.startsWith('_')) continue;

      tables.push({
        table_schema: 'public',
        table_name: tableName,
        table_type: 'BASE TABLE',
      });

      const def = definition as { properties?: Record<string, { type?: string; format?: string; description?: string }> };
      if (def.properties) {
        for (const [columnName, columnDef] of Object.entries(def.properties)) {
          columns.push({
            table_schema: 'public',
            table_name: tableName,
            column_name: columnName,
            data_type: columnDef.format || columnDef.type || 'unknown',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: null,
          });
        }
      }
    }
  }

  return {
    tables,
    columns,
    foreignKeys: [],
  };
}

// Convert schema to files for the agent
export function schemaToFiles(schema: SchemaInfo): Record<string, string> {
  const files: Record<string, string> = {};

  // Create overview file
  let overview = '# Database Schema Overview\n\n';
  overview += '## Tables\n\n';
  for (const table of schema.tables) {
    overview += `- ${table.table_name} (${table.table_type})\n`;
  }
  files['schema/overview.md'] = overview;

  // Create individual table files
  for (const table of schema.tables) {
    const tableColumns = schema.columns.filter(c => c.table_name === table.table_name);
    const tableFKs = schema.foreignKeys.filter(fk => fk.table_name === table.table_name);

    let content = `# Table: ${table.table_name}\n\n`;
    content += `Type: ${table.table_type}\n`;
    content += `Schema: ${table.table_schema}\n\n`;

    content += '## Columns\n\n';
    content += '| Column | Type | Nullable | Default |\n';
    content += '|--------|------|----------|--------|\n';

    for (const col of tableColumns) {
      const nullable = col.is_nullable === 'YES' ? 'Yes' : 'No';
      const defaultVal = col.column_default || '-';
      content += `| ${col.column_name} | ${col.data_type} | ${nullable} | ${defaultVal} |\n`;
    }

    if (tableFKs.length > 0) {
      content += '\n## Foreign Keys\n\n';
      for (const fk of tableFKs) {
        content += `- ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}\n`;
      }
    }

    files[`schema/tables/${table.table_name}.md`] = content;
  }

  // Create relationships file
  if (schema.foreignKeys.length > 0) {
    let relationships = '# Table Relationships\n\n';
    relationships += '## Foreign Key Relationships\n\n';

    for (const fk of schema.foreignKeys) {
      relationships += `- ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}\n`;
    }

    files['schema/relationships.md'] = relationships;
  }

  // Create a summary for quick reference
  let summary = '# Quick Reference\n\n';
  summary += '## All Tables and Columns\n\n';

  for (const table of schema.tables) {
    const tableColumns = schema.columns.filter(c => c.table_name === table.table_name);
    summary += `### ${table.table_name}\n`;
    summary += tableColumns.map(c => `- ${c.column_name} (${c.data_type})`).join('\n');
    summary += '\n\n';
  }

  files['schema/summary.md'] = summary;

  return files;
}
