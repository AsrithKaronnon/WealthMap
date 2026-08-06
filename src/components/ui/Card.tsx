import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  children,
  className = '',
  hoverEffect = false,
  glass = false,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={`
        clay border-none text-card-foreground overflow-hidden
        transition-all duration-300 ease-in-out hover:-translate-y-[2px]
        ${glass ? 'glass' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-3.5 sm:p-6 flex flex-col gap-1 border-b border-white/10 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`card-title ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-muted-foreground ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-3 sm:p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-3 sm:p-6 bg-muted/20 border-t border-white/10 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);
