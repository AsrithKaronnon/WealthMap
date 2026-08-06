import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  ...props
}) => {
  const styles = {
    primary: "bg-primary/5 text-primary border-primary/10",
    success: "bg-emerald-500/5 text-emerald-600 border-emerald-500/10",
    warning: "bg-amber-500/5 text-amber-600 border-amber-500/10",
    danger: "bg-rose-500/5 text-rose-600 border-rose-500/10",
    info: "bg-sky-500/5 text-sky-600 border-sky-500/10",
    neutral: "bg-muted/50 text-muted-foreground border-border"
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium clay-badge border-0
        ${styles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};
