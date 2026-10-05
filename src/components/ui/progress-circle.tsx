import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressCircleProps {
  percentage: number;
  className?: string;
  size?: number;
}

export const ProgressCircle = ({ percentage, className, size = 200 }: ProgressCircleProps) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 500);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      {/* Background Circle */}
      <svg
        width={size}
        height={size}
        className="absolute transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(205,194,247,0.10)"
          strokeWidth="3"
          fill="transparent"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#defenxiaAuroraGradient)"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: "drop-shadow(0 0 10px rgba(232,53,123,0.5))",
          }}
        />
        <defs>
          <linearGradient id="defenxiaAuroraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f9613f" />
            <stop offset="55%" stopColor="#e8357b" />
            <stop offset="100%" stopColor="#8b3df0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Center Content */}
      <div className="flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold text-lavbright mb-1">
          {animatedPercentage}%
        </span>
        <span className="text-sm text-faint">
          Secure and optimized
        </span>
      </div>
    </div>
  );
};