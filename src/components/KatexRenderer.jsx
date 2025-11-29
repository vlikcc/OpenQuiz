import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Markdown + KaTeX destekli renderer
export default function KatexRenderer({ text, className = '' }) {
  if (!text) return null;

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Paragrafları inline span olarak render et (daha kompakt)
          p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
          // Kalın metin
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          // İtalik
          em: ({ children }) => <em className="italic">{children}</em>,
          // Kod
          code: ({ inline, children }) => 
            inline ? (
              <code className="bg-slate-100 text-rose-600 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
            ) : (
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-2">
                <code>{children}</code>
              </pre>
            ),
          // Listeler
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li className="text-slate-700">{children}</li>,
          // Başlıklar
          h1: ({ children }) => <h1 className="text-2xl font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold mb-1">{children}</h3>,
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-400 pl-4 py-1 my-2 bg-indigo-50 rounded-r-lg italic text-slate-600">
              {children}
            </blockquote>
          ),
          // Linkler
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              {children}
            </a>
          ),
          // Yatay çizgi
          hr: () => <hr className="border-slate-200 my-4" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// Markdown + KaTeX önizleme ile birlikte textarea
export function KatexEditor({ value, onChange, placeholder, className = '', rows = 3 }) {
  const hasFormulas = value?.includes('$');
  const hasMarkdown = value && (
    value.includes('**') || 
    value.includes('*') || 
    value.includes('`') || 
    value.includes('#') ||
    value.includes('- ') ||
    value.includes('> ')
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none font-mono text-sm ${className}`}
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold">KaTeX</span>
          <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold">Markdown</span>
        </div>
      </div>
      
      {/* Önizleme */}
      {value && (hasFormulas || hasMarkdown) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-[10px] uppercase text-slate-400 font-bold mb-2 flex items-center gap-2">
            <span>Önizleme</span>
            {hasFormulas && <span className="bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded">Formül</span>}
            {hasMarkdown && <span className="bg-indigo-100 text-indigo-500 px-1.5 py-0.5 rounded">Markdown</span>}
          </div>
          <div className="text-slate-800 leading-relaxed">
            <KatexRenderer text={value} />
          </div>
        </div>
      )}
      
      {/* Yardım */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div className="text-[10px] uppercase text-slate-400 font-bold mb-2">Format Yardımı</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
          <div><code className="bg-white px-1 rounded">**kalın**</code> → <strong>kalın</strong></div>
          <div><code className="bg-white px-1 rounded">*italik*</code> → <em>italik</em></div>
          <div><code className="bg-white px-1 rounded">`kod`</code> → <code className="bg-slate-100 px-1 rounded text-rose-600">kod</code></div>
          <div><code className="bg-white px-1 rounded">$x^2$</code> → formül</div>
          <div><code className="bg-white px-1 rounded">- madde</code> → liste</div>
          <div><code className="bg-white px-1 rounded">&gt; alıntı</code> → alıntı</div>
        </div>
      </div>
    </div>
  );
}

// Yaygın KaTeX örnekleri
export const KATEX_EXAMPLES = [
  { label: 'Üs', code: 'x^2', preview: 'x²' },
  { label: 'Alt indis', code: 'x_n', preview: 'xₙ' },
  { label: 'Kesir', code: '\\frac{a}{b}', preview: 'a/b' },
  { label: 'Karekök', code: '\\sqrt{x}', preview: '√x' },
  { label: 'Toplam', code: '\\sum_{i=1}^{n}', preview: 'Σ' },
  { label: 'İntegral', code: '\\int_{a}^{b}', preview: '∫' },
  { label: 'Pi', code: '\\pi', preview: 'π' },
  { label: 'Alfa', code: '\\alpha', preview: 'α' },
  { label: 'Beta', code: '\\beta', preview: 'β' },
  { label: 'Delta', code: '\\Delta', preview: 'Δ' },
  { label: 'Sonsuz', code: '\\infty', preview: '∞' },
  { label: 'Eşit değil', code: '\\neq', preview: '≠' },
  { label: 'Büyük eşit', code: '\\geq', preview: '≥' },
  { label: 'Küçük eşit', code: '\\leq', preview: '≤' },
];

// Markdown örnekleri
export const MARKDOWN_EXAMPLES = [
  { label: 'Kalın', code: '**metin**' },
  { label: 'İtalik', code: '*metin*' },
  { label: 'Kod', code: '`kod`' },
  { label: 'Liste', code: '- madde' },
  { label: 'Numaralı', code: '1. madde' },
  { label: 'Alıntı', code: '> alıntı' },
  { label: 'Başlık', code: '## Başlık' },
  { label: 'Link', code: '[metin](url)' },
];
