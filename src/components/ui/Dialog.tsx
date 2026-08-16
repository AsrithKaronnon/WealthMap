import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { haptic } from '../../lib/haptics';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function useIsPhoneSheet() {
  const [isPhone, setIsPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isPhone;
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
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [keyboardInset, setKeyboardInset] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const isPhoneSheet = useIsPhoneSheet();
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Soft haptics when a sheet opens / closes (all pickers use this Dialog)
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) {
      haptic('light');
    } else if (!isOpen && wasOpen.current) {
      haptic('selection');
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) {
      setKeyboardInset(0);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const updateInset = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setKeyboardInset(0);
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };

    const scrollFocusedIntoView = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && active.tagName !== 'SELECT') return;
      requestAnimationFrame(() => {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };

    updateInset();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateInset);
    vv?.addEventListener('scroll', updateInset);
    window.addEventListener('focusin', scrollFocusedIntoView);
    return () => {
      document.body.style.overflow = prevOverflow;
      vv?.removeEventListener('resize', updateInset);
      vv?.removeEventListener('scroll', updateInset);
      window.removeEventListener('focusin', scrollFocusedIntoView);
    };
  }, [isOpen]);

  const handleClose = React.useCallback(() => {
    onClose();
  }, [onClose]);

  if (!mounted) return null;

  const sheetMotion = isPhoneSheet
    ? {
        initial: { y: '100%' as const },
        animate: { y: 0 },
        exit: { y: '100%' as const },
        transition: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.85 },
      }
    : {
        initial: { opacity: 0, scale: 0.96, y: 12 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: 8 },
        transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] as const },
      };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm cursor-pointer"
          />

          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
            style={{ paddingBottom: keyboardInset ? keyboardInset : undefined }}
          >
            <motion.div
              {...sheetMotion}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'dialog-title' : undefined}
              onClick={(e) => e.stopPropagation()}
              className={`
                pointer-events-auto
                w-full ${sizeClasses[size]} bg-card text-card-foreground clay
                rounded-t-[1.5rem] sm:rounded-[1.5rem] flex flex-col max-h-[92vh] sm:max-h-[90vh]
                pb-[env(safe-area-inset-bottom,12px)]
              `}
            >
              {/* Drag affordance — phone sheets only */}
              <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
              </div>

              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 shrink-0 gap-3">
                {title ? (
                  <h3 id="dialog-title" className="card-title min-w-0 truncate">
                    {title}
                  </h3>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-10 md:w-10 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div ref={bodyRef} className="px-5 py-4 overflow-y-auto flex-1 overscroll-contain">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
