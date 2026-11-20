import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone }] }));
    window.setTimeout(() => get().dismiss(id), 4800);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
