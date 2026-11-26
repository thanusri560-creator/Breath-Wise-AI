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
        {listItems.map((item, itemOffset) => (
          <li key={`li-${keyBase}-${itemOffset}-${item.slice(0, 24)}`}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, lineIdx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(lineIdx);
      return;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2).trim());
      return;
    }

    flushList(lineIdx);

    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h4-${lineIdx}-${line.slice(4, 24)}`} className="font-display text-sm font-bold text-slate-900 pt-1">
          {renderInline(line.slice(4))}
        </h4>
      );
      return;
    }

    if (line.startsWith('## ') || line.startsWith('# ')) {
      blocks.push(
        <h3 key={`h3-${lineIdx}-${line.slice(2, 24)}`} className="font-display text-base font-bold text-slate-900 pt-1">
          {renderInline(line.replace(/^#+\s*/, ''))}
        </h3>
      );
      return;
    }

    blocks.push(
      <p key={`p-${lineIdx}-${line.slice(0, 24)}`} className="text-sm text-slate-700 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-2.5">{blocks}</div>;
}

function renderInline(line: string): React.ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  let charOffset = 0;
  return tokens.map((token) => {
    const tokenKey = `${charOffset}-${token.slice(0, 16)}`;
    charOffset += token.length;
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={`b-${tokenKey}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={`em-${tokenKey}`} className="italic text-slate-600">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={`t-${tokenKey}`}>{token}</React.Fragment>;
  });
}
