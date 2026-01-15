import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/schema';
import { schemaToFiles } from '@/lib/schema';
import { createQueryAgent, validateSqlQuery } from '@/lib/agent';
import { Credentials, SchemaInfo } from '@/lib/types';

export const maxDuration = 60; // Allow up to 60 seconds for agent execution

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, credentials, schema } = body as {
      question: string;
      credentials: Credentials;
      schema: SchemaInfo;
    };

    if (!question || !credentials || !schema) {
      return NextResponse.json(
        { error: 'Missing question, credentials, or schema' },
        { status: 400 }
      );
    }

    // Convert schema to files for the agent
    const schemaFiles = schemaToFiles(schema);

    // Create the agent
    const agent = await createQueryAgent(schemaFiles, credentials);

    // Run the agent to generate SQL
    const result = await agent.query(question);

    // Check if SQL was extracted
    if (!result.sql || result.sql.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Could not extract SQL from the response. Please try rephrasing your question.',
        explanation: result.explanation,
        steps: result.steps,
      });
    }

    // Validate the generated SQL
    const validation = validateSqlQuery(result.sql);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: validation.error,
        explanation: result.explanation,
        sql: result.sql,
        steps: result.steps,
      });
    }

    // Execute the query on user's Supabase
    const supabase = createSupabaseClient(
      credentials.supabaseUrl,
      credentials.supabaseAnonKey
    );

    // Execute using the Supabase client's raw SQL capability
    // Note: This requires the user to have appropriate permissions
    let data = null;
    let executeError: { message: string } | null = null;

    try {
      // Remove trailing semicolon - it breaks the RPC function's subquery wrapper
      const cleanSql = result.sql.trim().replace(/;+$/, '');

      const rpcResult = await supabase.rpc('execute_query', {
        query_text: cleanSql,
      });
      data = rpcResult.data;
      if (rpcResult.error) {
        console.error('RPC Error:', rpcResult.error);
        executeError = { message: rpcResult.error.message };
      }
    } catch (err) {
      console.error('RPC Exception:', err);
      executeError = { message: 'RPC not available' };
    }

    if (executeError) {
      // RPC not available - return SQL only with error details
      return NextResponse.json({
        success: true,
        explanation: result.explanation,
        sql: result.sql,
        steps: result.steps,
        data: null,
        note: `SQL generated successfully. RPC error: ${executeError.message}. To execute queries directly, set up an execute_query RPC function in your Supabase project.`,
      });
    }

    return NextResponse.json({
      success: true,
      explanation: result.explanation,
      sql: result.sql,
      steps: result.steps,
      data,
    });
  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process query'
      },
      { status: 500 }
    );
  }
}
