import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookMarked, Download, ListFilter, Maximize2, Menu, Minimize2, Moon, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sun, X } from 'lucide-react';
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

function ThemeSettingsDialog({
  open,
  onClose,
  monacoThemePrefs,
  onMonacoThemeChange,
  onResetMonacoThemes,
  mermaidThemePrefs,
  onMermaidThemeChange,
  onResetMermaidThemes,
  onResetReaderThemes
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

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

  return createPortal(
    <div
      className="fixed inset-0 z-[130] overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reader theme settings"
          onClick={(event) => event.stopPropagation()}
          className="my-8 flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--article-bg)] shadow-[0_2rem_5rem_rgba(2,6,23,0.38)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Reader Themes</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--heading)] sm:text-2xl">Monaco and Mermaid settings</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Set code editor themes separately for light and dark mode, then tune Mermaid diagram palettes.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-2xl border border-[var(--border)] p-3 text-[var(--muted)] transition hover:bg-[var(--panel-hover)]"
              title="Close theme settings"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex max-h-[min(78vh,58rem)] flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
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
        </div>
      </div>
    </div>,
    document.body
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
  onOpenSelectionDialog,
  customSelectionActive = false,
  fullScrollMode,
  isFullscreen,
  onToggleFullscreen,
  readMode = 'topic',
  onReadModeChange
}) {
  const [themePanelOpen, setThemePanelOpen] = useState(false);

  return (
    <>
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
            <button
              type="button"
              onClick={() => setThemePanelOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={themePanelOpen}
              className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]"
              title="Configure reader themes"
            >
              <Palette size={18} />
            </button>
            <button type="button" onClick={() => setDarkMode((v) => !v)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]" title="Toggle dark mode">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              onClick={onOpenSelectionDialog}
              className={`rounded-xl px-3 py-2 text-xs font-black shadow-sm transition hover:opacity-90 ${customSelectionActive ? 'bg-[var(--accent)] text-white shadow-blue-600/20' : 'border border-[var(--border)] text-[var(--heading)] hover:bg-[var(--panel-hover)]'}`}
            >
              <span className="inline-flex items-center gap-1"><ListFilter size={15} /> {customSelectionActive ? 'Selected Notes' : 'Select Notes'}</span>
            </button>
            <button type="button" onClick={onOpenExportDialog} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-black text-white shadow-sm shadow-blue-600/20 hover:opacity-90">
              <span className="inline-flex items-center gap-1"><Download size={15} /> Export PDF</span>
            </button>
          </div>
        </div>
      </header>

      <ThemeSettingsDialog
        open={themePanelOpen}
        onClose={() => setThemePanelOpen(false)}
        monacoThemePrefs={monacoThemePrefs}
        onMonacoThemeChange={onMonacoThemeChange}
        onResetMonacoThemes={onResetMonacoThemes}
        mermaidThemePrefs={mermaidThemePrefs}
        onMermaidThemeChange={onMermaidThemeChange}
        onResetMermaidThemes={onResetMermaidThemes}
        onResetReaderThemes={onResetReaderThemes}
      />
    </>
  );
}

export default memo(Topbar);
