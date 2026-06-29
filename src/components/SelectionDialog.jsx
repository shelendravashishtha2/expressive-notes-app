import { memo, useEffect, useMemo, useState } from 'react';
import { Eye, X } from 'lucide-react';
import ExportTree from './ExportTree.jsx';

function SelectionDialog({
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
  onClearDraft,
  onSelectCurrentTopic,
  onSelectCurrentSection,
  onApply,
  onRemoveSelection,
  hasActiveSelection,
  isPreparing = false
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set(tree.expandableIds));
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (open) {
      setExpandedIds(new Set(tree.expandableIds));
    }
  }, [open, tree]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-slate-950/45 p-0 backdrop-blur-md sm:p-4"
      onClick={onClose}
    >
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-stretch justify-center py-0 sm:py-2 lg:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select which notes should be visible"
          onClick={(event) => event.stopPropagation()}
          className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border-0 border-[var(--border)] bg-[var(--article-bg)] shadow-2xl shadow-slate-950/20 sm:h-auto sm:max-h-[96vh] sm:rounded-[2rem] sm:border"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:gap-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Custom Notes View
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--heading)] sm:text-2xl">
                Select which notes should be visible
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                This selection filters the reader, left navigation, search results, and right outline. PDF export stays completely separate.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-2xl border border-[var(--border)] p-3 text-[var(--muted)] transition hover:bg-[var(--panel-hover)]"
              title="Close custom notes dialog"
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
                  disabled={isPreparing}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)]"
                >
                  All notes
                </button>
                <button
                  type="button"
                  onClick={onSelectCurrentTopic}
                  disabled={isPreparing}
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
                  disabled={isPreparing || !canSelectCurrentSection}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm font-bold text-[var(--heading)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Current section
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                    {currentSectionTitle || 'Overview / topic-level selection'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onClearDraft}
                  disabled={isPreparing}
                  className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-left text-sm font-bold text-[var(--muted)] transition hover:bg-[var(--panel-hover)]"
                >
                  Clear checks
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  Selection Summary
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--heading)]">
                  {scopeLabel}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {isPreparing
                    ? 'Preparing the complete topic tree from remote notes…'
                    : `${selectedCount} selectable items currently checked.`}
                </p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Checklist
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Parent checkboxes select descendants. Partial selections show indeterminate state.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={() => setExpandedIds(new Set(tree.expandableIds))}
                    disabled={isPreparing}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedIds(new Set([tree.root.id]))}
                    disabled={isPreparing}
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              <div className="export-tree-panel min-h-[18rem] flex-1 overflow-y-auto rounded-[1.5rem] border border-[var(--border)] bg-[var(--search-bg)] p-3 sm:min-h-0 sm:p-4">
                {isPreparing ? (
                  <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-[var(--border)] bg-[var(--panel-soft)] px-6 text-center">
                    <div className="relative mb-5 h-14 w-14">
                      <span className="absolute inset-0 rounded-full border-4 border-[var(--accent-soft)]" />
                      <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--accent)]" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      Preparing full nested tree
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                      Loading complete topic bodies first, so every topic expands into its real sections and subsections before you select it.
                    </p>
                  </div>
                ) : (
                  <ExportTree
                    tree={tree}
                    selectedIds={selectedIds}
                    expandedIds={expandedIds}
                    onToggleCheck={(nodeId, checked) => onToggleCheck(nodeId, checked, selectedSet)}
                    disabled={isPreparing}
                    onToggleExpand={(nodeId) => {
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(nodeId)) next.delete(nodeId);
                        else next.add(nodeId);
                        return next;
                      });
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-sm font-semibold text-[var(--muted)]">
                To remove a custom notes view, open this popup and use Remove custom view.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] sm:w-auto"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onRemoveSelection}
                  disabled={!hasActiveSelection && selectedIds.length === 0}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-black text-[var(--heading)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Remove custom view
                </button>
                <button
                  type="button"
                  onClick={onApply}
                  disabled={isPreparing || selectedIds.length === 0}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <span className="inline-flex items-center gap-2">
                    <Eye size={16} /> Show selected notes
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

export default memo(SelectionDialog);
