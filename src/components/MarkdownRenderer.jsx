import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, FileCode2 } from 'lucide-react';
import { getHeadingIdFactory, normalizeCodeFenceContent } from '../utils/text.js';
import {
  DEFAULT_MERMAID_THEME_PREFS,
  buildMermaidRenderConfig
} from '../utils/mermaidThemes.js';
import { normalizeCodeLanguage, tokenizeCodeLine } from '../utils/codeTokens.js';

const MERMAID_RENDER_ROOT_MARGIN = '640px 0px 640px 0px';

let mermaidModulePromise = null;
let mermaidRenderQueue = Promise.resolve();
const mermaidSvgCache = new Map();
const tokenLineCache = new Map();

function childrenToText(children) {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  if (children?.props?.children) return childrenToText(children.props.children);
  return '';
}

function isExternalHref(href = '') {
  return /^(?:[a-z]+:)?\/\//i.test(href);
}

function useNearViewport(rootMargin = '220px') {
  const ref = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (nearViewport) return undefined;

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { root: null, rootMargin, threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearViewport, rootMargin]);

  return [ref, nearViewport];
}

function StaticCodePreview({ code, language, hint = '' }) {
  const lines = useMemo(() => String(code).replace(/\n$/, '').split('\n'), [code]);
  return (
    <pre className="code-pre overflow-x-auto p-0" aria-label={`${language} code preview`}>
      <code className={`language-${language}`}>
        {lines.map((line, index) => (
          <span className="code-line" key={`${index}-${line.slice(0, 16)}`}>
            <span className="code-line-number">{index + 1}</span>
            <span className="code-line-text">{line || ' '}</span>
          </span>
        ))}
        {hint ? (
          <span className="code-line code-line-fade">
            <span className="code-line-number">i</span>
            <span className="code-line-text">{hint}</span>
          </span>
        ) : null}
      </code>
    </pre>
  );
}

async function getMermaidModule() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((module) => module.default);
  }
  return mermaidModulePromise;
}

function queueMermaidRender(task) {
  const queuedTask = mermaidRenderQueue.then(task, task);
  mermaidRenderQueue = queuedTask.then(() => undefined, () => undefined);
  return queuedTask;
}

function rememberMermaidSvg(cacheKey, svg) {
  mermaidSvgCache.set(cacheKey, svg);
  if (mermaidSvgCache.size <= 80) return;
  const firstKey = mermaidSvgCache.keys().next().value;
  if (firstKey) mermaidSvgCache.delete(firstKey);
}

function tokenClassName(type = 'text') {
  switch (type) {
    case 'comment': return 'code-token-comment';
    case 'keyword': return 'code-token-keyword';
    case 'string': return 'code-token-string';
    case 'number': return 'code-token-number';
    case 'function': return 'code-token-function';
    case 'operator': return 'code-token-operator';
    case 'property': return 'code-token-property';
    case 'punctuation': return 'code-token-punctuation';
    default: return 'code-token-text';
  }
}

function getTokenizedCodeLines(code, language) {
  const cacheKey = `${language}\u0000${code}`;
  if (tokenLineCache.has(cacheKey)) return tokenLineCache.get(cacheKey);

  const tokenLines = code
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => tokenizeCodeLine(line || ' ', language));

  tokenLineCache.set(cacheKey, tokenLines);
  if (tokenLineCache.size <= 140) return tokenLines;

  const firstKey = tokenLineCache.keys().next().value;
  if (firstKey) tokenLineCache.delete(firstKey);
  return tokenLines;
}

