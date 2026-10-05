import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { getOAuthRedirectUrl } from '@/lib/api-config';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: (tab?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  activeTab: 'login' | 'signup';
  setActiveTab: (tab: 'login' | 'signup') => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // 1. Check for access_token in URL hash (from OAuth callback)
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('refresh_token='))) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data }) => {
          if (data?.session) {
            setSession(data.session);
            setUser(data.session.user);
            setIsLoading(false);
            window.history.replaceState(null, '', window.location.pathname);
          }
        });
      }
    }

    // 2. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // 3. Listen to real-time auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && session?.user) {
        toast.success(`Welcome, ${session.user.email || 'User'}!`);
      }
    });

    // 4. Listen to Native Deep Links from Android MainActivity (Google OAuth redirect)
    const handleDeepLink = (event: any) => {
      const url = event?.detail?.url;
      if (!url) return;
      console.log('[DEFENXIA AUTH] Native Deep Link received:', url);

      let tokenString = '';
      if (url.includes('#')) {
        tokenString = url.split('#')[1];
      } else if (url.includes('?')) {
        tokenString = url.split('?')[1];
      }

      if (tokenString) {
        const params = new URLSearchParams(tokenString);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
            if (data?.session) {
              setSession(data.session);
              setUser(data.session.user);
              setIsLoading(false);
              closeAuthModal();
              toast.success(`Welcome, ${data.session.user.email || 'User'}!`);
            } else if (error) {
              console.error('Session setting error from deep link:', error);
            }
          });
        }
      }
    };

    window.addEventListener('defenxia:deepLink', handleDeepLink);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('defenxia:deepLink', handleDeepLink);
    };
  }, []);

  // Desktop (Electron) Google OAuth: "Continue with Google" navigates the whole
  // window through Google; the main process intercepts ONLY the final redirect
  // (the one carrying access_token) and reloads the app. The fresh renderer
  // pulls the pending session here and signs in — no window ever leaves the app.
  useEffect(() => {
    const w = window as any;
    if (!w.defenxia?.isDesktop || typeof w.defenxia.getPendingOAuthSession !== 'function') return;
    let cancelled = false;
    w.defenxia.getPendingOAuthSession().then(async (pending: any) => {
      if (cancelled || !pending) return;
      if (pending.error) {
        toast.error(pending.error);
        return;
      }
      if (pending.accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: pending.accessToken,
          refresh_token: pending.refreshToken || '',
        });
        if (error) {
          console.error('[DEFENXIA AUTH] Desktop OAuth session failed:', error);
          toast.error(error.message || 'Google login failed — please try email & password instead');
        } else {
          closeAuthModal();
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const openAuthModal = (tab: 'login' | 'signup' = 'login') => {
    setActiveTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        toast.error(error.message || 'Failed to sign in. Please check your credentials.');
        return { error };
      }

      toast.success(`Welcome back, ${data.user?.email || 'User'}!`);
      closeAuthModal();
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred during sign in');
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password
      });

      if (error) {
        toast.error(error.message || 'Failed to register account');
        return { error };
      }

      toast.success(`Account created! Logged in as ${data.user?.email || 'User'}`);
      closeAuthModal();
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred during sign up');
      return { error: err };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = getOAuthRedirectUrl();
      console.log('[DEFENXIA AUTH] Production OAuth Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        if (error.message?.includes('provider is not enabled') || (error as any).code === 'validation_failed') {
          toast.error("Google provider is not enabled in your Supabase Dashboard yet. Please use Email & Password below.");
        } else {
          toast.error(error.message || 'Failed to initialize Google Sign In');
        }
        return { error };
      }

      return { error: null };
    } catch (err: any) {
      toast.error('Google Sign In error. Please sign up with email below.');
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.info('Signed out successfully');
    } catch (err: any) {
      toast.error('Error signing out');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        activeTab,
        setActiveTab,
        signIn,
        signUp,
        signInWithGoogle,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
