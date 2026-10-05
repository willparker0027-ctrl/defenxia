// SSRF protection - validates URLs to prevent internal network access
export function validateUrl(urlString: string): { valid: boolean; error?: string; url?: URL } {
  try {
    const url = new URL(urlString);
    
    // 1. Whitelist only HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }
    
    // 2. Block localhost
    if (['localhost', '0.0.0.0'].includes(url.hostname.toLowerCase())) {
      return { valid: false, error: 'Localhost URLs are not allowed' };
    }
    
    // 3. Block private IP ranges
    if (isPrivateIP(url.hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }
    
    // 4. Validate URL length
    if (urlString.length > 2048) {
      return { valid: false, error: 'URL is too long (max 2048 characters)' };
    }
    
    return { valid: true, url };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function isPrivateIP(hostname: string): boolean {
  // Check if hostname is an IP address
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipMatch) {
    // Domain names are allowed (DNS will resolve them)
    return false;
  }
  
  const parts = ipMatch.slice(1).map(Number);
  
  // Check private IP ranges
  return (
    parts[0] === 10 ||  // 10.0.0.0/8
    parts[0] === 127 ||  // 127.0.0.0/8 (loopback)
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||  // 172.16.0.0/12
    (parts[0] === 192 && parts[1] === 168) ||  // 192.168.0.0/16
    (parts[0] === 169 && parts[1] === 254)  // 169.254.0.0/16 (link-local, AWS metadata)
  );
}

export function validateInput(input: string, maxLength: number = 10000): { valid: boolean; error?: string } {
  if (!input || input.trim() === '') {
    return { valid: false, error: 'Input cannot be empty' };
  }
  
  if (input.length > maxLength) {
    return { valid: false, error: `Input too long (max ${maxLength} characters)` };
  }
  
  return { valid: true };
}
