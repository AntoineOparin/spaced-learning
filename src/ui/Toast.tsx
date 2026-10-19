/** Minimal toast notifications with an optional action (e.g. "Undo"). */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export interface ToastOptions {
  message: string;
  tone?: 'default' | 'error' | 'success';
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  leaving?: boolean;
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

/** Matches the exit transition below. */
const EXIT_MS = 200;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    // Leave the way it came (up and out), then unmount.
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), EXIT_MS);
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
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-fg py-2.5 pr-3 pl-3.5 text-sm font-medium text-bg shadow-pop',
              'animate-rise transition-[opacity,translate] duration-200 ease-out',
              t.leaving && 'animate-none -translate-y-2 opacity-0',
            )}
          >
            {t.tone === 'success' && (
              <Icon name="checkCircle" size={18} className="shrink-0 text-inv-accent" />
            )}
            {t.tone === 'error' && (
              <Icon name="alert" size={18} className="shrink-0 text-inv-danger" />
            )}
            <span className="min-w-0">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="-my-1 ml-1 rounded-lg px-2 py-1 font-bold text-inv-accent transition-colors hover:bg-bg/10"
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
