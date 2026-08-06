import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'info', duration = 3000) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, type, duration }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (msg: string, duration?: number) => useToastStore.getState().showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => useToastStore.getState().showToast(msg, 'error', duration),
  info: (msg: string, duration?: number) => useToastStore.getState().showToast(msg, 'info', duration),
};
