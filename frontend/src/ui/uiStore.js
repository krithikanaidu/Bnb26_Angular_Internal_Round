import { create } from 'zustand';

/**
 * UI store — presentation-only state: the iOS-style dialogs and the toast
 * stack. Deliberately holds NO content or metrics: every number shown in
 * this app comes from the API, so there is nothing here to go stale.
 */

let counter = 0;
const nextId = (prefix) => `${prefix}-${++counter}`;

export const useUIStore = create((set) => ({
  dialogs: [],
  toasts: [],

  /** @param {{headline:string, accentWord?:string, subline?:string, actions:{label:string,variant?:'primary'|'secondary',onClick?:()=>void}[]}} dialog */
  pushDialog: (dialog) => set((s) => ({ dialogs: [...s.dialogs, { ...dialog, id: nextId('dlg') }] })),
  dismissDialog: (id) => set((s) => ({ dialogs: s.dialogs.filter((d) => d.id !== id) })),

  /** @param {{message:string, variant?:'success'|'error'|'info'}} toast */
  pushToast: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: nextId('toast') }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Convenience hooks so feature code never has to destructure the whole store
 * (each `useUIStore()` call with a selector already avoids this, but these
 * read better at the call site).
 */
export const useToast = () => useUIStore((s) => s.pushToast);
export const useDialog = () => useUIStore((s) => s.pushDialog);
