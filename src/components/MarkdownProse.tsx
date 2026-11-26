import React from 'react';

interface MarkdownProseProps {
  text: string;
}

/**
 * Safe JSX Markdown renderer for AI assistant responses.
 * Renders headings, bullet lists, bold, and italic inline segments without
 * ever using dangerouslySetInnerHTML (XSS-safe by construction).
 */
export function MarkdownProse({ text }: MarkdownProseProps) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyBase: number) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${keyBase}`} className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(idx);
      return;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2).trim());
      return;
    }

    flushList(idx);

    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h4-${idx}`} className="font-display text-sm font-bold text-slate-900 pt-1">
          {renderInline(line.slice(4))}
        </h4>
      );
      return;
    }

    if (line.startsWith('## ') || line.startsWith('# ')) {
      blocks.push(
        <h3 key={`h3-${idx}`} className="font-display text-base font-bold text-slate-900 pt-1">
          {renderInline(line.replace(/^#+\s*/, ''))}
        </h3>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className="text-sm text-slate-700 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-2.5">{blocks}</div>;
}

function renderInline(line: string): React.ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={i} className="italic text-slate-600">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={i}>{token}</React.Fragment>;
  });
}
