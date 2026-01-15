// File system agent using bash-tool (Vercel-style approach)
import { createBashTool } from 'bash-tool';
import { generateText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Credentials } from './types';

// Create LLM client based on provider
function createLLMClient(credentials: Credentials) {
  switch (credentials.llmProvider) {
    case 'openai':
      return createOpenAI({ apiKey: credentials.llmApiKey });
    case 'anthropic':
      return createAnthropic({ apiKey: credentials.llmApiKey });
    case 'google':
      return createGoogleGenerativeAI({ apiKey: credentials.llmApiKey });
    default:
      throw new Error(`Unknown LLM provider: ${credentials.llmProvider}`);
  }
}

// Get model ID based on provider and optional override
function getModelId(provider: Credentials['llmProvider'], modelOverride?: string): string {
  if (modelOverride) {
    return modelOverride;
  }
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-sonnet-4-20250514';
    case 'google':
      return 'gemini-3-pro-preview';
    default:
      return 'gpt-4o-mini';
  }
}

const SYSTEM_PROMPT = `You are an expert SQL analyst. Your job is to help users query their database using natural language.

You have access to a virtual file system containing the database schema. Use bash commands to explore it:
- \`ls schema/\` - List available schema files
- \`ls schema/tables/\` - List all table files
- \`cat schema/overview.md\` - Read the schema overview
- \`cat schema/tables/[table_name].md\` - Read details about a specific table
- \`cat schema/summary.md\` - Quick reference of all tables and columns
- \`grep "column_name" schema/\` - Search for specific columns

WORKFLOW:
1. First, explore the schema to understand the database structure
2. Identify which tables are relevant to the user's question
3. Generate a valid SQL query (PostgreSQL syntax)
4. Explain your reasoning

OUTPUT FORMAT:
After exploring the schema, provide your response in this format:

**Explanation:** [Brief explanation of what the query does]

**SQL Query:**
\`\`\`sql
[Your SQL query here]
\`\`\`

IMPORTANT RULES:
- Only generate SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
- Use proper PostgreSQL syntax
- Include appropriate JOINs when querying related tables
- Use meaningful column aliases for clarity
- Limit results to 100 rows unless the user specifies otherwise
- For text comparisons with names, cities, or other text that might have accents, use unaccent() for accent-insensitive matching. Example: WHERE unaccent(lower(city_name)) = unaccent(lower('Bogota'))`;

export interface AgentResponse {
  explanation: string;
  sql: string;
  steps: string[];
}

// Create query agent with bash-tool
export async function createQueryAgent(
  schemaFiles: Record<string, string>,
  credentials: Credentials
) {
  // bash-tool returns tools WITH execute functions built-in
  const { tools } = await createBashTool({
    files: schemaFiles,
  });

  const client = createLLMClient(credentials);
  const modelId = getModelId(credentials.llmProvider, credentials.llmModel);

  return {
    async query(question: string): Promise<AgentResponse> {
      // Use generateText with stopWhen - SDK handles tool execution automatically
      const result = await generateText({
        model: client(modelId),
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user' as const, content: question }],
        tools,
        stopWhen: stepCountIs(10), // Allow up to 10 steps of tool calling
      });

      // Extract steps from result.steps array
      const steps: string[] = [];
      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              // Type-safe access to tool call properties
              const tc = toolCall as { toolName?: string; args?: { command?: string; path?: string } };
              if (tc.toolName === 'bash' && tc.args?.command) {
                steps.push(`$ ${tc.args.command}`);
              } else if (tc.toolName === 'readFile' && tc.args?.path) {
                steps.push(`$ cat ${tc.args.path}`);
              } else if (tc.toolName) {
                steps.push(`[${tc.toolName}] executed`);
              }
            }
          }
        }
      }

      const finalResponse = result.text;

      // Parse the response to extract SQL and explanation
      const sqlMatch = finalResponse.match(/```sql\n([\s\S]*?)```/);
      const sql = sqlMatch ? sqlMatch[1].trim() : '';

      const explanationMatch = finalResponse.match(/\*\*Explanation:\*\*\s*([\s\S]*?)(?=\*\*SQL Query:|$)/);
      const explanation = explanationMatch
        ? explanationMatch[1].trim()
        : finalResponse.split('```')[0].trim();

      return {
        explanation,
        sql,
        steps,
      };
    },
  };
}

// Validate that SQL is a SELECT query only (read-only protection)
export function validateSqlQuery(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    return {
      valid: false,
      error: 'Only SELECT queries are allowed. Query must start with SELECT or WITH.',
    };
  }

  // Check for dangerous keywords using word boundaries
  const dangerousKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER',
    'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC', 'CALL',
    'SET', 'COPY', 'LOAD', 'VACUUM', 'REINDEX', 'CLUSTER'
  ];

  for (const keyword of dangerousKeywords) {
    // Use word boundary regex to catch all variations
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(trimmed)) {
      return {
        valid: false,
        error: `Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.`,
      };
    }
  }

  // Block multiple statements (SQL injection prevention)
  // Count semicolons not inside strings
  const withoutStrings = trimmed.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  if (withoutStrings.includes(';')) {
    return {
      valid: false,
      error: 'Multiple SQL statements are not allowed.',
    };
  }

  // Block comment-based injection attempts
  if (trimmed.includes('--') || trimmed.includes('/*')) {
    return {
      valid: false,
      error: 'SQL comments are not allowed.',
    };
  }

  return { valid: true };
}
