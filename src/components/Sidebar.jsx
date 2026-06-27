import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Search, X } from 'lucide-react';

function useStoredObject(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}

function groupTopics(topics, order = []) {
  const grouped = topics.reduce((acc, topic) => {
    const group = topic.group || topic.domain || 'Reference';
    acc[group] ||= [];
    acc[group].push(topic);
    return acc;
  }, {});
  return Object.entries(grouped).sort(([a], [b]) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if ((ia === -1 ? 999 : ia) !== (ib === -1 ? 999 : ib)) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });
}

function highlightParts(text = '', query = '') {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terms.length) return [text];
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'ig');
  return String(text).split(re).filter(Boolean).map((part, index) => {
    const matched = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    return matched ? <mark key={`${part}-${index}`} className="rounded bg-[var(--search-mark)] px-0.5 text-[var(--search-mark-text)]">{part}</mark> : part;
  });
}

function SearchResult({ result, onClick, searchTerm }) {
  return (
    <button type="button" onClick={() => onClick(result)} className="search-result block w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--panel-hover)]">
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--accent-strong)]">
        {result.sectionPath?.join(' › ')}
      </div>
      <p className="text-xs leading-5 text-[var(--muted)]">{highlightParts(result.snippet, searchTerm)}</p>
    </button>
  );
}

function Sidebar({
  topics,
  activeId,
  onSelect,
  query,
  setQuery,
  searchResults = [],
  onSearchSelect,
  isOpen,
  onClose,
  collapsed,
  setCollapsed,
  groupOrderPreference = [],
  searchTerm = ''
}) {
  const grouped = useMemo(() => groupTopics(topics, groupOrderPreference), [topics, groupOrderPreference]);
  const [openGroups, setOpenGroups] = useStoredObject('notes:openGroups:v2', {});
  const activeTopicButtonRef = useRef(null);

  const isGroupOpen = (group) => openGroups[group] ?? true;
  const toggleGroup = (group) => setOpenGroups((prev) => ({ ...prev, [group]: !(prev[group] ?? true) }));

  useEffect(() => {
    if (!activeId || collapsed || query.trim()) return;
    const activeGroup = grouped.find(([, items]) => items.some((item) => item.id === activeId))?.[0];
    if (!activeGroup || openGroups[activeGroup] !== false) return;
    setOpenGroups((previous) => ({ ...previous, [activeGroup]: true }));
  }, [activeId, collapsed, grouped, openGroups, query, setOpenGroups]);

  useEffect(() => {
    if (!activeId || collapsed || query.trim()) return undefined;
    const frame = window.requestAnimationFrame(() => {
      activeTopicButtonRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, collapsed, query]);

  return (
    <aside className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} sidebar-panel fixed inset-y-0 left-0 z-50 border-r border-[var(--border)] bg-[var(--sidebar)] transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="flex h-full flex-col">
        <div className="sidebar-brand border-b border-[var(--border)] p-4">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => collapsed && setCollapsed(false)} className="flex min-w-0 items-center gap-3 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-blue-600/20"><BookOpen size={20} /></span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-lg font-black text-[var(--heading)]">Tech Notes</span>
                  <span className="block truncate text-xs font-semibold text-[var(--muted)]">Deep topic-wise study guide</span>
                </span>
              )}
            </button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setCollapsed((v) => !v)} className="hidden rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)] lg:inline-flex" title={collapsed ? 'Expand left panel' : 'Collapse left panel'}>
                {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--panel-hover)] lg:hidden" title="Close navigation">
                <X size={16} />
              </button>
            </div>
          </div>
          {!collapsed && (
            <label className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 shadow-sm">
              <Search size={18} className="text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search S3, IAM, React, SQL..."
                className="w-full bg-transparent text-sm font-medium text-[var(--heading)] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          )}
        </div>

        {collapsed ? (
          <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto p-2">
            {grouped.slice(0, 20).map(([group, items]) => (
              <button
                key={group}
                type="button"
                onClick={() => { setCollapsed(false); setTimeout(() => onSelect(items[0].id), 0); }}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-black transition ${items.some((item) => item.id === activeId) ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-blue-600/20' : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel-hover)]'}`}
                title={group}
              >
                {group.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}
              </button>
            ))}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {query.trim() ? (
              <div className="mb-5 rounded-3xl border border-[var(--border)] bg-[var(--search-bg)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Search results</p>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--accent-strong)]">{searchResults.length}</span>
                </div>
                {searchResults.length ? (
                  <div className="space-y-2">
                    {searchResults.slice(0, 18).map((result, index) => (
                      <SearchResult key={`${result.topicId}-${result.sectionId}-${index}`} result={result} onClick={onSearchSelect} searchTerm={searchTerm} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm font-semibold text-[var(--muted)]">No section matched this search. Try a smaller phrase like “visibility timeout”, “JWT”, “multipart upload”, or “debounce”.</p>
                )}
              </div>
            ) : null}

            <nav className="space-y-4">
              {grouped.map(([group, items]) => {
                const open = isGroupOpen(group);
                return (
                  <section key={group}>
                    <button type="button" onClick={() => toggleGroup(group)} className="mb-1 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)] transition hover:bg-[var(--panel-hover)]">
                      <span>{group}</span>
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {open && (
                      <div className="space-y-1">
                        {items.map((topic) => (
                          <button
                            key={topic.id}
                            ref={activeId === topic.id ? activeTopicButtonRef : null}
                            type="button"
                            onClick={() => { onSelect(topic.id); onClose?.(); }}
                            className={`nav-topic flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeId === topic.id ? 'active bg-[var(--accent)] text-white shadow-md shadow-blue-600/20' : 'text-[var(--nav-text)] hover:bg-[var(--panel-hover)]'}`}
                          >
                            <FileText size={15} className="shrink-0" />
                            <span className="leading-5">{topic.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </aside>
  );
}

export default memo(Sidebar);
