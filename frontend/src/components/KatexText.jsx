import { Suspense, lazy } from 'react';

const KatexRenderer = lazy(() => import('./KatexRenderer'));
const KatexEditorImpl = lazy(() =>
  import('./KatexRenderer').then((m) => ({ default: m.KatexEditor })),
);

/**
 * Renders markdown + KaTeX, but keeps the typesetting stack out of the initial
 * bundle. Only exam polls tend to contain formulas, so most sessions never pay
 * for it. The fallback is the raw source text, which is what the reader would
 * otherwise stare at a blank space for.
 */
export default function KatexText({ text, className = '' }) {
  if (!text) return null;

  return (
    <Suspense fallback={<div className={className}>{text}</div>}>
      <KatexRenderer text={text} className={className} />
    </Suspense>
  );
}

/** The authoring textarea, from the same chunk as the renderer above. */
export function KatexTextEditor(props) {
  return (
    <Suspense
      fallback={
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 3}
          className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none font-mono text-sm"
        />
      }
    >
      <KatexEditorImpl {...props} />
    </Suspense>
  );
}
