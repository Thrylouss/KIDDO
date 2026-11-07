"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastKind = "success" | "error";
interface ToastItem { id: number; kind: ToastKind; text: string }

const ToastContext = createContext<((kind: ToastKind, text: string) => void) | null>(null);

/** Yengil bildirishnomalar (success/error). Ekran o'quvchilar uchun aria-live. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((p) => p.filter((i) => i.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++seq.current;
    setItems((p) => [...p.slice(-3), { id, kind, text }]);
    timers.current.set(id, setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col items-end gap-2">
        {items.map((i) => (
          <div key={i.id} role={i.kind === "error" ? "alert" : "status"} data-testid={`toast-${i.kind}`}
            className={`pointer-events-auto flex w-full sm:w-auto sm:max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-slide-up
              ${i.kind === "success" ? "bg-white border-[#BBF7D0] text-[#166534]" : "bg-white border-[#FECACA] text-[#B91C1C]"}`}>
            <span className="flex-1">{i.text}</span>
            <button type="button" onClick={() => dismiss(i.id)} aria-label="Yopish" className="opacity-60 hover:opacity-100">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Provider bo'lmasa (masalan, alohida komponent testi) — jim ishlaydi. */
export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (text: string) => push?.("success", text),
    error:   (text: string) => push?.("error", text),
  };
}
