import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateUrl } from "../_shared/url-validator.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    // Validate session ID
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(sessionId);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          resetAt: rateLimitResult.resetAt
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // SSRF protection - validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'Lovable API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processing website scan request for URL:', url);

    // First, let's try to fetch basic information about the website
    let websiteInfo = '';
    try {
      const siteResponse = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) 
      });
      
      websiteInfo = `Status: ${siteResponse.status}, Headers: ${JSON.stringify(Object.fromEntries(siteResponse.headers.entries()))}`;
    } catch (fetchError) {
      websiteInfo = `Could not fetch website: ${fetchError.message}`;
    }


    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a cybersecurity expert analyzing websites for security threats. Provide analysis in JSON format with these fields: status (safe/warning/malicious), threats (array of strings), analysis (detailed text), recommendations (safety recommendations text).'
            },
            {
              role: 'user',
              content: `Analyze this website for security threats:\n\nURL: ${url}\nWebsite Info: ${websiteInfo}\n\nProvide a security analysis including:\n1. Overall safety assessment (safe/warning/malicious)\n2. Specific security concerns or threats if any\n3. SSL/Certificate status assessment\n4. General reputation indicators\n5. Recommendations for users`
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable workspace.' }),
          { 
            status: 402, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to get response from AI service' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    console.log('Raw AI response:', aiResponse);

    // Try to parse JSON from the AI response
    let scanResult;
    try {
      // Extract JSON from the response if it's wrapped in markdown
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiResponse;
      
      scanResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.log('Failed to parse JSON, providing fallback result');
      // Fallback if AI doesn't return proper JSON
      scanResult = {
        status: 'warning',
        threats: ['Unable to perform complete analysis'],
        analysis: aiResponse,
        recommendations: 'Exercise caution when visiting this website'
      };
    }

    // Ensure required fields exist
    scanResult = {
      url: url,
      status: scanResult.status || 'warning',
      threats: Array.isArray(scanResult.threats) ? scanResult.threats : [],
      analysis: scanResult.analysis || aiResponse,
      recommendations: scanResult.recommendations || 'General web safety precautions recommended',
      scanTime: new Date().toLocaleTimeString()
    };

    console.log('Website scan completed successfully');

    return new Response(
      JSON.stringify(scanResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in website-scanner function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});