// Session management for anonymous user isolation
export function getOrCreateSessionId(): string {
  const SESSION_KEY = 'security_app_session_id';
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    // Generate a cryptographically secure random session ID
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  
  return sessionId;
}

export function clearSession(): void {
  localStorage.removeItem('security_app_session_id');
}
