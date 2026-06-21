import { lazy, memo, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, FileCode2, Maximize2, Minimize2 } from 'lucide-react';
import { getHeadingIdFactory, normalizeCodeFenceContent } from '../utils/text.js';
import { defineNotesMonacoThemes, isDarkMonacoTheme } from '../utils/monacoThemes.js';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));
const INLINE_MONACO_LINE_LIMIT = 20;

function normalizeLanguage(language = '') {
  const lang = String(language).toLowerCase().replace('language-', '').trim();
  const aliases = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    shellscript: 'shell',
    yml: 'yaml',
    tf: 'hcl',
    terraform: 'hcl',
    hcl: 'hcl',
    txt: 'text',
    plain: 'text',
    plaintext: 'text',
    docker: 'dockerfile'
  };
  return aliases[lang] || lang || 'text';
}

function monacoLanguage(language) {
  const lang = normalizeLanguage(language);
  const supported = {
    javascript: 'javascript',
    typescript: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    python: 'python',
    json: 'json',
    yaml: 'yaml',
    markdown: 'markdown',
    html: 'html',
    css: 'css',
    sql: 'sql',
    shell: 'shell',
    bash: 'shell',
    dockerfile: 'dockerfile',
    hcl: 'plaintext',
    mermaid: 'plaintext',
    text: 'plaintext'
  };
  return supported[lang] || 'plaintext';
}

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

function useLazyVisible(rootMargin = '220px') {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { root: null, rootMargin, threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return [ref, visible];
}

function StaticCodePreview({ code, language, hint = '' }) {
  const lines = useMemo(() => String(code).replace(/\n$/, '').split('\n'), [code]);
  const previewLines = lines.slice(0, 48);
  const truncated = lines.length > previewLines.length;
  return (
    <pre className="code-pre overflow-x-auto p-0" aria-label={`${language} code preview`}>
      <code className={`language-${language}`}>
        {previewLines.map((line, index) => (
          <span className="code-line" key={`${index}-${line.slice(0, 16)}`}>
            <span className="code-line-number">{index + 1}</span>
            <span className="code-line-text">{line || ' '}</span>
          </span>
        ))}
        {truncated && (
          <span className="code-line code-line-fade">
            <span className="code-line-number">…</span>
            <span className="code-line-text">Preview truncated. Expand this block to open the full Monaco editor.</span>
          </span>
        )}
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

const CodeBlock = memo(function CodeBlock({
  code,
  language = 'text',
  darkMode = true,
  monacoTheme = 'notes-dark',
  pdfMode = false
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [containerRef, visible] = useLazyVisible('260px');
  const lang = normalizeLanguage(language);
  const normalizedCode = useMemo(
    () => normalizeCodeFenceContent(code, lang),
    [code, lang]
  );
  const lines = useMemo(() => normalizedCode.replace(/\n$/, '').split('\n'), [normalizedCode]);
  const shouldMountMonaco = visible && (expanded || lines.length <= INLINE_MONACO_LINE_LIMIT);
  const allowVerticalScroll = expanded && lines.length > INLINE_MONACO_LINE_LIMIT;
  const editorHeight = expanded
    ? '78vh'
    : `${Math.min(420, Math.max(126, lines.length * 22 + 54))}px`;
  const surfaceTone = isDarkMonacoTheme(monacoTheme) ? 'dark' : 'light';
  const modeLabel = shouldMountMonaco
    ? (allowVerticalScroll ? 'expanded editor with its own scroll' : 'inline editor without wheel capture')
    : (visible ? 'static preview · expand for Monaco' : 'static preview · lazy Monaco');

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
      ref={containerRef}
      className="code-shell group my-7 overflow-hidden rounded-[1.6rem] border border-[var(--code-border)] bg-[var(--code-bg)] shadow-[0_24px_48px_-24px_rgba(2,6,23,0.6)]"
      data-code-block="true"
      data-monaco-surface={surfaceTone}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--code-border)] bg-[var(--code-top)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--code-label)]">
          <FileCode2 size={15} />
          <span>{lang}</span>
          <span className="text-[10px] font-semibold normal-case tracking-normal opacity-75">{modeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--code-border)] bg-[var(--code-button)] px-2 py-1 text-xs font-bold text-[var(--code-label)] transition hover:opacity-80" title="Toggle inline editor height">
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {expanded ? 'Compact' : 'Expand'}
          </button>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-[var(--code-border)] bg-[var(--code-button)] px-2 py-1 text-xs font-bold text-[var(--code-label)] transition hover:opacity-80">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div
        style={{ minHeight: visible ? editorHeight : undefined }}
        className={`monaco-inline-wrap ${allowVerticalScroll ? 'monaco-inline-scrollable' : 'monaco-inline-static'}`}
      >
        {shouldMountMonaco ? (
          <Suspense fallback={<StaticCodePreview code={normalizedCode} language={lang} />}>
            <MonacoEditor
              beforeMount={defineNotesMonacoThemes}
              height={editorHeight}
              defaultLanguage={monacoLanguage(lang)}
              language={monacoLanguage(lang)}
              value={normalizedCode}
              theme={monacoTheme}
              options={{
                readOnly: true,
                domReadOnly: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                folding: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                fontSize: 13.5,
                lineHeight: 22,
                padding: { top: 14, bottom: 14 },
                automaticLayout: true,
                renderLineHighlight: 'none',
                selectionHighlight: false,
                occurrencesHighlight: 'off',
                matchBrackets: 'never',
                contextmenu: false,
                links: false,
                hover: { enabled: false },
                glyphMargin: false,
                stickyScroll: { enabled: false },
                guides: { indentation: false, highlightActiveIndentation: false },
                overviewRulerLanes: 0,
                scrollbar: {
                  vertical: allowVerticalScroll ? 'auto' : 'hidden',
                  horizontal: 'auto',
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                  handleMouseWheel: expanded,
                  alwaysConsumeMouseWheel: false,
                  useShadows: false
                },
                mouseWheelZoom: false,
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'off'
              }}
            />
          </Suspense>
        ) : (
          <StaticCodePreview
            code={normalizedCode}
            language={lang}
            hint={lines.length > INLINE_MONACO_LINE_LIMIT ? 'Expand this block to open Monaco without interrupting page scroll.' : ''}
          />
        )}
      </div>
      <pre className="pdf-only"><code>{normalizedCode}</code></pre>
    </div>
  );
});

