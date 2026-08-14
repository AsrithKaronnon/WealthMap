import React from 'react';
import type { HTMLMotionProps } from 'framer-motion';
import { motion } from 'framer-motion';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}, ref) => {
  const baseStyle = "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-[0.98] h-[40px] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 clay-btn",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 clay-btn",
    outline: "border-2 border-border bg-background text-foreground hover:bg-secondary hover:text-secondary-foreground clay-btn",
    ghost: "bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground rounded-[calc(var(--radius)-0.25rem)]",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 clay-btn"
  };

  const sizes = {
    sm: "px-2.5 text-xs",
    md: "px-3.5 text-sm",
    lg: "px-5 text-base"
  };

  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {children as any}
    </motion.button>
  );
});

Button.displayName = 'Button';
