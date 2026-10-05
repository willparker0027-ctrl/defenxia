import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { getOrCreateSessionId } from './session';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qooankzjqkgrwctvkysq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvb2Fua3pqcWtncndjdHZreXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTEyOTcsImV4cCI6MjA3MTk2NzI5N30.0010JiD7mG1We0F5IbF3ERywKEjC9mtkSBi_Wqg-s2Y";

// Create a Supabase client
export const supabaseWithSession = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper function to invoke edge functions with session ID
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: any
): Promise<{ data: T | null; error: any }> {
  const sessionId = getOrCreateSessionId();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'x-session-id': sessionId,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      return { data: null, error };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Helper to insert data with session ID
export async function insertWithSession<T extends keyof Database['public']['Tables']>(
  table: T,
  data: Database['public']['Tables'][T]['Insert']
) {
  const sessionId = getOrCreateSessionId();
  
  // Call the set_session_id function first
  await supabaseWithSession.rpc('set_session_id', { session_id: sessionId });
  
  return supabaseWithSession
    .from(table)
    .insert({ ...data, session_id: sessionId } as any);
}

// Helper to query data with session context
export async function queryWithSession<T extends keyof Database['public']['Tables']>(
  table: T
) {
  const sessionId = getOrCreateSessionId();
  
  // Call the set_session_id function first
  await supabaseWithSession.rpc('set_session_id', { session_id: sessionId });
  
  return supabaseWithSession.from(table).select('*');
}
