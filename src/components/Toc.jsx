import { memo } from 'react';
import { ChevronsLeft, ChevronsRight, ListTree } from 'lucide-react';

function levelClass(level) {
  if (level === 4) return 'ml-7 text-[12px] font-semibold opacity-85';
  if (level === 3) return 'ml-4 text-[12px] font-bold';
  return 'text-sm font-black';
}

function Toc({ topic, sections = [], activeSectionId, onJump, collapsed, setCollapsed }) {

  if (collapsed) {
    return (
      <aside className="toc-panel toc-collapsed hidden border-l border-[var(--border)] bg-[var(--rightbar)] xl:sticky xl:top-0 xl:block xl:h-screen">
        <div className="flex h-full flex-col items-center gap-3 p-3">
          <button type="button" onClick={() => setCollapsed(false)} className="rounded-2xl border border-[var(--border)] p-3 text-[var(--muted)] transition hover:bg-[var(--panel-hover)]" title="Expand topic outline">
            <ChevronsLeft size={17} />
          </button>
          <div className="vertical-label text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Topic</div>
          <ListTree size={20} className="text-[var(--accent-strong)]" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="toc-panel hidden h-screen overflow-y-auto border-l border-[var(--border)] bg-[var(--rightbar)] p-5 xl:sticky xl:top-0 xl:block">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">On this topic</p>
          <p className="text-xs leading-5 text-[var(--muted)]">Nested headings stay visible while the center reads like one long technical answer.</p>
        </div>
        <button type="button" onClick={() => setCollapsed(true)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] transition hover:bg-[var(--panel-hover)]" title="Collapse topic outline">
          <ChevronsRight size={16} />
        </button>
      </div>

      {sections.length ? (
        <div className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onJump(section)}
              className={`toc-link block w-full rounded-xl px-3 py-2 text-left leading-5 text-[var(--toc-text)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--heading)] ${levelClass(section.level)} ${activeSectionId === section.id ? 'active' : ''}`}
            >
              {section.title}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm font-semibold text-[var(--muted)]">No h2/h3/h4 headings found in this topic.</p>
      )}
    </aside>
  );
}

export default memo(Toc);
