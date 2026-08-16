/**
 * Soft haptic feedback for PWA / Android Chrome.
 * iOS Safari generally ignores vibrate — no-op is fine.
 */

export type HapticKind = 'light' | 'medium' | 'selection' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 14,
  selection: 6,
  success: [10, 40, 12],
  warning: [16, 30, 16],
};

export function haptic(kind: HapticKind = 'light') {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    // Respect reduced motion / user preference when available
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ignore */
  }
}
