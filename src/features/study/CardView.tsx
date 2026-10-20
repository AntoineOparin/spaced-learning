/** The card itself: topic trail and counts, the question, your attempt, and the answer. */
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { RichText } from '../../content/RichText';
import type { QueueCounts } from '../../domain/queue';
import { TRAIL_SEPARATOR } from '../../domain/topics';
import type { AnswerMode, Item } from '../../domain/types';
import { cn } from '../../lib/cn';
import { DisclosureButton } from '../../ui/Disclosure';
import { Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Badge, Dot, Kbd, surface } from '../../ui/misc';
import { type CardFaces, isExactMatch } from './answer';
import { SketchPreview, Sketchpad } from './Sketchpad';
import type { Stroke } from './sketch';
import type { Current, Phase } from './useStudySession';

export interface CardViewProps {
  current: Current;
  faces: CardFaces;
  phase: Phase;
  mode: AnswerMode;
  trail: string[];
  counts: QueueCounts | null;
  typed: string;
  setTyped: (s: string) => void;
  strokes: Stroke[];
  setStrokes: Dispatch<SetStateAction<Stroke[]>>;
  showWhy: boolean;
  toggleWhy: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  answerRef: RefObject<HTMLDivElement | null>;
  onReveal: () => void;
}

function Explanation({
  item,
  open,
  onToggle,
}: {
  item: Item;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-10">
      <DisclosureButton open={open} onToggle={onToggle}>
        Why?
        <span className="ml-1.5 hidden sm:inline-flex">
          <Kbd>I</Kbd>
        </span>
      </DisclosureButton>
      {open && (
        <div className={cn(surface, 'mt-3 animate-rise space-y-4 px-5 py-4')}>
          {item.fields.explanation && <RichText source={item.fields.explanation} />}
          {item.fields.mnemonic && (
            <div>
              <div className="text-[13px] font-bold text-muted">Mnemonic</div>
              <RichText source={item.fields.mnemonic} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerPanel({
  faces,
  mode,
  typed,
  strokes,
  item,
  showWhy,
  toggleWhy,
  answerRef,
}: Pick<
  CardViewProps,
  'faces' | 'mode' | 'typed' | 'strokes' | 'showWhy' | 'toggleWhy' | 'answerRef'
> & { item: Item }) {
  const hasWhy = !!(item.fields.explanation || item.fields.mnemonic);
  return (
    <div
      ref={answerRef}
      tabIndex={-1}
      aria-live="polite"
      className="mt-8 animate-rise outline-none"
    >
      <hr className="mb-8 border-line" />
      {faces.clozeOrdinal === undefined ? (
        <section
          aria-label="Answer"
          className="text-[22px] leading-normal font-medium sm:text-[26px]"
        >
          <RichText source={faces.answer} />
        </section>
      ) : (
        faces.answer.trim() && (
          <section aria-label="Extra" className="text-lg text-muted">
            <RichText source={faces.answer} />
          </section>
        )
      )}

      {/* The key keeps the same place in every mode; your attempt follows it. */}
      {mode !== 'reveal' && (
        <div className={cn(surface, 'mt-8 px-4 py-3')}>
          <div className="mb-1 flex items-center justify-between text-[13px] text-muted">
            <span className="font-semibold">Your answer</span>
            {mode === 'typed' && typed.trim() && isExactMatch(typed, faces.expected) && (
              <span className="flex items-center gap-1 font-bold text-accent-text">
                <Icon name="checkCircle" size={16} /> Matches the key
              </span>
            )}
          </div>
          {mode === 'drawn' && strokes.length ? (
            <div className="py-1">
              <SketchPreview strokes={strokes} />
            </div>
          ) : mode === 'typed' && typed.trim() ? (
            <RichText source={typed} className="text-lg" />
          ) : (
            <p className="text-sm text-muted">(no answer)</p>
          )}
        </div>
      )}
      {hasWhy && <Explanation item={item} open={showWhy} onToggle={toggleWhy} />}
    </div>
  );
}

export function CardView(p: CardViewProps) {
  const { current, faces, phase, mode, trail, counts, typed, setTyped, strokes, setStrokes } = p;
  const { item } = current;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Space/Enter reveal is handled globally
    // biome-ignore lint/a11y/noStaticElementInteractions: tap anywhere on the card to reveal
    <div
      className={cn(
        'mx-auto flex w-full max-w-[720px] flex-1 flex-col px-5 pt-4 pb-6 sm:pt-8',
        phase === 'question' && mode === 'reveal' && 'cursor-pointer',
      )}
      onClick={(e) => {
        if (
          phase === 'question' &&
          mode === 'reveal' &&
          !(e.target as HTMLElement).closest('a,button,textarea')
        )
          p.onReveal();
      }}
    >
      {/* Keyed by card: each new card slides in from the direction of travel. */}
      {/* While drawing, it stretches so the pad can fill the space above the footer. */}
      <div
        key={current.card.id}
        className={cn(
          'animate-card',
          mode === 'drawn' && phase === 'question' && 'flex flex-1 flex-col',
        )}
      >
        <div className="mb-8 flex items-center justify-between gap-4 text-[13px]">
          <p className="min-w-0 truncate text-muted">
            <span className="hidden sm:inline">{trail.join(TRAIL_SEPARATOR)}</span>
            <span className="sm:hidden">{trail.at(-1)}</span>
          </p>
          {counts && (
            <p className="flex shrink-0 gap-3 font-bold tabular-nums">
              <span className="sr-only">Remaining:</span>
              <span className="flex items-center gap-1.5" title="Learning">
                <Dot className="bg-streak" />
                {counts.learning}
                <span className="sr-only"> learning,</span>
              </span>
              <span className="flex items-center gap-1.5" title="Reviews">
                <Dot className="bg-accent" />
                {counts.review}
                <span className="sr-only"> reviews,</span>
              </span>
              <span className="flex items-center gap-1.5" title="New">
                <Dot className="bg-xp" />
                {counts.new}
                <span className="sr-only"> new</span>
              </span>
            </p>
          )}
        </div>

        {(current.kind !== 'review' || faces.isReverse || faces.clozeOrdinal !== undefined) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {current.kind === 'new' && <Badge tone="xp">New card</Badge>}
            {current.kind === 'learning' && <Badge tone="streak">Learning</Badge>}
            {faces.isReverse && <Badge>Reverse</Badge>}
            {faces.clozeOrdinal !== undefined && <Badge>Fill in the blank</Badge>}
          </div>
        )}

        <article
          aria-label="Question"
          className="text-[22px] leading-normal font-medium sm:text-[26px]"
        >
          <RichText
            source={faces.prompt}
            cloze={
              faces.clozeOrdinal === undefined
                ? undefined
                : { ordinal: faces.clozeOrdinal, reveal: phase === 'answer' }
            }
          />
        </article>

        {mode === 'typed' && phase === 'question' && (
          <div className="mt-8 space-y-3">
            <Textarea
              mono
              ref={p.inputRef}
              aria-label="Your answer"
              placeholder="Type your answer — $…$ for math. Enter to check."
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={2}
            />
            {typed.includes('$') && (
              <div className={cn(surface, 'px-4 py-3 text-lg')}>
                <RichText source={typed} />
              </div>
            )}
          </div>
        )}

        {mode === 'drawn' && phase === 'question' && (
          <div className="mt-8 flex flex-1 flex-col">
            <Sketchpad strokes={strokes} onChange={setStrokes} />
          </div>
        )}

        {phase === 'answer' && (
          <AnswerPanel
            faces={faces}
            mode={mode}
            typed={typed}
            strokes={strokes}
            item={item}
            showWhy={p.showWhy}
            toggleWhy={p.toggleWhy}
            answerRef={p.answerRef}
          />
        )}
      </div>
    </div>
  );
}
