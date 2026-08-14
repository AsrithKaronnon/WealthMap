import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-2xl"
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm cursor-pointer"
          />

          {/* Dialog Container */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ 
                y: '100%', 
                scale: 1 
              }}
              animate={{ 
                y: 0, 
                scale: 1 
              }}
              exit={{ 
                y: '100%', 
                scale: 0.95 
              }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? "dialog-title" : undefined}
              className={`
                w-full ${sizeClasses[size]} bg-card text-card-foreground clay
                rounded-t-[1.5rem] sm:rounded-[1.5rem] flex flex-col max-h-[92vh] sm:max-h-[90vh]
                pb-[env(safe-area-inset-bottom,12px)]
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
                {title ? (
                  <h3 id="dialog-title" className="card-title">
                    {title}
                  </h3>
                ) : <div />}
                <button
                  onClick={onClose}
                  className="flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-4 overflow-y-auto flex-1 overscroll-contain">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
