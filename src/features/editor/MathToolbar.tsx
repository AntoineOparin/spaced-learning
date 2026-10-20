/** One-tap LaTeX snippets. `|` in a snippet marks where the caret goes. */
export const SNIPPETS: { label: string; insert: string; title: string }[] = [
  { label: '$x$', insert: '$|$', title: 'Inline math' },
  { label: '$$', insert: '\n$$\n|\n$$\n', title: 'Display math' },
  { label: 'a/b', insert: '\\frac{|}{}', title: 'Fraction' },
  { label: '√', insert: '\\sqrt{|}', title: 'Square root' },
  { label: 'xⁿ', insert: '^{|}', title: 'Superscript' },
  { label: 'xₙ', insert: '_{|}', title: 'Subscript' },
  { label: '∫', insert: '\\int_{|}^{} \\,dx', title: 'Integral' },
  { label: 'Σ', insert: '\\sum_{n=1}^{\\infty} |', title: 'Series' },
  { label: 'lim', insert: '\\lim_{x \\to |}', title: 'Limit' },
  { label: '∞', insert: '\\infty', title: 'Infinity' },
  { label: 'θ', insert: '\\theta', title: 'theta' },
  { label: 'π', insert: '\\pi', title: 'pi' },
];

export function MathToolbar({
  onInsert,
  onCloze,
}: {
  onInsert: (snippet: string) => void;
  /** Present for cloze items: wraps the selection in the next {{cN::…}}. */
  onCloze?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Insert math">
      {SNIPPETS.map((s) => (
        <button
          key={s.title}
          type="button"
          title={s.title}
          onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
          onClick={() => onInsert(s.insert)}
          className="h-8 min-w-8 rounded-lg border border-line bg-bg px-2 font-mono text-xs text-muted transition-[color,border-color,transform] duration-150 hover:border-line-strong hover:text-fg active:scale-95"
        >
          {s.label}
        </button>
      ))}
      {onCloze && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCloze}
          className="h-8 rounded-lg border border-xp/40 bg-xp-soft px-2.5 text-xs font-bold text-xp-text transition-transform duration-150 active:scale-95"
          title="Wrap selection in a cloze deletion (Ctrl/⌘ + Shift + C)"
        >
          {'{{c::}}'} Cloze
        </button>
      )}
    </div>
  );
}
