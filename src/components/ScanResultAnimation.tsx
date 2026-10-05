import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScanResultAnimationProps {
  status: 'safe' | 'malicious' | 'warning';
  title: string;
  subtitle?: string;
  positives?: number;
  totalEngines?: number;
  score?: number;
}

export const ScanResultAnimation: React.FC<ScanResultAnimationProps> = ({
  status,
  title,
  subtitle,
  positives = 0,
  totalEngines = 72,
  score
}) => {
  const isSafe = status === 'safe';
  const isMalicious = status === 'malicious';

  const ringClass = isSafe ? 'border-emerald-400' : isMalicious ? 'border-red-500' : 'border-amber-400';
  const textClass = isSafe ? 'text-emerald-400' : isMalicious ? 'text-red-400' : 'text-amber-300';
  const glowClass = isSafe
    ? 'shadow-[0_0_50px_rgba(16,185,129,0.35)]'
    : isMalicious
    ? 'shadow-[0_0_50px_rgba(239,68,68,0.35)]'
    : 'shadow-[0_0_50px_rgba(245,158,11,0.35)]';

  return (
    <div className="glass glass-card relative rounded-[24px] py-6 px-4 flex flex-col items-center justify-center text-center overflow-hidden">

      {/* Soft status aura behind the core */}
      <div
        className={`absolute inset-0 blur-3xl opacity-20 pointer-events-none transition-all duration-700 ${
          isSafe ? 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500' :
          isMalicious ? 'bg-gradient-to-tr from-red-600 via-rose-600 to-amber-600' :
          'bg-gradient-to-tr from-amber-500 via-yellow-500 to-orange-500'
        }`}
      />

      {/* Floating Shield Core */}
      <div className="relative w-44 h-44 mb-5 flex items-center justify-center [perspective:1000px]">

        {/* Outer Orbiting Energy Ring */}
        <div
          className={`absolute inset-[-12px] rounded-full border-2 border-dashed animate-spin opacity-40 ${ringClass}`}
          style={{ animationDuration: '18s' }}
        />

        {/* Inner Ping Wave */}
        <div
          className={`absolute inset-[-4px] rounded-full border border-current animate-ping opacity-25 ${textClass}`}
          style={{ animationDuration: '3s' }}
        />

        {/* Glass Core */}
        <div
          className={`glass w-32 h-32 rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-500 relative ${glowClass} ${
            isSafe
              ? 'border-emerald-400/60'
              : isMalicious
              ? 'border-red-500/60 animate-pulse'
              : 'border-amber-400/60'
          }`}
          style={{
            transform: 'perspective(600px) rotateX(6deg) rotateY(-4deg) translateZ(10px)',
            transition: 'transform 0.4s ease'
          }}
        >
          {/* Top Corner Sparkle */}
          <div className="absolute top-2 right-2">
            <Sparkles size={14} className={isSafe ? 'text-emerald-300 animate-pulse' : 'text-red-400'} />
          </div>

          {isSafe ? (
            <ShieldCheck size={56} className={`animate-in zoom-in-75 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)] ${textClass}`} />
          ) : isMalicious ? (
            <ShieldAlert size={56} className={`animate-in zoom-in-75 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] ${textClass}`} />
          ) : (
            <AlertTriangle size={56} className={`animate-in zoom-in-75 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)] ${textClass}`} />
          )}

          <span className="text-[10px] font-mono mt-1 font-bold uppercase tracking-wider text-mist">
            {isSafe ? 'Secure' : isMalicious ? 'Threat' : 'Warning'}
          </span>
        </div>
      </div>

      {/* Result Status & Announcement Header */}
      <div className="space-y-2 max-w-lg z-10">

        {/* Status Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {isSafe ? (
            <Badge className="glass rounded-full border-emerald-400/40 text-emerald-300 text-xs px-3.5 py-1 font-semibold">
              <CheckCircle2 size={13} className="mr-1.5" />
              0 / {totalEngines} Detections • Safe
            </Badge>
          ) : (
            <Badge className="glass rounded-full border-red-500/40 text-red-300 text-xs px-3.5 py-1 font-semibold">
              <XCircle size={13} className="mr-1.5" />
              {positives} / {totalEngines} Security Engines Flagged Threat
            </Badge>
          )}

          {typeof score === 'number' && (
            <Badge className={`glass rounded-full text-xs px-2.5 py-1 font-mono ${
              score >= 80 ? 'text-emerald-300 border-emerald-400/30' :
              score >= 50 ? 'text-amber-300 border-amber-400/30' :
              'text-red-300 border-red-500/30'
            }`}>
              Trust Score: {score}/100
            </Badge>
          )}
        </div>

        <h3 className="text-2xl sm:text-3xl font-serif text-ink tracking-tight">
          {title}
        </h3>

        {subtitle && (
          <p className="text-xs sm:text-sm text-mist max-w-md mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

    </div>
  );
};
