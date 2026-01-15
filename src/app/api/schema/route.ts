import { NextRequest, NextResponse } from 'next/server';
import { fetchSchemaViaRest } from '@/lib/schema';

export async function POST(request: NextRequest) {
  try {
    const { supabaseUrl, supabaseAnonKey } = await request.json();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Missing supabaseUrl or supabaseAnonKey' },
        { status: 400 }
      );
    }

    // Fetch schema from user's Supabase
    const schema = await fetchSchemaViaRest(supabaseUrl, supabaseAnonKey);

    return NextResponse.json({ schema });
  } catch (error) {
    console.error('Schema fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch schema' },
      { status: 500 }
    );
  }
}
