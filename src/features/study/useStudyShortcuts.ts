/** Global keyboard shortcuts for a study session (see `SHORTCUTS` in ShortcutsDialog). */
import { useEffect } from 'react';
import type { AnswerMode, RatingValue } from '../../domain/types';
import type { Phase } from './useStudySession';

export interface ShortcutHandlers {
  /** Shortcuts are off while a dialog is open. */
  paused: boolean;
  phase: Phase;
  hasCard: boolean;
  reveal: () => void;
  rate: (r: RatingValue) => void;
  undo: () => void;
  edit: () => void;
  suspend: () => void;
  toggleWhy: () => void;
  toggleMode: (m: Exclude<AnswerMode, 'reveal'>) => void;
  help: () => void;
  exit: () => void;
}

export function useStudyShortcuts(h: ShortcutHandlers) {
  const { paused, phase, hasCard, reveal, rate, undo, edit, suspend, toggleWhy, toggleMode } = h;
  const { help, exit } = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const inField = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      const mod = e.metaKey || e.ctrlKey;

      if (inField) {
        if (e.key === 'Enter' && !e.shiftKey && phase === 'question') {
          e.preventDefault();
          reveal();
        } else if (e.key === 'Escape') {
          (target as HTMLTextAreaElement).blur();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (mod || e.altKey) return;

      switch (e.key.length === 1 ? e.key.toLowerCase() : e.key) {
        case ' ':
        case 'Enter':
          if (phase === 'question') {
            e.preventDefault();
            reveal();
          } else if (phase === 'answer') {
            e.preventDefault();
            rate(3);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          if (phase === 'answer') rate(Number(e.key) as RatingValue);
          break;
        case 'u':
          undo();
          break;
        case 'e':
          if (hasCard) edit();
          break;
        case 's':
          if (hasCard) suspend();
          break;
        case 'i':
          if (phase === 'answer') toggleWhy();
          break;
        case 't':
          if (phase === 'question') toggleMode('typed');
          break;
        case 'd':
          if (phase === 'question') toggleMode('drawn');
          break;
        case '?':
          help();
          break;
        case 'Escape':
          exit();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    paused,
    phase,
    hasCard,
    reveal,
    rate,
    undo,
    edit,
    suspend,
    toggleWhy,
    toggleMode,
    help,
    exit,
  ]);
}
