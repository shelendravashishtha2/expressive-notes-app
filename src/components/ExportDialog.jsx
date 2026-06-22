import { memo, useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import ExportTree from "./ExportTree.jsx";

function statusTone(status) {
  if (status === "error")
    return "border-red-300/60 bg-red-500/10 text-red-600 dark:text-red-300";
  if (status === "completed")
    return "border-blue-300/60 bg-blue-500/10 text-blue-700 dark:text-blue-200";
  return "border-[var(--border)] bg-[var(--panel-soft)] text-[var(--heading)]";
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
  onCancel,
}) {
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(tree.expandableIds),
  );
  const isBusy = ["queued", "preparing", "rendering", "finalizing"].includes(
    status,
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (open) {
      setExpandedIds(new Set(tree.expandableIds));
    }
  }, [open, tree]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-slate-950/55 p-0 backdrop-blur-sm sm:p-4">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-stretch justify-center py-0 sm:py-2 lg:items-center">
        <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border-0 border-[var(--border)] bg-[var(--article-bg)] shadow-2xl shadow-slate-950/20 sm:h-auto sm:max-h-[96vh] sm:rounded-[2rem] sm:border">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:gap-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Cookbook Export
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--heading)] sm:text-2xl">
                Export selected notes as a PDF
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Choose the scope you want, then let the PDF run in the
                background while you keep using the notes app smoothly.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-2xl border border-[var(--border)] p-3 text-[var(--muted)] transition hover:bg-[var(--panel-hover)]"
              title="Close export dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="max-h-[40vh] shrink-0 overflow-y-auto border-b border-[var(--border)] p-4 sm:max-h-[44vh] sm:p-5 lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Quick Selection
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  type="button"
                  onClick={onSelectAll}
                  disabled={isBusy}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)]"
                >
                  All notes
                </button>
                <button
                  type="button"
                  onClick={onSelectCurrentTopic}
                  disabled={isBusy}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)]"
                >
                  Current topic
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                    {currentTopicTitle}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onSelectCurrentSection}
                  disabled={isBusy || !canSelectCurrentSection}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Current section
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                    {currentSectionTitle || "Overview / topic-level export"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={isBusy}
                  className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-left text-sm font-bold text-[var(--muted)] transition hover:bg-[var(--panel-hover)]"
                >
                  Clear all
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Selection Summary
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--heading)]">
                    {scopeLabel}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {selectedCount} leaf selections currently checked.
                  </p>
                </div>

                <div className={`rounded-2xl border p-4 ${statusTone(status)}`}>
                  <p className="text-xs font-black uppercase tracking-[0.18em]">
                    Export Status
                  </p>
                  <p className="mt-2 text-sm font-bold">{stage || "Idle"}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
                      style={{
                        width: `${Math.max(0, Math.min(100, progress || 0))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold">
                    {Math.round(progress || 0)}%
                  </p>
                  {error ? (
                    <p className="mt-3 text-sm font-semibold">{error}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Checklist
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Parent checkboxes select descendants. Partial selections
                    show indeterminate state.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={() => setExpandedIds(new Set(tree.expandableIds))}
                    disabled={isBusy}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedIds(new Set([tree.root.id]))}
                    disabled={isBusy}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              <div className="export-tree-panel min-h-[18rem] flex-1 overflow-y-auto rounded-[1.5rem] border border-[var(--border)] bg-[var(--search-bg)] p-3 sm:min-h-0 sm:p-4">
                <ExportTree
                  tree={tree}
                  selectedIds={selectedIds}
                  expandedIds={expandedIds}
                  disabled={isBusy}
                  onToggleCheck={(nodeId, checked) =>
                    onToggleCheck(nodeId, checked, selectedSet)
                  }
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

          <div className="shrink-0 border-t border-[var(--border)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-sm font-semibold text-[var(--muted)]">
                The export excludes the app shell and includes only the content
                selected above. Export keeps running even if this dialog is
                closed.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {isBusy ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onExport}
                  disabled={isBusy || selectedIds.length === 0}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <span className="inline-flex items-center gap-2">
                    <Download size={16} /> Export PDF
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ExportDialog);
