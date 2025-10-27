"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ToastType = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  push: (toast: { message: string; type?: ToastType }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_STYLES: Record<ToastType, string> = {
  info: "bg-muted/90 text-foreground border border-border/60",
  success: "bg-emerald-500/90 text-black border border-emerald-400",
  error: "bg-red-500/90 text-white border border-red-400",
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  const push = useCallback((toast: { message: string; type?: ToastType }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const entry: Toast = { id, message: toast.message, type: toast.type ?? "info" };
    setToasts((prev) => [...prev, entry]);

    const timeout = setTimeout(() => remove(id), 4000);
    timeouts.current.set(id, timeout);
  }, [remove]);

  const value = useMemo<ToastContextValue>(() => ({
    push,
    success: (message: string) => push({ message, type: "success" }),
    error: (message: string) => push({ message, type: "error" }),
    info: (message: string) => push({ message, type: "info" }),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl px-4 py-3 text-sm shadow-xl transition-opacity ${TYPE_STYLES[toast.type]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex-1 break-words">{toast.message}</span>
              <button
                className="text-xs uppercase tracking-wide"
                onClick={() => remove(toast.id)}
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
