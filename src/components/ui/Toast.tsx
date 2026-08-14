import React from 'react';
import { useToastStore } from '../../lib/useToastStore';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div className="fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 md:top-4 md:right-4 z-[999] flex flex-col gap-2 max-w-sm w-[calc(100%-1.5rem)] md:w-full pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((t) => {
          let Icon = Info;
          let colorClass = 'border-primary/20 text-primary bg-primary/5';
          let iconColor = 'text-primary';
          
          if (t.type === 'success') {
            Icon = CheckCircle2;
            colorClass = 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10';
            iconColor = 'text-emerald-500';
          } else if (t.type === 'error') {
            Icon = AlertTriangle;
            colorClass = 'border-rose-500/30 text-rose-500 bg-rose-500/5 dark:bg-rose-500/10';
            iconColor = 'text-rose-500';
          }

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              layout
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-[1.5rem] clay bg-card/95 backdrop-blur-md ${colorClass}`}
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-xs font-semibold text-foreground leading-relaxed pr-2">
                {t.message}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
