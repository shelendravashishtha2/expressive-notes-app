import { memo, useEffect, useRef, useState } from 'react';
import { BookMarked, Download, Maximize2, Menu, Minimize2, Moon, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sun } from 'lucide-react';
import { MONACO_THEME_OPTIONS } from '../utils/monacoThemes.js';

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
  onOpenExportDialog,
  fullScrollMode,
  isFullscreen,
  onToggleFullscreen,
  readMode = 'topic',
  onReadModeChange
}) {
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const themePanelRef = useRef(null);

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
            <button type="button" onClick={() => setThemePanelOpen((value) => !value)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]" title="Configure Monaco themes">
              <Palette size={18} />
            </button>
            {themePanelOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.65rem)] z-40 w-[18rem] rounded-2xl border border-[var(--border)] bg-[var(--article-bg)] p-4 shadow-2xl shadow-slate-950/15">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Monaco Themes</p>
                <div className="mt-3 space-y-3">
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
