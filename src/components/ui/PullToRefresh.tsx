import React, { useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { dispatchAppRefresh } from '../../lib/refresh';

const THRESHOLD = 68;
const MAX_PULL = 112;

interface PullToRefreshProps {
  scrollRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ scrollRef, children, className = '' }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);
  const pullRef = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 2) {
      pulling.current = false;
      return;
    }
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    armed.current = false;
  }, [refreshing, scrollRef]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const el = scrollRef.current;
    if (!el) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0 || el.scrollTop > 2) {
      if (pullRef.current !== 0) {
        pullRef.current = 0;
        setPull(0);
      }
      return;
    }
    const next = Math.min(dy * 0.42, MAX_PULL);
    pullRef.current = next;
    setPull(next);
    if (next >= THRESHOLD && !armed.current) {
      armed.current = true;
      haptic('selection');
    } else if (next < THRESHOLD) {
      armed.current = false;
    }
  }, [refreshing, scrollRef]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const shouldRefresh = pullRef.current >= THRESHOLD && !refreshing;
    if (!shouldRefresh) {
      pullRef.current = 0;
      setPull(0);
      return;
    }
    haptic('medium');
    setRefreshing(true);
    setPull(THRESHOLD);
    const started = Date.now();
    try {
      await dispatchAppRefresh();
    } finally {
      const wait = Math.max(0, 480 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      haptic('success');
      setRefreshing(false);
      pullRef.current = 0;
      setPull(0);
    }
  }, [refreshing]);

  const progress = Math.min(1, pull / THRESHOLD);
  const show = pull > 4 || refreshing;
  const shift = pull > 0 || refreshing ? Math.min(pull, THRESHOLD + 8) : 0;

  return (
    <div
      className={`relative ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 z-20 flex justify-center"
        style={{
          top: 6,
          opacity: show ? 1 : 0,
          transform: `translateY(${Math.max(0, pull - 8)}px)`,
          transition: pulling.current ? 'none' : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        }}
        aria-hidden={!show}
      >
        <div
          className="h-9 w-9 rounded-full clay-btn bg-card flex items-center justify-center"
          style={{
            transform: `scale(${refreshing ? 1 : 0.55 + progress * 0.45}) rotate(${refreshing ? 0 : progress * 180}deg)`,
            transition: pulling.current ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Loader2
            className={`h-4 w-4 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: 0.45 + progress * 0.55 }}
          />
        </div>
      </div>
      <div
        className="relative z-[1]"
        style={{
          transform: shift ? `translateY(${shift}px)` : undefined,
          transition: pulling.current ? 'none' : 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
};
