import { memo, useEffect, useRef, useState } from 'react';
import { BookMarked, Download, Maximize2, Menu, Minimize2, Moon, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sun } from 'lucide-react';
import { MONACO_THEME_OPTIONS } from '../utils/monacoThemes.js';
import { MERMAID_THEME_OPTIONS } from '../utils/mermaidThemes.js';

function ThemeColorField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-2 py-2">
        <input
          type="color"
          value={value}
          onChange={onChange}
          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 font-mono text-xs font-semibold text-[var(--heading)]">
          {value}
        </span>
      </div>
    </label>
  );
}

function Topbar({
  topic,
  darkMode,
  setDarkMode,
  setSidebarOpen,
  leftCollapsed,
  rightCollapsed,
  setLeftCollapsed,
  setRightCollapsed,
  monacoThemePrefs,
  onMonacoThemeChange,
  onResetMonacoThemes,
  mermaidThemePrefs,
  onMermaidThemeChange,
  onResetMermaidThemes,
  onResetReaderThemes,
  onOpenExportDialog,
  fullScrollMode,
  isFullscreen,
  onToggleFullscreen,
  readMode = 'topic',
  onReadModeChange
}) {
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const themePanelRef = useRef(null);

  const renderMermaidMode = (mode, label) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--heading)]">{label}</p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-[var(--heading)]">Diagram preset</span>
          <select
            value={mermaidThemePrefs[mode].theme}
            onChange={(event) => onMermaidThemeChange(mode, 'theme', event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-semibold text-[var(--heading)] outline-none"
          >
            {MERMAID_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <ThemeColorField
            label="Accent"
            value={mermaidThemePrefs[mode].accent}
            onChange={(event) => onMermaidThemeChange(mode, 'accent', event.target.value)}
          />
          <ThemeColorField
            label="Surface"
            value={mermaidThemePrefs[mode].surface}
            onChange={(event) => onMermaidThemeChange(mode, 'surface', event.target.value)}
          />
          <ThemeColorField
            label="Lines"
            value={mermaidThemePrefs[mode].line}
            onChange={(event) => onMermaidThemeChange(mode, 'line', event.target.value)}
          />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!themePanelOpen) return undefined;

    const onPointerDown = (event) => {
      if (!themePanelRef.current?.contains(event.target)) {
        setThemePanelOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [themePanelOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--topbar)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)] lg:hidden" title="Open navigation">
            <Menu size={18} />
          </button>
          <button type="button" onClick={() => setLeftCollapsed((v) => !v)} className="hidden rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)] lg:inline-flex" title={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}>
            {leftCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              <BookMarked size={14} />
              {fullScrollMode ? 'Visible topic in full-scroll' : 'Current topic'}
            </p>
            <h2 className="truncate text-sm font-extrabold text-[var(--heading)] md:text-base">{topic?.title}</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <div className="read-mode-switch inline-flex rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-1" aria-label="Reading mode">
            <button
              type="button"
              onClick={() => onReadModeChange?.('topic')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${readMode === 'topic' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--panel-hover)]'}`}
              title="Read only the selected topic"
            >
              Single topic
            </button>
            <button
              type="button"
              onClick={() => onReadModeChange?.('full')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${readMode === 'full' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--panel-hover)]'}`}
              title="Read all notes continuously"
            >
              Full notes
            </button>
          </div>
          <button type="button" onClick={() => setRightCollapsed((v) => !v)} className="hidden rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)] xl:inline-flex" title={rightCollapsed ? 'Expand right outline' : 'Collapse right outline'}>
            {rightCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <div ref={themePanelRef} className="relative">
            <button type="button" onClick={() => setThemePanelOpen((value) => !value)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]" title="Configure reader themes">
              <Palette size={18} />
            </button>
            {themePanelOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.65rem)] z-40 w-[23rem] rounded-2xl border border-[var(--border)] bg-[var(--article-bg)] p-4 shadow-2xl shadow-slate-950/15">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Reader Themes</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onResetMonacoThemes}
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--heading)] transition hover:bg-[var(--panel-hover)]"
                  >
                    Reset Monaco
                  </button>
                  <button
                    type="button"
                    onClick={onResetMermaidThemes}
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--heading)] transition hover:bg-[var(--panel-hover)]"
                  >
                    Reset Mermaid
                  </button>
                  <button
                    type="button"
                    onClick={onResetReaderThemes}
                    className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--accent-strong)] transition hover:opacity-90"
                  >
                    Reset All
                  </button>
                </div>
                <div className="mt-3 space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--heading)]">Monaco Editor</p>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-[var(--heading)]">Light mode editor</span>
                        <select
                          value={monacoThemePrefs.light}
                          onChange={(event) => onMonacoThemeChange('light', event.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-semibold text-[var(--heading)] outline-none"
                        >
                          {MONACO_THEME_OPTIONS.light.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-[var(--heading)]">Dark mode editor</span>
                        <select
                          value={monacoThemePrefs.dark}
                          onChange={(event) => onMonacoThemeChange('dark', event.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-semibold text-[var(--heading)] outline-none"
                        >
                          {MONACO_THEME_OPTIONS.dark.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--heading)]">Mermaid Diagrams</p>
                    <div className="space-y-3">
                      {renderMermaidMode('light', 'Light mode diagrams')}
                      {renderMermaidMode('dark', 'Dark mode diagrams')}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => setDarkMode((v) => !v)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]" title="Toggle dark mode">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" onClick={onOpenExportDialog} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-black text-white shadow-sm shadow-blue-600/20 hover:opacity-90">
            <span className="inline-flex items-center gap-1"><Download size={15} /> Export PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Topbar);