const MermaidBlock = memo(function MermaidBlock({ code, darkMode = true, pdfMode = false }) {
  const reactId = useId().replace(/:/g, '');
  const idRef = useRef(`mermaid-${reactId}-${Math.random().toString(36).slice(2)}`);
  const [containerRef, visible] = useLazyVisible('300px');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const source = useMemo(
    () => normalizeCodeFenceContent(code, 'mermaid').trim(),
    [code]
  );

  useEffect(() => {
    if (!visible || !source) return undefined;
    let cancelled = false;
    async function render() {
      try {
        setError('');
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: darkMode ? 'dark' : 'default',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: true }
        });
        const result = await mermaid.render(idRef.current, source);
        if (!cancelled) setSvg(result.svg || '');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to render Mermaid diagram');
          setSvg('');
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [visible, source, darkMode]);

  if (pdfMode) {
    return <pre className="pdf-code-block"><code>{source}</code></pre>;
  }

  return (
    <div
      ref={containerRef}
      className="diagram-shell my-7 overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--diagram-bg)] shadow-[0_20px_40px_-30px_rgba(37,99,235,0.55)]"
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
          <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="diagram-skeleton flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm font-semibold text-[var(--muted)]">
            {visible ? 'Rendering diagram…' : 'Diagram will render when it reaches the viewport.'}
          </div>
        )}
      </div>
    </div>
  );
});

function MarkdownRenderer({
  content,
  darkMode = true,
  monacoTheme = darkMode ? 'notes-dark' : 'notes-light',
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
    blockquote: ({ children }) => <blockquote className="doc-callout my-7 rounded-[1.4rem] border border-[var(--border)] border-l-[5px] border-l-[var(--accent)] bg-[var(--quote-bg)] px-5 py-4 text-[var(--quote-text)] shadow-[0_18px_35px_-30px_rgba(37,99,235,0.55)]">{children}</blockquote>,
    table: ({ children }) => <div className="doc-table-shell my-7 overflow-x-auto rounded-[1.4rem] border border-[var(--border)] bg-[var(--table-bg)] shadow-[0_16px_34px_-28px_rgba(15,23,42,0.35)]"><table className="min-w-full border-collapse text-left text-sm">{children}</table></div>,
    th: ({ children }) => <th className="border-b border-[var(--border)] bg-[var(--table-head)] px-4 py-3 font-black text-[var(--heading)]">{children}</th>,
    td: ({ children }) => <td className="border-b border-[var(--border)] px-4 py-3 align-top text-[var(--article-text)]">{children}</td>,
    pre: ({ children }) => <>{children}</>,
    code: ({ inline, className, children }) => {
      const text = String(children).replace(/\n$/, '');
      const match = /language-([a-zA-Z0-9_-]+)/.exec(className || '');
      const language = match?.[1] || 'text';
      const isBlock = !inline && (match || text.includes('\n'));
      if (isBlock && normalizeLanguage(language) === 'mermaid') {
        return <MermaidBlock code={text} darkMode={darkMode} pdfMode={pdfMode} />;
      }
      if (isBlock) {
        return <CodeBlock code={text} language={language} darkMode={darkMode} monacoTheme={monacoTheme} pdfMode={pdfMode} />;
      }
      return <code className="rounded-lg border border-[var(--border)] bg-[var(--inline-code-bg)] px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-[var(--inline-code-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">{children}</code>;
    },
    a: ({ href, children }) => <a href={href} target={isExternalHref(href) ? '_blank' : undefined} rel={isExternalHref(href) ? 'noreferrer' : undefined} className="font-bold text-[var(--link)] underline decoration-[var(--link)]/40 underline-offset-4">{children}</a>,
    img: ({ src, alt }) => <img src={src} alt={alt || ''} loading="lazy" className="my-6 rounded-2xl border border-[var(--border)] shadow-lg" />
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}

export default memo(MarkdownRenderer);
