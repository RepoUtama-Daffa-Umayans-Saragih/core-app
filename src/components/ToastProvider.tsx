"use client";

import React, {
  createContext, useContext, useState, useCallback, useEffect
} from "react";
import { X, CheckCircle2, AlertTriangle, Siren, Info } from "lucide-react";

// ─── Tipe ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "danger" | "warning" | "info";

type Toast = {
  id:        string;
  type:      ToastType;
  title:     string;
  message:   string;
  duration?: number;
};

type ToastContextValue = {
  addToast: (toast: Omit<Toast, "id">) => void;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  danger:  Siren,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-md",
  danger:  "border-red-200 bg-red-50 text-red-950 shadow-md",
  warning: "border-amber-200 bg-amber-50 text-amber-950 shadow-md",
  info:    "border-blue-200 bg-blue-50 text-blue-950 shadow-md",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-600",
  danger:  "text-red-600 animate-pulse",
  warning: "text-amber-600",
  info:    "text-[#0055FF]",
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const dur = toast.duration ?? 4500;
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(toast.id), 300);
    }, dur);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md
        transition-all duration-300 w-80
        ${STYLES[toast.type]}
        ${visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-8"}
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${ICON_STYLES[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-tight">
          {toast.title}
        </p>
        <p className="text-xs text-gray-600 mt-1 leading-snug">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}

      {/* Toast Stack — pojok kanan atas */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={remove} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
