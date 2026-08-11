import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

/** 全局 Toast（完善方案 1.1：右上角堆叠，最多 3 条，滑入动画） */

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
  leaving?: boolean;
}

interface ToastCtx {
  push: (tone: ToastTone, text: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const TONE_CLS: Record<ToastTone, string> = {
  success: 'border-success/50 bg-bg-panel text-success',
  error: 'border-danger/50 bg-bg-panel text-danger',
  info: 'border-primary/50 bg-bg-panel text-primary',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 200);
  }, []);

  const push = useCallback(
    (tone: ToastTone, text: string) => {
      seq.current += 1;
      const id = seq.current;
      setItems((list) => [...list.slice(-2), { id, tone, text }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 5000 : 3000);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-[100] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-2xl transition-all duration-200 ${TONE_CLS[t.tone]} ${
              t.leaving ? 'translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
            }`}
          >
            {t.tone === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : t.tone === 'error' ? <XCircle size={15} className="mt-0.5 shrink-0" /> : <Info size={15} className="mt-0.5 shrink-0" />}
            <span className="leading-relaxed text-text-primary">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="ml-auto shrink-0 text-text-secondary hover:text-text-primary" aria-label="关闭提示">
              ✕
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/** 常用快捷封装 */
export function useNotify() {
  const { push } = useToast();
  return {
    success: (text: string) => push('success', text),
    error: (text: string) => push('error', text),
    info: (text: string) => push('info', text),
  };
}
