import { create } from 'zustand';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  destructive?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  showConfirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  options: null,
  showConfirm: (options) => set({ isOpen: true, options }),
  closeConfirm: () => set({ isOpen: false, options: null }),
}));

export const confirm = (options: ConfirmOptions) => {
  useConfirmStore.getState().showConfirm(options);
};
