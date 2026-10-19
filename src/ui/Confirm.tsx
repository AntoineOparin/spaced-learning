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
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setRequest({ options, resolve });
        setOpen(true);
      }),
    [],
  );

  // Resolving twice is harmless: the dialog's close event follows every settle.
  const settle = (ok: boolean) => {
    request?.resolve(ok);
    setOpen(false);
  };

  const options = request?.options;
  const word = options?.typeToConfirm;
  const ready = !word || typed.trim() === word;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        size="sm"
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
            <Button variant="destructive" disabled={!ready} onClick={() => settle(true)}>
              {options?.confirmLabel}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4 text-[15px] text-muted"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) settle(true);
          }}
        >
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
        </form>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
