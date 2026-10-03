import { create } from 'zustand';

export type DialogAction = {
  label: string;
  variant: 'primary' | 'secondary';
  onClick?: () => void;
};

export type DialogData = {
  id: string;
  headline: string;
  accentWord?: string;
  subline?: string;
  actions: DialogAction[];
};

type ToastData = {
  id: string;
  message: string;
  variant?: 'success' | 'error' | 'info';
};

type UIStore = {
  dialogs: DialogData[];
  toasts: ToastData[];
  pushDialog: (dialog: Omit<DialogData, 'id'>) => void;
  dismissDialog: (id: string) => void;
  pushToast: (toast: Omit<ToastData, 'id'>) => void;
  dismissToast: (id: string) => void;
};

let counter = 0;
const nextId = () => `dlg-${++counter}`;

export const useUIStore = create<UIStore>((set) => ({
  dialogs: [],
  toasts: [],
  pushDialog: (dialog) =>
    set((s) => ({ dialogs: [...s.dialogs, { ...dialog, id: nextId() }] })),
  dismissDialog: (id) =>
    set((s) => ({ dialogs: s.dialogs.filter((d) => d.id !== id) })),
  pushToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { ...toast, id: `toast-${++counter}` }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
