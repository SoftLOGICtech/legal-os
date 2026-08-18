// MarkdownRenderer.jsx — Zero-dependency React Markdown & Table Renderer
import React from 'react';

function renderInline(text) {
  if (!text) return null;
  // Replace **bold**
  const parts = [];
  let remaining = text;
  let key = 0;

  // Simple regex parser for **bold**, *italic*, and `code`
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const matches = remaining.split(regex);

  return matches.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ color: 'var(--gold-300)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--gold-400)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function MarkdownRenderer({ content = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── 1. Table Detection ──
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].split('|').slice(1, -1).map(c => c.trim());
        let dataRows = tableLines.slice(1);
        
        // Skip separator row (|---|---|)
        if (dataRows.length > 0 && dataRows[0].includes('---')) {
          dataRows = dataRows.slice(1);
        }

        elements.push(
          <div key={`table_${i}`} style={{ overflowX: 'auto', margin: '14px 0', border: '1px solid var(--border-default)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'var(--font-body)', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--navy-800)', borderBottom: '2px solid var(--gold-500)' }}>
                  {headerRow.map((col, hIdx) => (
                    <th key={hIdx} style={{ padding: '10px 14px', color: 'var(--gold-400)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {renderInline(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((rowStr, rIdx) => {
                  const cells = rowStr.split('|').slice(1, -1).map(c => c.trim());
                  return (
                    <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: rIdx % 2 === 0 ? 'var(--navy-950)' : 'rgba(255,255,255,0.02)' }}>
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: '10px 14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // ── 2. Headers ──
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{ fontSize: '1.25rem', color: 'var(--gold-400)', margin: '14px 0 8px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ fontSize: '1.1rem', color: 'var(--gold-400)', margin: '12px 0 6px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ fontSize: '0.98rem', color: 'white', margin: '10px 0 4px', fontWeight: 600 }}>
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // ── 3. Blockquotes ──
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ margin: '10px 0', padding: '10px 16px', borderLeft: '3px solid var(--gold-500)', background: 'rgba(201,168,76,0.05)', borderRadius: '0 6px 6px 0', color: 'var(--text-secondary)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', lineHeight: 1.6 }}>
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // ── 4. Bullet & Numbered Lists ──
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', marginLeft: '12px', marginBottom: '4px', lineHeight: 1.5 }}>
          <span style={{ color: 'var(--gold-400)', fontWeight: 'bold' }}>•</span>
          <span>{renderInline(trimmed.replace(/^([•\-\*]\s*)/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // ── 5. Standard Paragraphs / Empty lines ──
    if (trimmed === '') {
      elements.push(<div key={i} style={{ height: '8px' }} />);
    } else {
      elements.push(
        <div key={i} style={{ marginBottom: '6px', lineHeight: 1.6 }}>
          {renderInline(line)}
        </div>
      );
    }
    i++;
  }

  return <div style={{ width: '100%' }}>{elements}</div>;
}
