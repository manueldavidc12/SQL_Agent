// Types for the application

export interface Credentials {
  supabaseUrl: string;
  supabaseAnonKey: string;
  llmProvider: 'openai' | 'anthropic' | 'google';
  llmModel?: string; // Optional model override
  llmApiKey: string;
}

export interface TableInfo {
  table_schema: string;
  table_name: string;
  table_type: string;
}

export interface ColumnInfo {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

export interface ForeignKeyInfo {
  constraint_name: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

export interface SchemaInfo {
  tables: TableInfo[];
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export interface QueryResult {
  success: boolean;
  sql?: string;
  data?: Record<string, unknown>[];
  error?: string;
  explanation?: string;
}
