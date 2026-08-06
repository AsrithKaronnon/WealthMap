import React from 'react';
import { motion } from 'framer-motion';

interface ProgressCircleProps {
  value: number; // 0 to 100
  size?: number; // width/height in px
  strokeWidth?: number;
  className?: string;
  customColor?: string;
  children?: React.ReactNode;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  value,
  size = 64,
  strokeWidth = 4,
  className = '',
  customColor,
  children
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 select-none">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Indicator */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={customColor ? '' : 'text-primary'}
          stroke={customColor || 'currentColor'}
          strokeLinecap="round"
        />
      </svg>
      {children && (
        <div className="absolute flex items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
};
