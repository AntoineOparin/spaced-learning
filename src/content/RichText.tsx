import { type ReactNode, useMemo } from 'react';
import { renderCloze } from '../domain/cloze';
import { cn } from '../ui/cn';
import { renderMath } from './katex';
import { type Block, type Inline, parseMarkup } from './markup';

function MathNode({ tex, display }: { tex: string; display: boolean }) {
  const result = renderMath(tex, display);
  if (!result.ok) {
    return (
      <code className="math-error" title={result.error}>
        {display ? `$$${tex}$$` : `$${tex}$`}
      </code>
    );
  }
  const Tag = display ? 'div' : 'span';
  return (
    <Tag
      className={display ? 'math-display' : 'math-inline'}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output escapes its input; trust is limited to \htmlClass.
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    const key = i;
    switch (node.t) {
      case 'text':
        return node.v;
      case 'br':
        return <br key={key} />;
      case 'strong':
        return <strong key={key}>{renderInline(node.c)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(node.c)}</em>;
      case 'code':
        return <code key={key}>{node.v}</code>;
      case 'math':
        return <MathNode key={key} tex={node.tex} display={node.display} />;
      case 'clozeBlank':
        return (
          <span key={key} className="cloze-blank">
            {node.c.length ? renderInline(node.c) : '[…]'}
          </span>
        );
      case 'clozeAnswer':
        return (
          <span key={key} className="cloze-answer">
            {renderInline(node.c)}
          </span>
        );
      default:
        return null;
    }
  });
}

function hasDisplayMath(nodes: Inline[]): boolean {
  return nodes.some((n) => n.t === 'math' && n.display);
}

function renderBlock(block: Block, i: number): ReactNode {
  switch (block.t) {
    case 'p': {
      // A <div> can't live inside <p>, so paragraphs with display math become divs.
      const Tag = hasDisplayMath(block.c) ? 'div' : 'p';
      return <Tag key={i}>{renderInline(block.c)}</Tag>;
    }
    case 'ul':
    case 'ol': {
      const List = block.t;
      return (
        <List key={i}>
          {block.items.map((it, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static parsed content
            <li key={j}>{renderInline(it)}</li>
          ))}
        </List>
      );
    }
    default:
      return null;
  }
}

export interface RichTextProps {
  source: string;
  /** Render as the card for cloze `ordinal`, blanked or revealed. */
  cloze?: { ordinal: number; reveal: boolean };
  className?: string;
}

export function RichText({ source, cloze, className }: RichTextProps) {
  const ordinal = cloze?.ordinal;
  const reveal = cloze?.reveal;
  const blocks = useMemo(() => {
    const text = ordinal === undefined ? source : renderCloze(source, ordinal, reveal ?? false);
    return parseMarkup(text);
  }, [source, ordinal, reveal]);

  return <div className={cn('rich-text', className)}>{blocks.map(renderBlock)}</div>;
}
