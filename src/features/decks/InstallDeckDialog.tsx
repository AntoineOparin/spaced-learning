import { useEffect, useState } from 'react';
import { BUNDLED_DECKS, type BundledDeck } from '../../content/decks';
import { repo } from '../../db/instance';
import { installContentPack } from '../../io/contentPack';
import type { ContentPack } from '../../io/schema';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';

/**
 * Installs a bundled deck. You pick the topics your course has covered so far — new cards are
 * introduced only from active topics (activate more in the Library as lectures progress).
 */
export function InstallDeckDialog({
  open,
  onClose,
  deck = BUNDLED_DECKS[0],
}: {
  open: boolean;
  onClose: () => void;
  deck?: BundledDeck;
}) {
  const toast = useToast();
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !deck || pack) return;
    deck
      .load()
      .then((p) => {
        setPack(p);
        const top = p.topics.filter((t) => t.parentKey === null);
        setSelected(new Set(top.slice(0, 2).map((t) => t.key)));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [open, deck, pack]);

  if (!deck) return null;
  const topLevel = pack?.topics.filter((t) => t.parentKey === null) ?? [];
  const countFor = (key: string) => {
    const keys = new Set([
      key,
      ...(pack?.topics.filter((t) => t.parentKey === key).map((t) => t.key) ?? []),
    ]);
    return pack?.items.filter((i) => keys.has(i.topicKey)).length ?? 0;
  };

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const install = async () => {
    if (!pack) return;
    setBusy(true);
    try {
      const summary = await installContentPack(repo, pack, { activeTopicKeys: selected });
      toast({
        tone: 'success',
        message: summary.itemsCreated
          ? `Installed ${summary.itemsCreated} items`
          : 'Already installed — nothing new to add',
      });
      onClose();
    } catch (err) {
      toast({
        tone: 'error',
        message: `Install failed: ${err instanceof Error ? err.message : err}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Install “${deck.title}”`}
      description="Which topics has your course covered so far? New cards are introduced only from these, in curriculum order. You can activate more topics later in the Library."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={install} disabled={!pack || busy}>
            {busy ? 'Installing…' : `Install ${pack?.items.length ?? ''} items`}
          </Button>
        </>
      }
    >
      {error && <p className="text-sm text-again">Could not load the deck: {error}</p>}
      {!pack && !error && <p className="text-sm text-muted">Loading…</p>}
      {pack && (
        <fieldset>
          <legend className="sr-only">Topics to activate</legend>
          <div className="mb-3 flex gap-2 text-xs">
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => setSelected(new Set(topLevel.map((t) => t.key)))}
            >
              Select all
            </button>
            <span className="text-faint">·</span>
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => setSelected(new Set())}
            >
              None
            </button>
          </div>
          <ul className="space-y-1">
            {topLevel.map((t) => {
              const subs = pack.topics.filter((s) => s.parentKey === t.key);
              return (
                <li key={t.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-[var(--accent)]"
                      checked={selected.has(t.key)}
                      onChange={() => toggle(t.key)}
                    />
                    <span className="flex-1">
                      <span className="flex justify-between gap-2 text-sm font-medium">
                        {t.name}
                        <span className="tabular-nums text-xs font-normal text-muted">
                          {countFor(t.key)} items
                        </span>
                      </span>
                      {subs.length > 0 && (
                        <span className="block text-xs text-muted">
                          {subs.map((s) => s.name).join(' · ')}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </Dialog>
  );
}
