/** Per-device study preferences, remembered in localStorage. */
import { useCallback, useState } from 'react';
import type { AnswerMode } from '../../domain/types';
import { readLocal, writeLocal } from '../../lib/storage';

const MODE_KEY = 'answerMode';
const EXPLAIN_KEY = 'showExplanations';
const HINT_KEY = 'ratingHintSeen';

export function useStudyPrefs() {
  const [inputMode, setInputMode] = useState<AnswerMode>(() => {
    const saved = readLocal(MODE_KEY);
    return saved === 'typed' || saved === 'drawn' ? saved : 'reveal';
  });
  const [showWhy, setShowWhy] = useState(() => readLocal(EXPLAIN_KEY) === '1');
  const [hintSeen, setHintSeen] = useState(() => readLocal(HINT_KEY) === '1');

  /** Turns a mode on, or back to plain reveal when it was already on. */
  const toggleMode = useCallback((m: Exclude<AnswerMode, 'reveal'>) => {
    setInputMode((v) => {
      const next = v === m ? 'reveal' : m;
      writeLocal(MODE_KEY, next);
      return next;
    });
  }, []);

  const toggleWhy = useCallback(() => {
    setShowWhy((v) => {
      writeLocal(EXPLAIN_KEY, v ? '0' : '1');
      return !v;
    });
  }, []);

  const markHintSeen = useCallback(() => {
    setHintSeen(true);
    writeLocal(HINT_KEY, '1');
  }, []);

  return { inputMode, toggleMode, showWhy, toggleWhy, hintSeen, markHintSeen };
}
