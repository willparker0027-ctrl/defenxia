import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  LogOut,
  ChevronRight,
  Settings,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ------------------------------------------------------------------ */
/*  DEFENXIA · Aurora AuthModal                                        */
/*                                                                     */
/*  Context-driven (no props): rendered once globally in App.tsx and   */
/*  opened via useAuth().openAuthModal('login' | 'signup').            */
/*  - No session  -> login / signup / Google auth form (Aurora style)  */
/*  - Session     -> profile state (avatar, email, settings, sign out) */
/*  All Supabase calls go through AuthContext (signIn / signUp /        */
/*  signInWithGoogle / signOut) — session handling is untouched.        */
/* ------------------------------------------------------------------ */

type Feedback = { kind: 'error' | 'success' | 'notice'; message: string } | null;

const GoogleMark = () => (
  <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthModal: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    isAuthModalOpen,
    closeAuthModal,
    activeTab,
    setActiveTab,
    signIn,
    signUp,
    signInWithGoogle,
    signOut
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Fresh state every time the modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setFeedback(null);
      setPassword('');
      setShowPassword(false);
      setIsSubmitting(false);
      setIsGoogleSubmitting(false);
    }
  }, [isAuthModalOpen]);

  // While the modal is open: lock the page behind it (so a swipe scrolls the
  // modal, never the page), and make the phone's back button close the modal
  // instead of dumping the user to the home screen.
  useEffect(() => {
    if (!isAuthModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let backListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        closeAuthModal();
      }).then((l) => {
        backListener = l;
      });
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      backListener?.remove();
      backListener = null;
    };
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const switchTab = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    setFeedback(null);
  };

  /* ------------------------- email auth ------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!EMAIL_RE.test(cleanEmail)) {
      setFeedback({ kind: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    if (!password) {
      setFeedback({ kind: 'error', message: 'Please enter your password.' });
      return;
    }
    if (activeTab === 'signup' && password.length < 6) {
      setFeedback({ kind: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const result =
      activeTab === 'login'
        ? await signIn(cleanEmail, password)
        : await signUp(cleanEmail, password);

    if (result.error) {
      // AuthContext already toasts; mirror it inline so it survives in-modal.
      setFeedback({ kind: 'error', message: result.error.message || 'Something went wrong. Please try again.' });
    } else if (activeTab === 'signup') {
      setFeedback({ kind: 'success', message: 'Account created — welcome to DEFENXIA.' });
    }
    setIsSubmitting(false);
  };

  /* ------------------------- google auth ------------------------ */
  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    setFeedback(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setFeedback({
        kind: 'notice',
        message:
          'Google sign-in is not enabled for this project yet. Please use email & password below, or enable Google OAuth in the Supabase dashboard.'
      });
    }
    setIsGoogleSubmitting(false);
  };

  /* --------------------------- sign out ------------------------- */
  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    closeAuthModal();
  };

  const goSettings = () => {
    closeAuthModal();
    navigate('/settings');
  };

  /* ======================= LOGGED-IN PROFILE ======================= */
  if (user) {
    const meta = (user.user_metadata || {}) as Record<string, any>;
    const avatarUrl: string | undefined = meta.avatar_url || meta.picture;
    const displayName: string =
      meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Member');
    const initial = (displayName || user.email || 'D').charAt(0).toUpperCase();

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
        <div
          className="absolute inset-0 bg-[#060609]/85 backdrop-blur-md"
          onClick={closeAuthModal}
        />

        <div className="glass relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 z-10 max-h-[92vh] overflow-y-auto overscroll-contain">
          <Button
            variant="ghost"
            size="icon"
            onClick={closeAuthModal}
            aria-label="Close"
            className="absolute top-4 right-4 text-mist hover:text-ink rounded-full glass"
          >
            <X size={18} />
          </Button>

          {/* Avatar + identity */}
          <div className="flex flex-col items-center text-center pt-2 mb-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-[rgba(225,215,255,0.25)] shadow-[0_8px_32px_rgba(232,53,123,0.35)]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-magenta to-magenta-deep flex items-center justify-center shadow-[0_8px_32px_rgba(232,53,123,0.45)]">
                <span className="font-serif text-4xl text-white">{initial}</span>
              </div>
            )}
            <h2 className="font-serif text-[32px] leading-tight text-ink mt-4">
              {displayName}
            </h2>
            <p className="text-sm text-mist mt-1 break-all">{user.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Signed in
            </span>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={goSettings}
              className="glass w-full rounded-[18px] px-4 py-4 flex items-center gap-3 text-left transition-all hover:border-[rgba(225,215,255,0.28)]"
            >
              <span className="glass w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
                <Settings size={18} className="text-lav" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">Account settings</span>
                <span className="block text-xs text-faint mt-0.5">
                  Security, notifications & preferences
                </span>
              </span>
              <ChevronRight size={18} className="text-faint" />
            </button>

            <Button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full rounded-[18px] py-6 text-sm font-semibold text-white bg-gradient-to-r from-magenta-bright to-magenta-deep hover:opacity-90 shadow-[0_8px_28px_rgba(232,53,123,0.35)] transition-all"
            >
              {isSigningOut ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={16} className="animate-spin" />
                  Signing out…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogOut size={16} />
                  Sign out
                </span>
              )}
            </Button>
          </div>

          <p className="text-center text-[11px] text-faint mt-5 flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-lav" />
            Protected by DEFENXIA · Supabase secure session
          </p>
        </div>
      </div>
    );
  }

  /* ========================= AUTH FORM ========================= */
  const isLogin = activeTab === 'login';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#060609]/85 backdrop-blur-md"
        onClick={closeAuthModal}
      />

      {/* Card */}
      <div className="glass relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 z-10 max-h-[92vh] overflow-y-auto overscroll-contain">
        <Button
          variant="ghost"
          size="icon"
          onClick={closeAuthModal}
          aria-label="Close"
          className="absolute top-4 right-4 text-mist hover:text-ink rounded-full glass"
        >
          <X size={18} />
        </Button>

        {/* Heading */}
        <div className="mb-6 pr-8">
          <div className="glass w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck size={22} className="text-magenta" />
          </div>
          <h2 className="font-serif text-[38px] leading-[1.05] text-ink">
            {isLogin ? 'Welcome back.' : 'Create account.'}
          </h2>
          <p className="text-sm text-mist mt-2">
            {isLogin
              ? 'Sign in to pick up where your protection left off.'
              : 'Join DEFENXIA — banking & device protection, free.'}
          </p>
        </div>

        {/* Inline feedback */}
        {feedback && (
          <div
            role="alert"
            className={`glass rounded-[18px] px-4 py-3 mb-4 text-[12px] leading-relaxed flex items-start gap-2.5 animate-fade-in ${
              feedback.kind === 'error'
                ? 'border-red-400/30 text-red-300'
                : feedback.kind === 'success'
                  ? 'border-emerald-400/30 text-emerald-300'
                  : 'border-amber-400/30 text-amber-300'
            }`}
          >
            {feedback.kind === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Google — distinct button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleSubmitting}
          className="w-full bg-white hover:bg-white/90 disabled:opacity-70 text-slate-900 font-semibold rounded-[18px] py-4 px-4 text-sm flex items-center justify-center gap-3 transition-all shadow-[0_8px_28px_rgba(255,255,255,0.12)]"
        >
          {isGoogleSubmitting ? (
            <RefreshCw size={17} className="animate-spin text-slate-500" />
          ) : (
            <GoogleMark />
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[rgba(205,194,247,0.12)]" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-faint font-semibold">
            or with email
          </span>
          <div className="flex-1 h-px bg-[rgba(205,194,247,0.12)]" />
        </div>

        {/* Text-button mode toggle */}
        <div className="flex items-center gap-6 mb-5">
          <button
            type="button"
            onClick={() => switchTab('login')}
            className={`relative pb-1.5 text-sm font-semibold transition-colors ${
              isLogin ? 'text-ink' : 'text-faint hover:text-mist'
            }`}
          >
            Log in
            <span
              className={`absolute left-0 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-magenta to-magenta-deep transition-all ${
                isLogin ? 'w-full' : 'w-0'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => switchTab('signup')}
            className={`relative pb-1.5 text-sm font-semibold transition-colors ${
              !isLogin ? 'text-ink' : 'text-faint hover:text-mist'
            }`}
          >
            Sign up
            <span
              className={`absolute left-0 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-magenta to-magenta-deep transition-all ${
                !isLogin ? 'w-full' : 'w-0'
              }`}
            />
          </button>
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="relative">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="glass text-ink placeholder:text-faint rounded-[18px] py-6 pl-11 pr-4 text-sm border-[rgba(205,194,247,0.12)] focus:border-[rgba(225,215,255,0.35)]"
            />
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-faint h-[18px] w-[18px] pointer-events-none" />
          </div>

          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={isLogin ? 'Password' : 'Create a password (min 6 characters)'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className="glass text-ink placeholder:text-faint rounded-[18px] py-6 pl-11 pr-12 text-sm border-[rgba(205,194,247,0.12)] focus:border-[rgba(225,215,255,0.35)]"
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-faint h-[18px] w-[18px] pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-ink transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[18px] py-6 text-sm font-semibold text-white bg-gradient-to-r from-magenta-bright to-magenta-deep hover:opacity-90 shadow-[0_8px_28px_rgba(232,53,123,0.35)] transition-all"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                {isLogin ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                {isLogin ? 'Log in to DEFENXIA' : 'Create free account'}
              </span>
            )}
          </Button>
        </form>

        {/* Footer toggle (text buttons) */}
        <p className="text-center text-[13px] text-mist mt-6">
          {isLogin ? (
            <>
              New to DEFENXIA?{' '}
              <button
                type="button"
                onClick={() => switchTab('signup')}
                className="text-ink font-semibold underline underline-offset-4 decoration-magenta/60 hover:decoration-magenta"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-ink font-semibold underline underline-offset-4 decoration-magenta/60 hover:decoration-magenta"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
