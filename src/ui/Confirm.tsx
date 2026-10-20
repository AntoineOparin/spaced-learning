/** In-app confirmation for destructive actions, in place of window.confirm / window.prompt. */
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field, Input } from './Field';

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  /** Require typing this word first — only for irreversible, high-impact actions. */
  typeToConfirm?: string;
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [typed, setTyped] = useState('');

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setRequest({ options, resolve });
      }),
    [],
  );

  // Resolving twice is harmless: the dialog's close event follows every settle.
  const settle = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  const options = request?.options;
  const word = options?.typeToConfirm;
  const ready = !word || typed.trim() === word;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request !== null}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        size="sm"
        onSubmit={() => ready && settle(true)}
        footer={
          <>
            {/* The safe choice takes focus, so Enter never destroys anything by accident. */}
            <Button
              variant="ghost"
              onClick={() => settle(false)}
              data-autofocus={word ? undefined : true}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready}>
              {options?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[15px] text-muted">
          {options?.body && <div>{options.body}</div>}
          {word && (
            <Field label={`Type ${word} to confirm`}>
              {(id) => (
                <Input
                  id={id}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  data-autofocus
                />
              )}
            </Field>
          )}
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