const CodeBlock = memo(function CodeBlock({
  code,
  language = 'text',
  pdfMode = false
}) {
  const [copied, setCopied] = useState(false);
  const lang = normalizeCodeLanguage(language);
  const normalizedCode = useMemo(
    () => normalizeCodeFenceContent(code, lang),
    [code, lang]
  );
  const tokenLines = useMemo(
    () => getTokenizedCodeLines(normalizedCode, lang),
    [normalizedCode, lang]
  );

  const copy = async () => {
    await navigator.clipboard.writeText(normalizedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (pdfMode) {
    return <pre className="pdf-code-block"><code>{normalizedCode}</code></pre>;
  }

  return (
    <div
      className="code-shell group my-7 overflow-hidden rounded-[1.6rem] border border-[var(--code-border)] bg-[var(--code-bg)]"
      data-code-block="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--code-border)] bg-[var(--code-top)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--code-label)]">
          <FileCode2 size={15} />
          <span>{lang}</span>
          <span className="text-[10px] font-semibold normal-case tracking-normal opacity-75">static themed renderer</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-[var(--code-border)] bg-[var(--code-button)] px-2 py-1 text-xs font-bold text-[var(--code-button-text)] transition hover:opacity-80">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="code-pre overflow-x-auto p-0" aria-label={`${lang} code block`}>
        <code className={`language-${lang}`}>
          {tokenLines.map((tokens, lineIndex) => (
            <span className="code-line" key={`${lineIndex}-${lang}`}>
              <span className="code-line-number">{lineIndex + 1}</span>
              <span className="code-line-text">
                {tokens.map((token, tokenIndex) => (
                  <span key={`${lineIndex}-${tokenIndex}-${token.text}`} className={tokenClassName(token.type)}>
                    {token.text}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </code>
      </pre>
      <pre className="pdf-only"><code>{normalizedCode}</code></pre>
    </div>
  );
});

const MermaidBlock = memo(function MermaidBlock({
  code,
  darkMode = true,
  mermaidThemePrefs = DEFAULT_MERMAID_THEME_PREFS,
  pdfMode = false
}) {
  const reactId = useId().replace(/:/g, '');
  const idRef = useRef(`mermaid-${reactId}-${Math.random().toString(36).slice(2)}`);
  const renderVersionRef = useRef(0);
  const [containerRef, nearViewport] = useNearViewport(MERMAID_RENDER_ROOT_MARGIN);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const source = useMemo(
    () => normalizeCodeFenceContent(code, 'mermaid').trim(),
    [code]
  );

  useEffect(() => {
    if (!nearViewport || !source) return undefined;
    let cancelled = false;
    async function render() {
      try {
        setError('');
        setRendering(true);
        const config = buildMermaidRenderConfig(mermaidThemePrefs, darkMode);
        const cacheKey = JSON.stringify({
          source,
          theme: config.theme,
          look: config.look,
          darkMode: config.darkMode,
          themeVariables: config.themeVariables
        });
        if (mermaidSvgCache.has(cacheKey)) {
          if (!cancelled) {
            setSvg(mermaidSvgCache.get(cacheKey) || '');
            setRendering(false);
          }
          return;
        }
        const renderId = `${idRef.current}-${renderVersionRef.current + 1}`;
        renderVersionRef.current += 1;
        const nextSvg = await queueMermaidRender(async () => {
          const mermaid = await getMermaidModule();
          mermaid.initialize(config);
          const result = await mermaid.render(renderId, source);
          return result.svg || '';
        });

        if (!cancelled) {
          rememberMermaidSvg(cacheKey, nextSvg);
          setSvg(nextSvg);
          setRendering(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to render Mermaid diagram');
          setSvg('');
          setRendering(false);
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [nearViewport, source, darkMode, mermaidThemePrefs]);

  if (pdfMode) {
    return <pre className="pdf-code-block"><code>{source}</code></pre>;
  }

  return (
    <div
      ref={containerRef}
      className="diagram-shell my-7 overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--diagram-bg)]"
      data-mermaid-block="true"
    >
      <div className="border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Mermaid flow diagram</div>
      <div className="min-h-[180px] overflow-x-auto p-4">
        {!source ? (
          <div className="rounded-xl border border-red-300/50 bg-red-500/10 p-4 text-sm font-semibold text-red-500">Empty Mermaid source. Diagram was not rendered.</div>
        ) : error ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-red-300/50 bg-red-500/10 p-3 text-sm font-bold text-red-500">Diagram could not render. Source is shown below.</p>
            <StaticCodePreview code={source} language="mermaid" />
          </div>
        ) : svg ? (
          <div className={`mermaid-svg${rendering ? ' is-rendering' : ''}`} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="diagram-skeleton flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm font-semibold text-[var(--muted)]">
            {nearViewport ? 'Rendering diagram…' : 'Diagram will render as you approach this section.'}
          </div>
        )}
      </div>
    </div>
  );
});

function MarkdownRenderer({
  content,
  darkMode = true,
  mermaidThemePrefs = DEFAULT_MERMAID_THEME_PREFS,
  pdfMode = false,
  topicId = '',
  headingIdPrefix = ''
}) {
  const markdown = content || '';
  const getHeadingId = getHeadingIdFactory(markdown);

  const heading = (level, className) => ({ children }) => {
    const title = childrenToText(children);
    const baseId = getHeadingId(level, title);
    const domId = headingIdPrefix ? `${headingIdPrefix}${baseId}` : baseId;
    const Tag = `h${level}`;
    return (
      <Tag
        id={domId}
        data-heading-id={baseId}
        data-heading-key={topicId ? `${topicId}:${baseId}` : baseId}
        data-topic-id={topicId || undefined}
        className={className}
      >
        {children}
      </Tag>
    );
  };

  const components = {
    h1: heading(1, 'mt-10 scroll-mt-28 text-4xl font-black tracking-tight text-[var(--heading)]'),
    h2: heading(2, 'mt-12 scroll-mt-28 border-t border-[var(--border)] pt-9 text-3xl font-black tracking-tight text-[var(--heading)] first:mt-0 first:border-t-0 first:pt-0'),
    h3: heading(3, 'mt-9 scroll-mt-28 text-2xl font-extrabold text-[var(--heading)]'),
    h4: heading(4, 'mt-7 scroll-mt-28 text-xl font-bold text-[var(--heading)]'),
    p: ({ children }) => <p className="my-4 text-[15.8px] leading-8 text-[var(--article-text)]">{children}</p>,
    ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6 text-[15.8px] leading-8 text-[var(--article-text)]">{children}</ul>,
    ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-[15.8px] leading-8 text-[var(--article-text)]">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-8">{children}</li>,
    blockquote: ({ children }) => <blockquote className="doc-callout my-7 rounded-[1.4rem] border border-[var(--border)] border-l-[5px] border-l-[var(--accent)] bg-[var(--quote-bg)] px-5 py-4 text-[var(--quote-text)]">{children}</blockquote>,
    table: ({ children }) => <div className="doc-table-shell my-7 overflow-x-auto rounded-[1.4rem] border border-[var(--border)] bg-[var(--table-bg)]"><table className="min-w-full border-collapse text-left text-sm">{children}</table></div>,
    th: ({ children }) => <th className="border-b border-[var(--border)] bg-[var(--table-head)] px-4 py-3 font-black text-[var(--heading)]">{children}</th>,
    td: ({ children }) => <td className="border-b border-[var(--border)] px-4 py-3 align-top text-[var(--article-text)]">{children}</td>,
    pre: ({ children }) => <>{children}</>,
    code: ({ inline, className, children }) => {
      const text = String(children).replace(/\n$/, '');
      const match = /language-([a-zA-Z0-9_-]+)/.exec(className || '');
      const language = match?.[1] || 'text';
      const isBlock = !inline && (match || text.includes('\n'));
      if (isBlock && normalizeCodeLanguage(language) === 'mermaid') {
        return <MermaidBlock code={text} darkMode={darkMode} mermaidThemePrefs={mermaidThemePrefs} pdfMode={pdfMode} />;
      }
      if (isBlock) {
        return <CodeBlock code={text} language={language} pdfMode={pdfMode} />;
      }
      return <code className="rounded-lg border border-[var(--border)] bg-[var(--inline-code-bg)] px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-[var(--inline-code-text)]">{children}</code>;
    },
    a: ({ href, children }) => <a href={href} target={isExternalHref(href) ? '_blank' : undefined} rel={isExternalHref(href) ? 'noreferrer' : undefined} className="font-bold text-[var(--link)] underline decoration-[var(--link)]/40 underline-offset-4">{children}</a>,
    img: ({ src, alt }) => <img src={src} alt={alt || ''} loading="lazy" className="my-6 rounded-2xl border border-[var(--border)]" />
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}

export default memo(MarkdownRenderer);
