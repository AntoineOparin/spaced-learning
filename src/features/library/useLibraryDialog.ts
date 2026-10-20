/**
 * Which course/topic dialog is showing. The dialog's content stays mounted while it animates
 * closed; `key` changes on every open so the form resets.
 */
import { useState } from 'react';
import type { Course, Topic } from '../../domain/types';

export type DialogState =
  | { kind: 'course'; course?: Course }
  | { kind: 'topic'; courseId: string; parent?: Topic | null; topic?: Topic };

export function useLibraryDialog(initial: DialogState | null) {
  const [dialog, setDialog] = useState<DialogState | null>(initial);
  const [open, setOpen] = useState(dialog !== null);
  const [key, setKey] = useState(0);
  const openDialog = (next: DialogState) => {
    setDialog(next);
    setKey((k) => k + 1);
    setOpen(true);
  };
  return { dialog, open, key, openDialog, close: () => setOpen(false) };
}
