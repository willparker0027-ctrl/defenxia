import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateUrl, validateInput } from "../_shared/url-validator.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, fileHash, fileContent, fileName } = await req.json();
    
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
    
    const virusTotalApiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    
    if (!virusTotalApiKey) {
      return new Response(
        JSON.stringify({ error: 'VirusTotal API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!url && !fileHash && !fileContent) {
      return new Response(
        JSON.stringify({ error: 'URL, file hash, or file content is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate URL if provided
    if (url) {
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
    }

    // Validate file hash if provided
    if (fileHash) {
      const hashValidation = validateInput(fileHash, 256);
      if (!hashValidation.valid) {
        return new Response(
          JSON.stringify({ error: hashValidation.error }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    let response;
    let analysisData;

    if (fileContent) {
      // Upload file for scanning using v3 API
      const fileBuffer = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
      const blob = new Blob([fileBuffer]);
      const formData = new FormData();
      formData.append('file', blob, fileName || 'file');
      
      const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
        method: 'POST',
        headers: {
          'x-apikey': virusTotalApiKey
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        console.error('VirusTotal upload error:', await uploadResponse.text());
        return new Response(
          JSON.stringify({ error: 'Failed to upload file to VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const uploadData = await uploadResponse.json();
      const analysisId = uploadData.data?.id;

      if (!analysisId) {
        return new Response(
          JSON.stringify({ error: 'Invalid response from VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Wait a bit for the scan to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the analysis results
      response = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: {
          'x-apikey': virusTotalApiKey
        }
      });

      if (!response.ok) {
        console.error('VirusTotal analysis error:', await response.text());
        return new Response(
          JSON.stringify({ error: 'Failed to get analysis from VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      analysisData = await response.json();
      
    } else if (url) {
      // First, submit URL for scanning using v3 API
      const formData = new FormData();
      formData.append('url', url);
      
      const submitResponse = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
          'x-apikey': virusTotalApiKey
        },
        body: formData
      });

      if (!submitResponse.ok) {
        console.error('VirusTotal submit error:', await submitResponse.text());
        return new Response(
          JSON.stringify({ error: 'Failed to submit URL to VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const submitData = await submitResponse.json();
      const analysisId = submitData.data?.id;

      if (!analysisId) {
        return new Response(
          JSON.stringify({ error: 'Invalid response from VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Now get the analysis results
      response = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: {
          'x-apikey': virusTotalApiKey
        }
      });

      if (!response.ok) {
        console.error('VirusTotal analysis error:', await response.text());
        return new Response(
          JSON.stringify({ error: 'Failed to get analysis from VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      analysisData = await response.json();
      
    } else if (fileHash) {
      // Scan file hash using v3 API
      response = await fetch(`https://www.virustotal.com/api/v3/files/${fileHash}`, {
        headers: {
          'x-apikey': virusTotalApiKey
        }
      });

      if (!response.ok) {
        console.error('VirusTotal file error:', await response.text());
        return new Response(
          JSON.stringify({ error: 'Failed to scan file hash with VirusTotal' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      analysisData = await response.json();
    }

    const attributes = analysisData.data?.attributes || {};
    const stats = attributes.stats || attributes.last_analysis_stats || {};
    const malicious = stats.malicious || 0;
    const total = Object.values(stats).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
    
    const scanResult = {
      service: 'VirusTotal',
      resource: url || fileHash,
      scanId: analysisData.data?.id,
      permalink: url 
        ? `https://www.virustotal.com/gui/url/${btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`
        : `https://www.virustotal.com/gui/file/${fileHash}`,
      responseCode: analysisData.data ? 1 : 0,
      verbose_msg: malicious > 0 ? 'Resource found and flagged' : 'Resource found and clean',
      positives: malicious,
      total: total,
      scanDate: attributes.date ? new Date(attributes.date * 1000).toISOString() : new Date().toISOString(),
      status: malicious > 0 ? 'malicious' : 'clean',
      scans: attributes.results || attributes.last_analysis_results,
      scanTime: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(scanResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in virus-scan function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});