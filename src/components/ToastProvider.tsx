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
  success: "border-[#00FF9C]/40 bg-[#00FF9C]/10 shadow-[0_0_20px_rgba(0,255,156,0.15)]",
  danger:  "border-[#FF4C4C]/50 bg-[#FF4C4C]/15 shadow-[0_0_30px_rgba(255,76,76,0.25)]",
  warning: "border-[#FFC107]/40 bg-[#FFC107]/10 shadow-[0_0_20px_rgba(255,193,7,0.15)]",
  info:    "border-[#495AEE]/40 bg-[#495AEE]/10 shadow-[0_0_20px_rgba(73,90,238,0.15)]",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-neon-green",
  danger:  "text-alert-red animate-pulse",
  warning: "text-alert-yellow",
  info:    "text-accent",
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
        <p className="text-sm font-semibold text-text-light leading-tight">
          {toast.title}
        </p>
        <p className="text-xs text-accent-soft/70 mt-0.5 leading-snug">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-accent-soft/40 hover:text-text-light transition-colors mt-0.5 shrink-0"
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
