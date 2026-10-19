/** Minimal toast notifications with an optional action (e.g. "Undo"). */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from './cn';

export interface ToastOptions {
  message: string;
  tone?: 'default' | 'error' | 'success';
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (t: ToastOptions) => {
      const id = nextId++;
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.durationMs ?? (t.action ? 6000 : 3500));
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-lg',
              t.tone === 'error'
                ? 'border-again/30 bg-again-soft text-again'
                : t.tone === 'success'
                  ? 'border-good/30 bg-good-soft text-good'
                  : 'border-line bg-surface text-fg',
            )}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
