import { memo, useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import ExportTree from './ExportTree.jsx';

function statusTone(status) {
  if (status === 'error') return 'border-red-300/60 bg-red-500/10 text-red-600 dark:text-red-300';
  if (status === 'completed') return 'border-blue-300/60 bg-blue-500/10 text-blue-700 dark:text-blue-200';
  return 'border-[var(--border)] bg-[var(--panel-soft)] text-[var(--heading)]';
}

function ExportDialog({
  open,
  onClose,
  tree,
  selectedIds,
  selectedCount,
  scopeLabel,
  currentTopicTitle,
  currentSectionTitle,
  canSelectCurrentSection,
  onToggleCheck,
  onSelectAll,
  onClearAll,
  onSelectCurrentTopic,
  onSelectCurrentSection,
  onExport,
  status,
  stage,
  progress,
  error,
  onCancel
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set(tree.expandableIds));
  const isBusy = ['queued', 'preparing', 'rendering', 'finalizing'].includes(status);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (open) {
      setExpandedIds(new Set(tree.expandableIds));
    }
  }, [open, tree]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-start justify-center py-2 lg:items-center">
        <div className="flex max-h-[96vh] w-full flex-col overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--article-bg)] shadow-2xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Cookbook Export</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--heading)]">Export selected notes as a PDF</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Choose the scope you want, then let the PDF run in the background while you keep using the notes app smoothly.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[var(--border)] p-3 text-[var(--muted)] transition hover:bg-[var(--panel-hover)]"
              title="Close export dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-[var(--border)] p-5 lg:border-b-0 lg:border-r">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Quick Selection</p>
              <div className="grid gap-2">
                <button type="button" onClick={onSelectAll} disabled={isBusy} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)]">
                  All notes
                </button>
                <button type="button" onClick={onSelectCurrentTopic} disabled={isBusy} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)]">
                  Current topic
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{currentTopicTitle}</span>
                </button>
                <button type="button" onClick={onSelectCurrentSection} disabled={isBusy || !canSelectCurrentSection} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                  Current section
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{currentSectionTitle || 'Overview / topic-level export'}</span>
                </button>
                <button type="button" onClick={onClearAll} disabled={isBusy} className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-left text-sm font-bold text-[var(--muted)] transition hover:bg-[var(--panel-hover)]">
                  Clear all
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Selection Summary</p>
                <p className="mt-2 text-sm font-semibold text-[var(--heading)]">{scopeLabel}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{selectedCount} leaf selections currently checked.</p>
              </div>

              <div className={`mt-5 rounded-2xl border p-4 ${statusTone(status)}`}>
                <p className="text-xs font-black uppercase tracking-[0.18em]">Export Status</p>
                <p className="mt-2 text-sm font-bold">{stage || 'Idle'}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold">{Math.round(progress || 0)}%</p>
                {error ? <p className="mt-3 text-sm font-semibold">{error}</p> : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Checklist</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Parent checkboxes select descendants. Partial selections show indeterminate state.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setExpandedIds(new Set(tree.expandableIds))} disabled={isBusy} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)]">
                    Expand all
                  </button>
                  <button type="button" onClick={() => setExpandedIds(new Set([tree.root.id]))} disabled={isBusy} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)]">
                    Collapse all
                  </button>
                </div>
              </div>

              <div className="export-tree-panel min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-[var(--border)] bg-[var(--search-bg)] p-3">
                <ExportTree
                  tree={tree}
                  selectedIds={selectedIds}
                  expandedIds={expandedIds}
                  disabled={isBusy}
                  onToggleCheck={(nodeId, checked) => onToggleCheck(nodeId, checked, selectedSet)}
                  onToggleExpand={(nodeId) => {
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(nodeId)) next.delete(nodeId);
                      else next.add(nodeId);
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
            <p className="text-sm font-semibold text-[var(--muted)]">
              The export excludes the app shell and includes only the content selected above. Export keeps running even if this dialog is closed.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {isBusy ? (
                <button type="button" onClick={onCancel} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)]">
                  Cancel
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)]">
                Close
              </button>
              <button
                type="button"
                onClick={onExport}
                disabled={isBusy || selectedIds.length === 0}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2"><Download size={16} /> Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ExportDialog);
