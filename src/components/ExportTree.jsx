import { memo, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, FileText, FolderTree, Layers3, ListTree } from 'lucide-react';
import { getNodeSelectionState } from '../utils/exportTree.js';

function nodeIcon(node) {
  if (node.type === 'root') return <FolderTree size={16} />;
  if (node.type === 'group') return <Layers3 size={16} />;
  if (node.type === 'topic') return <FileText size={16} />;
  return <ListTree size={16} />;
}

function ExportTreeNode({
  node,
  depth,
  selectedSet,
  expandedIds,
  onToggleCheck,
  onToggleExpand,
  disabled = false
}) {
  const inputRef = useRef(null);
  const selectionState = useMemo(
    () => getNodeSelectionState(node, selectedSet),
    [node, selectedSet]
  );
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = Boolean(node.children?.length);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = selectionState.indeterminate;
    }
  }, [selectionState.indeterminate]);

  return (
    <div className="export-tree-node">
      <div
        className={`flex items-center gap-2 rounded-2xl border border-transparent px-2 py-2 transition hover:border-[var(--border)] hover:bg-[var(--panel-hover)] ${selectionState.checked ? 'bg-[var(--accent-soft)]' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggleExpand(node.id)}
          className={`flex h-7 w-7 items-center justify-center rounded-xl text-[var(--muted)] transition ${hasChildren ? 'hover:bg-[var(--panel-soft)]' : 'opacity-0'}`}
          disabled={!hasChildren || disabled}
          aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : 'Leaf'}
        >
          {hasChildren ? (isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <ChevronRight size={15} />}
        </button>

        <label className="flex min-w-0 flex-1 items-center gap-3">
          <input
            ref={inputRef}
            type="checkbox"
            checked={selectionState.checked}
            onChange={(event) => onToggleCheck(node.id, event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            disabled={disabled}
          />
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--heading)]">
            <span className="text-[var(--accent-strong)]">{nodeIcon(node)}</span>
            <span className="truncate">{node.label}</span>
          </span>
        </label>

        <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--muted)]">
          {selectionState.selectedCount}/{selectionState.totalCount}
        </span>
      </div>

      {hasChildren && isExpanded ? (
        <div className="space-y-1 pt-1">
          {node.children.map((child) => (
            <ExportTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedSet={selectedSet}
              expandedIds={expandedIds}
              onToggleCheck={onToggleCheck}
              onToggleExpand={onToggleExpand}
              disabled={disabled}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExportTree({
  tree,
  selectedIds,
  expandedIds,
  onToggleCheck,
  onToggleExpand,
  disabled = false
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <div className="space-y-1">
      <ExportTreeNode
        node={tree.root}
        depth={0}
        selectedSet={selectedSet}
        expandedIds={expandedIds}
        onToggleCheck={onToggleCheck}
        onToggleExpand={onToggleExpand}
        disabled={disabled}
      />
    </div>
  );
}

export default memo(ExportTree);
