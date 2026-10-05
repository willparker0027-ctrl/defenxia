import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id',
};

const REGIONS: Record<string, string> = {
  global: 'worldwide (global) cyber security and online financial fraud',
  india: 'India-specific cyber crime, UPI/banking fraud and CERT-In advisories',
  karnataka: 'Karnataka state (Bengaluru, Mysuru, Mangaluru, rural Karnataka) cyber crime and banking fraud',
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) return json({ error: 'Session ID required' }, 400);

    const rate = await checkRateLimit(sessionId);
    if (!rate.allowed) {
      return json({ error: 'Rate limit exceeded. Please try again later.', resetAt: rate.resetAt }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const region = typeof body?.region === 'string' ? body.region.toLowerCase() : 'global';
    const forceRefresh = body?.refresh === true;

    if (!REGIONS[region]) return json({ error: 'Invalid region' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Serve from cache when fresh
    if (!forceRefresh) {
      const since = new Date(Date.now() - CACHE_TTL_MS).toISOString();
      const { data: cached } = await supabase
        .from('cyber_news_cache')
        .select('*')
        .eq('region', region)
        .gte('created_at', since)
        .order('published_at', { ascending: false })
        .limit(12);

      if (cached && cached.length > 0) {
        return json({ region, cached: true, articles: cached });
      }
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) return json({ error: 'AI key not configured' }, 500);

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a cyber security news editor for a rural banking safety app in India. Return ONLY a JSON array of 8 recent, realistic and useful news/advisory items. Each item: {"title","summary","source","url","country","severity","published_at"}. severity is one of "critical","high","medium","info". summary must be 2 short sentences in simple English a first-time smartphone user understands. published_at is an ISO date within the last 30 days. Never include commentary or markdown fences.',
          },
          {
            role: 'user',
            content: `Give the latest ${REGIONS[region]} news and advisories relevant to protecting bank accounts, UPI and mobile phones.`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('Lovable AI error:', aiRes.status, errText);
      if (aiRes.status === 429) return json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
      if (aiRes.status === 402) return json({ error: 'Payment required. Please add credits to your Lovable workspace.' }, 402);

      // Fall back to any stale cache we have
      const { data: stale } = await supabase
        .from('cyber_news_cache')
        .select('*')
        .eq('region', region)
        .order('published_at', { ascending: false })
        .limit(12);
      if (stale && stale.length > 0) return json({ region, cached: true, stale: true, articles: stale });
      return json({ error: 'Failed to fetch cyber news' }, 500);
    }

    const aiData = await aiRes.json();
    const raw: string = aiData.choices?.[0]?.message?.content ?? '[]';
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed: any[] = [];
    try {
      const maybe = JSON.parse(cleaned);
      parsed = Array.isArray(maybe) ? maybe : maybe.articles ?? [];
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = []; }
      }
    }

    const articles = parsed.slice(0, 12).map((a) => ({
      region,
      title: String(a?.title ?? 'Cyber security advisory').slice(0, 300),
      summary: String(a?.summary ?? '').slice(0, 1200),
      source: a?.source ? String(a.source).slice(0, 160) : null,
      url: a?.url ? String(a.url).slice(0, 500) : null,
      country: a?.country ? String(a.country).slice(0, 120) : null,
      severity: ['critical', 'high', 'medium', 'info'].includes(String(a?.severity))
        ? String(a.severity)
        : 'info',
      published_at: (() => {
        const d = new Date(a?.published_at ?? Date.now());
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      })(),
    }));

    if (articles.length === 0) return json({ error: 'No news could be generated' }, 500);

    await supabase.from('cyber_news_cache').delete().eq('region', region);
    const { data: inserted, error: insertError } = await supabase
      .from('cyber_news_cache')
      .insert(articles)
      .select('*');

    if (insertError) console.error('Cache insert error:', insertError);

    return json({ region, cached: false, articles: inserted ?? articles });
  } catch (error) {
    console.error('get-cyber-news error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
