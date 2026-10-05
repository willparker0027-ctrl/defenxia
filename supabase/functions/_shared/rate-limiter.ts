import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
}

export async function checkRateLimit(sessionId: string): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials for rate limiting');
    // Fail open - allow request if rate limiting is misconfigured
    return { allowed: true };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Get current rate limit record
    const { data: existing, error: fetchError } = await supabase
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching rate limit:', fetchError);
      return { allowed: true }; // Fail open
    }

    const now = Date.now();
    const windowStart = existing?.window_start ? new Date(existing.window_start).getTime() : 0;
    const windowAge = now - windowStart;
    
    // Check if window has expired
    if (!existing || windowAge >= RATE_LIMIT_WINDOW_MS) {
      // Start new window
      const { error: upsertError } = await supabase
        .from('rate_limits')
        .upsert({
          session_id: sessionId,
          request_count: 1,
          window_start: new Date().toISOString()
        });
        
      if (upsertError) {
        console.error('Error upserting rate limit:', upsertError);
        return { allowed: true }; // Fail open
      }
      
      return { 
        allowed: true, 
        remaining: MAX_REQUESTS_PER_WINDOW - 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS
      };
    }

    // Window is still active
    const currentCount = existing.request_count || 0;
    
    if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
      return { 
        allowed: false, 
        remaining: 0,
        resetAt: windowStart + RATE_LIMIT_WINDOW_MS
      };
    }

    // Increment counter
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({ request_count: currentCount + 1 })
      .eq('session_id', sessionId);
      
    if (updateError) {
      console.error('Error updating rate limit:', updateError);
      return { allowed: true }; // Fail open
    }

    return { 
      allowed: true, 
      remaining: MAX_REQUESTS_PER_WINDOW - currentCount - 1,
      resetAt: windowStart + RATE_LIMIT_WINDOW_MS
    };
    
  } catch (error) {
    console.error('Unexpected error in rate limiting:', error);
    return { allowed: true }; // Fail open
  }
}
