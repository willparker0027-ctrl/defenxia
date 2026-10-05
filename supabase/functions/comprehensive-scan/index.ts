import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { target, scanType } = await req.json(); // target can be URL, IP, or file hash
    
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
    
    console.log('Starting comprehensive scan for:', target, 'Type:', scanType);

    const results = {
      target,
      scanType,
      scanTime: new Date().toISOString(),
      results: [],
      overallStatus: 'safe',
      summary: {
        totalScans: 0,
        safeScans: 0,
        warningScans: 0,
        maliciousScans: 0
      }
    };

    // Helper function to make internal function calls
    const callFunction = async (functionName: string, body: any) => {
      try {
        const baseUrl = Deno.env.get('SUPABASE_URL');
        const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
            'x-session-id': sessionId,
          },
          body: JSON.stringify(body)
        });
        
        if (response.ok) {
          return await response.json();
        } else {
          console.error(`Error calling ${functionName}:`, await response.text());
          return { error: `Failed to call ${functionName}` };
        }
      } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
        return { error: `Failed to call ${functionName}` };
      }
    };

    // 1. Gemini AI Analysis
    const aiResult = await callFunction('ai-analysis', {
      message: `Perform a security analysis of this ${scanType}: ${target}. Provide insights about potential security risks and recommendations.`
    });
    if (aiResult && !aiResult.error) {
      results.results.push({
        service: 'Gemini AI Analysis',
        result: aiResult,
        status: 'info'
      });
    }

    // 2. Website Scanner (if URL)
    if (scanType === 'url' || scanType === 'website') {
      const websiteResult = await callFunction('website-scanner', { url: target });
      if (websiteResult && !websiteResult.error) {
        results.results.push({
          service: 'Website Security Scanner',
          result: websiteResult,
          status: websiteResult.status || 'safe'
        });
        if (websiteResult.status === 'malicious') results.summary.maliciousScans++;
        else if (websiteResult.status === 'warning') results.summary.warningScans++;
        else results.summary.safeScans++;
        results.summary.totalScans++;
      }

      // 3. Safe Browsing Check
      const safeBrowsingResult = await callFunction('safe-browsing-check', { url: target });
      if (safeBrowsingResult && !safeBrowsingResult.error) {
        results.results.push({
          service: 'Google Safe Browsing',
          result: safeBrowsingResult,
          status: safeBrowsingResult.status || 'safe'
        });
        if (safeBrowsingResult.status === 'malicious') results.summary.maliciousScans++;
        else if (safeBrowsingResult.status === 'warning') results.summary.warningScans++;
        else results.summary.safeScans++;
        results.summary.totalScans++;
      }

      // 4. VirusTotal URL Scan
      const virusResult = await callFunction('virus-scan', { url: target });
      if (virusResult && !virusResult.error) {
        results.results.push({
          service: 'VirusTotal URL Scan',
          result: virusResult,
          status: virusResult.status || 'clean'
        });
        if (virusResult.status === 'malicious') results.summary.maliciousScans++;
        else if (virusResult.positives > 0) results.summary.warningScans++;
        else results.summary.safeScans++;
        results.summary.totalScans++;
      }
    }

    // 5. IP Security Check (if IP address or extract from URL)
    let ipToCheck = target;
    if (scanType === 'url' || scanType === 'website') {
      try {
        const urlObj = new URL(target);
        ipToCheck = urlObj.hostname;
      } catch (e) {
        // If URL parsing fails, skip IP check
        ipToCheck = null;
      }
    }

    if (ipToCheck && scanType === 'ip') {
      const ipResult = await callFunction('ip-security-check', { ipAddress: ipToCheck });
      if (ipResult && !ipResult.error) {
        results.results.push({
          service: 'AbuseIPDB Check',
          result: ipResult,
          status: ipResult.status || 'clean'
        });
        if (ipResult.status === 'suspicious') results.summary.maliciousScans++;
        else if (ipResult.status === 'warning') results.summary.warningScans++;
        else results.summary.safeScans++;
        results.summary.totalScans++;
      }
    }

    // 6. VirusTotal File Hash Scan (if file hash)
    if (scanType === 'hash' || scanType === 'file') {
      const virusHashResult = await callFunction('virus-scan', { fileHash: target });
      if (virusHashResult && !virusHashResult.error) {
        results.results.push({
          service: 'VirusTotal File Scan',
          result: virusHashResult,
          status: virusHashResult.status || 'clean'
        });
        if (virusHashResult.status === 'malicious') results.summary.maliciousScans++;
        else if (virusHashResult.positives > 0) results.summary.warningScans++;
        else results.summary.safeScans++;
        results.summary.totalScans++;
      }
    }

    // Determine overall status
    if (results.summary.maliciousScans > 0) {
      results.overallStatus = 'malicious';
    } else if (results.summary.warningScans > 0) {
      results.overallStatus = 'warning';
    } else {
      results.overallStatus = 'safe';
    }

    console.log('Comprehensive scan completed:', results.summary);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in comprehensive-scan function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});