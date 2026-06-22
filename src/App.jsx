import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { curatedNotes, groupOrderPreference } from './data/notes.js';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Toc from './components/Toc.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import ExportStatusToast from './components/ExportStatusToast.jsx';
import LazyTopicContent from './components/LazyTopicContent.jsx';
import { useExportTask } from './hooks/useExportTask.js';
import {
  applyNodeSelection,
  buildExportPlan,
  buildExportTree,
  clearSelection,
  createSelectionForAll,
  createSelectionForSection,
  createSelectionForTopic
} from './utils/exportTree.js';
import {
  DEFAULT_MONACO_THEME_PREFS,
  normalizeMonacoThemePrefs
} from './utils/monacoThemes.js';
import { createScopedHeadingId, getSections, slugify } from './utils/text.js';
import { buildFastSearchIndex, searchSectionsFast } from './utils/search.js';

const allTopics = curatedNotes;

function readBool(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value === 'true';
  } catch {
    return fallback;
  }
}

function readObject(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function useDebouncedValue(value, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function emptyVisibleMap() {
  return new Map();
}

function resolveUpdater(nextValue, currentValue) {
  return typeof nextValue === 'function' ? nextValue(currentValue) : nextValue;
}

function escapeSelectorValue(value = '') {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function requestElementFullscreen(element) {
  if (!element) return Promise.resolve();
  if (element.requestFullscreen) return element.requestFullscreen();
  if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
  return Promise.resolve();
}

function exitElementFullscreen() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  return Promise.resolve();
}

export default function App() {
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebouncedValue(rawQuery, 70);
  const [activeId, setActiveIdState] = useState(() => localStorage.getItem('activeTopicId') || allTopics[0]?.id);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [leftCollapsed, setLeftCollapsed] = useState(() => readBool('notes:leftCollapsed', false));
  const [rightCollapsed, setRightCollapsed] = useState(() => readBool('notes:rightCollapsed', false));
  const [monacoThemePrefs, setMonacoThemePrefs] = useState(() => normalizeMonacoThemePrefs(
    readObject('notes:monacoThemes', DEFAULT_MONACO_THEME_PREFS)
  ));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('overview');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [readMode, setReadMode] = useState(() => localStorage.getItem('notes:readMode') || 'topic');
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(getFullscreenElement()));

  const appShellRef = useRef(null);
  const articleRef = useRef(null);
  const scrollRef = useRef(null);
  const progressRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const activeSectionRef = useRef('overview');
  const activeTopicRef = useRef(activeId);
  const darkModeRef = useRef(darkMode);
  const wasFullScrollRef = useRef(false);
  const fullScrollSnapshotRef = useRef({ topicId: activeId, sectionId: 'overview' });
  const visibleHeadingEntriesRef = useRef(emptyVisibleMap());
  const visibleTopicEntriesRef = useRef(emptyVisibleMap());
  const pendingLayoutAnchorRef = useRef(null);
  const preserveNextScrollResetRef = useRef(false);

  const searchIndex = useMemo(() => buildFastSearchIndex(allTopics), []);
  const searchResults = useMemo(() => searchSectionsFast(searchIndex, debouncedQuery), [searchIndex, debouncedQuery]);
  const exportTree = useMemo(() => buildExportTree(allTopics), []);
  const [selectedExportIds, setSelectedExportIds] = useState(() => clearSelection());
  const [exportScopeLabel, setExportScopeLabel] = useState('Custom selection');

  const activeTopic = useMemo(
    () => allTopics.find((topic) => topic.id === activeId) || allTopics[0],
    [activeId]
  );
  const activeTopicSections = useMemo(
    () => getSections(activeTopic?.content || ''),
    [activeTopic?.content]
  );
  const currentSection = useMemo(
    () => activeTopicSections.find((section) => section.id === activeSectionId) || null,
    [activeSectionId, activeTopicSections]
  );
  const isFullScrollMode = readMode === 'full';
  const readerMonacoTheme = monacoThemePrefs.dark;
  const selectedExportCount = selectedExportIds.length;

  const {
    task: exportTask,
    startExport,
    cancelExport,
    resetTask
  } = useExportTask();

  const queueSectionScroll = useCallback((topicId, sectionId = 'overview', behavior = 'auto') => {
    pendingScrollRef.current = {
      topicId,
      sectionId: sectionId || 'overview',
      behavior
    };
  }, []);

  const scrollToSection = useCallback((sectionId, behavior = 'smooth', topicId = activeTopicRef.current) => {
    const scroller = scrollRef.current;
    const article = articleRef.current;
    if (!scroller || !article || !topicId) return false;

    const safeTopicId = escapeSelectorValue(topicId);
    const topicShell = article.querySelector(`[data-topic-shell="true"][data-topic-id="${safeTopicId}"]`);
    if (!topicShell) return false;

    const normalizedSectionId = sectionId || 'overview';
    const safeSectionId = escapeSelectorValue(normalizedSectionId);
    const target = normalizedSectionId === 'overview'
      ? topicShell
      : topicShell.querySelector(`[data-heading-id="${safeSectionId}"]`);
    const finalTarget = target || topicShell;

    const scrollerBox = scroller.getBoundingClientRect();
    const targetBox = finalTarget.getBoundingClientRect();
    const top = scroller.scrollTop + (targetBox.top - scrollerBox.top) - 92;
    scroller.scrollTo({ top: Math.max(0, top), behavior });

    const flashTarget = normalizedSectionId === 'overview'
      ? topicShell.querySelector('.chat-response') || topicShell
      : finalTarget;
    flashTarget.classList.remove('section-flash');
    window.setTimeout(() => flashTarget.classList.add('section-flash'), 20);
    window.setTimeout(() => flashTarget.classList.remove('section-flash'), 1700);

    activeSectionRef.current = normalizedSectionId;
    setActiveSectionId((current) => (current === normalizedSectionId ? current : normalizedSectionId));
    fullScrollSnapshotRef.current = { topicId, sectionId: normalizedSectionId };
    return true;
  }, []);

  const captureLayoutAnchor = useCallback(() => {
    const scroller = scrollRef.current;
    const article = articleRef.current;
    if (!scroller || !article) return;

    const scrollerBox = scroller.getBoundingClientRect();
    const anchorLine = scrollerBox.top + 112;
    const topicCandidates = Array.from(article.querySelectorAll('[data-topic-shell="true"]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom >= anchorLine);

    const activeTopic = topicCandidates.sort(
      (left, right) => Math.abs(left.rect.top - anchorLine) - Math.abs(right.rect.top - anchorLine)
    )[0];

    const topicElement = activeTopic?.element;
    if (!topicElement) return;
    const topicId = topicElement.getAttribute('data-topic-id') || activeTopicRef.current;

    const headingCandidates = Array.from(topicElement.querySelectorAll('[data-heading-key]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom >= anchorLine);

    const activeHeading = headingCandidates.sort(
      (left, right) => Math.abs(left.rect.top - anchorLine) - Math.abs(right.rect.top - anchorLine)
    )[0];

    pendingLayoutAnchorRef.current = {
      headingKey: activeHeading?.element?.getAttribute('data-heading-key') || '',
      topicId,
      offset: activeTopic.rect.top - scrollerBox.top
    };
  }, []);

  const setLeftCollapsedAnchored = useCallback((nextValue) => {
    captureLayoutAnchor();
    setLeftCollapsed((current) => resolveUpdater(nextValue, current));
  }, [captureLayoutAnchor]);

  const setRightCollapsedAnchored = useCallback((nextValue) => {
    captureLayoutAnchor();
    setRightCollapsed((current) => resolveUpdater(nextValue, current));
  }, [captureLayoutAnchor]);

  const selectTopic = useCallback((id, sectionId = null, behavior = 'auto') => {
    const normalizedSectionId = sectionId || 'overview';
    activeTopicRef.current = id;
    activeSectionRef.current = normalizedSectionId;
    fullScrollSnapshotRef.current = { topicId: id, sectionId: normalizedSectionId };
    setActiveIdState(id);
    setSidebarOpen(false);

    if (isFullScrollMode) {
      const travelBehavior = behavior === 'auto' ? 'smooth' : behavior;
      window.requestAnimationFrame(() => {
        scrollToSection(normalizedSectionId, travelBehavior, id);
      });
      return;
    }

    if (sectionId) queueSectionScroll(id, sectionId, 'auto');
  }, [isFullScrollMode, queueSectionScroll, scrollToSection]);

  const handleSearchSelect = useCallback((result) => {
    selectTopic(
      result.topicId,
      result.sectionId === 'overview' ? null : result.sectionId,
      isFullScrollMode ? 'smooth' : 'auto'
    );
    setRawQuery('');
  }, [isFullScrollMode, selectTopic]);

  const handleTocJump = useCallback((section) => {
    scrollToSection(section.id, 'smooth', activeTopic.id);
  }, [activeTopic.id, scrollToSection]);

  useEffect(() => {
    darkModeRef.current = darkMode;
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const setDarkModeSmooth = useCallback((nextValue) => {
    const nextDarkMode = resolveUpdater(nextValue, darkModeRef.current);
    darkModeRef.current = nextDarkMode;

    const root = document.documentElement;
    root.classList.add('theme-flipping');
    root.classList.toggle('dark', nextDarkMode);
    localStorage.setItem('theme', nextDarkMode ? 'dark' : 'light');
    window.clearTimeout(root.__themeFlipTimer);
    root.__themeFlipTimer = window.setTimeout(() => {
      root.classList.remove('theme-flipping');
    }, 180);

    startTransition(() => {
      setDarkMode((current) => (current === nextDarkMode ? current : nextDarkMode));
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('notes:leftCollapsed', String(leftCollapsed));
  }, [leftCollapsed]);

  useEffect(() => {
    localStorage.setItem('notes:rightCollapsed', String(rightCollapsed));
  }, [rightCollapsed]);

  useEffect(() => {
    localStorage.setItem('notes:readMode', readMode);
  }, [readMode]);

  useEffect(() => {
    localStorage.setItem('notes:monacoThemes', JSON.stringify(monacoThemePrefs));
  }, [monacoThemePrefs]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
    };
  }, []);

  useLayoutEffect(() => {
    const anchor = pendingLayoutAnchorRef.current;
    if (!anchor) return undefined;
    pendingLayoutAnchorRef.current = null;

    let frameA = 0;
    let frameB = 0;

    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        const scroller = scrollRef.current;
        const article = articleRef.current;
        if (!scroller || !article) return;

        const topicTarget = anchor.topicId
          ? article.querySelector(`[data-topic-shell="true"][data-topic-id="${escapeSelectorValue(anchor.topicId)}"]`)
          : null;
        const headingTarget = anchor.headingKey
          ? topicTarget?.querySelector(`[data-heading-key="${escapeSelectorValue(anchor.headingKey)}"]`)
          : null;
        const target = topicTarget || headingTarget;
        if (!target) return;

        const scrollerBox = scroller.getBoundingClientRect();
        const currentOffset = target.getBoundingClientRect().top - scrollerBox.top;
        scroller.scrollTop += currentOffset - anchor.offset;
      });
    });

    return () => {
      if (frameA) window.cancelAnimationFrame(frameA);
      if (frameB) window.cancelAnimationFrame(frameB);
    };
  }, [leftCollapsed, rightCollapsed, readMode]);

  useEffect(() => {
    activeTopicRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (activeTopic?.id) localStorage.setItem('activeTopicId', activeTopic.id);
    const node = scrollRef.current;
    const pending = pendingScrollRef.current;

    if (pending) {
      pendingScrollRef.current = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollToSection(pending.sectionId, pending.behavior, pending.topicId);
        });
      });
    } else if (!isFullScrollMode && node && !preserveNextScrollResetRef.current) {
      node.scrollTo({ top: 0, behavior: 'auto' });
      activeSectionRef.current = 'overview';
      setActiveSectionId('overview');
    }

    preserveNextScrollResetRef.current = false;

    if (progressRef.current && !isFullScrollMode) {
      progressRef.current.style.transform = 'scaleX(0)';
    }
  }, [activeTopic?.id, isFullScrollMode, scrollToSection]);

  useEffect(() => {
    const root = scrollRef.current;
    const bar = progressRef.current;
    if (!root || !bar) return undefined;

    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const max = root.scrollHeight - root.clientHeight;
      const value = max <= 0 ? 0 : root.scrollTop / max;
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, value))})`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    const article = articleRef.current;
    if (!root || !article) return undefined;

    const headings = Array.from(article.querySelectorAll('[data-heading-key]'));
    if (!headings.length) return undefined;

    visibleHeadingEntriesRef.current = emptyVisibleMap();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const key = entry.target.getAttribute('data-heading-key');
        if (!key) return;
        if (entry.isIntersecting) visibleHeadingEntriesRef.current.set(key, entry);
        else visibleHeadingEntriesRef.current.delete(key);
      });

      const visible = Array.from(visibleHeadingEntriesRef.current.values())
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible?.target) return;

      const sectionId = visible.target.getAttribute('data-heading-id') || 'overview';
      const topicId = visible.target.getAttribute('data-topic-id')
        || visible.target.closest('[data-topic-shell="true"]')?.getAttribute('data-topic-id');

      if (sectionId && activeSectionRef.current !== sectionId) {
        activeSectionRef.current = sectionId;
        setActiveSectionId(sectionId);
      }

      if (isFullScrollMode && topicId) {
        fullScrollSnapshotRef.current = { topicId, sectionId: sectionId || 'overview' };
      }
    }, {
      root,
      rootMargin: '-18% 0px -70% 0px',
      threshold: [0, 0.1, 0.35]
    });

    headings.forEach((heading) => observer.observe(heading));
    return () => {
      visibleHeadingEntriesRef.current = emptyVisibleMap();
      observer.disconnect();
    };
  }, [activeTopic?.id, isFullScrollMode]);

  useEffect(() => {
    if (!isFullScrollMode) return undefined;
    const root = scrollRef.current;
    const article = articleRef.current;
    if (!root || !article) return undefined;

    const topicShells = Array.from(article.querySelectorAll('[data-topic-shell="true"]'));
    if (!topicShells.length) return undefined;

    visibleTopicEntriesRef.current = emptyVisibleMap();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const topicId = entry.target.getAttribute('data-topic-id');
        if (!topicId) return;
        if (entry.isIntersecting) visibleTopicEntriesRef.current.set(topicId, entry);
        else visibleTopicEntriesRef.current.delete(topicId);
      });

      const visible = Array.from(visibleTopicEntriesRef.current.values())
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const topicId = visible?.target?.getAttribute('data-topic-id');
      if (!topicId) return;

      if (activeTopicRef.current !== topicId) {
        activeTopicRef.current = topicId;
        setActiveIdState((current) => (current === topicId ? current : topicId));
      }

      fullScrollSnapshotRef.current = {
        topicId,
        sectionId: fullScrollSnapshotRef.current.sectionId || 'overview'
      };
    }, {
      root,
      rootMargin: '-12% 0px -76% 0px',
      threshold: [0, 0.08, 0.18]
    });

    topicShells.forEach((shell) => observer.observe(shell));
    return () => {
      visibleTopicEntriesRef.current = emptyVisibleMap();
      observer.disconnect();
    };
  }, [isFullScrollMode]);

  useEffect(() => {
    const wasFullScroll = wasFullScrollRef.current;
    if (wasFullScroll === isFullScrollMode) return;

    wasFullScrollRef.current = isFullScrollMode;

    if (isFullScrollMode) {
      const snapshot = {
        topicId: activeTopicRef.current || activeTopic?.id || allTopics[0]?.id,
        sectionId: activeSectionRef.current || activeSectionId || 'overview'
      };
      fullScrollSnapshotRef.current = snapshot;
      return;
    }

    const snapshot = fullScrollSnapshotRef.current;
    if (!snapshot.topicId) return;

    activeTopicRef.current = snapshot.topicId;
    activeSectionRef.current = snapshot.sectionId || 'overview';
    setActiveSectionId(snapshot.sectionId || 'overview');

    if (snapshot.topicId !== activeId) {
      preserveNextScrollResetRef.current = true;
      setActiveIdState(snapshot.topicId);
    }
  }, [activeId, activeSectionId, activeTopic?.id, isFullScrollMode]);

  const gridTemplateColumns = useMemo(() => {
    const left = leftCollapsed ? '72px' : '332px';
    const right = rightCollapsed ? '72px' : '336px';
    return `${left} minmax(0, 1fr) ${right}`;
  }, [leftCollapsed, rightCollapsed]);

  const setExportSelection = useCallback((nextIds, nextLabel) => {
    setSelectedExportIds(nextIds);
    setExportScopeLabel(nextLabel);
    if (exportTask.status !== 'idle') resetTask();
  }, [exportTask.status, resetTask]);

  const handleExportNodeToggle = useCallback((nodeId, checked) => {
    setSelectedExportIds((previous) => applyNodeSelection(exportTree, previous, nodeId, checked));
    setExportScopeLabel('Custom selection');
    if (exportTask.status !== 'idle') resetTask();
  }, [exportTask.status, exportTree, resetTask]);

  const selectAllForExport = useCallback(() => {
    setExportSelection(createSelectionForAll(exportTree), 'All notes');
  }, [exportTree, setExportSelection]);

  const clearExportSelection = useCallback(() => {
    setExportSelection(clearSelection(), 'Custom selection');
  }, [setExportSelection]);

  const selectCurrentTopicForExport = useCallback(() => {
    setExportSelection(
      createSelectionForTopic(exportTree, activeTopic.id),
      `Current topic: ${activeTopic.title}`
    );
  }, [activeTopic.id, activeTopic.title, exportTree, setExportSelection]);

  const selectCurrentSectionForExport = useCallback(() => {
    const sectionId = activeSectionRef.current || activeSectionId || 'overview';
    const ids = createSelectionForSection(exportTree, activeTopic.id, sectionId);
    const label = currentSection
      ? `Current section: ${activeTopic.title} / ${currentSection.title}`
      : `Current topic: ${activeTopic.title}`;
    setExportSelection(ids, label);
  }, [activeSectionId, activeTopic.id, activeTopic.title, currentSection, exportTree, setExportSelection]);

  const switchReadMode = useCallback((nextMode) => {
    const normalized = nextMode === 'full' ? 'full' : 'topic';
    if (normalized === readMode) return;

    captureLayoutAnchor();
    preserveNextScrollResetRef.current = true;

    const snapshot = {
      topicId: activeTopicRef.current || activeTopic?.id || allTopics[0]?.id,
      sectionId: activeSectionRef.current || activeSectionId || 'overview'
    };

    fullScrollSnapshotRef.current = snapshot;
    activeSectionRef.current = snapshot.sectionId || 'overview';
    setActiveSectionId(snapshot.sectionId || 'overview');

    if (normalized === 'topic' && snapshot.topicId && snapshot.topicId !== activeId) {
      activeTopicRef.current = snapshot.topicId;
      setActiveIdState(snapshot.topicId);
    }

    setReadMode(normalized);
  }, [activeId, activeSectionId, activeTopic?.id, captureLayoutAnchor, readMode]);

  const openExportDialog = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const updateMonacoTheme = useCallback((mode, theme) => {
    setMonacoThemePrefs((current) => normalizeMonacoThemePrefs({
      ...current,
      [mode]: theme
    }));
  }, []);

  const closeExportDialog = useCallback(() => {
    setExportDialogOpen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (getFullscreenElement()) {
        await exitElementFullscreen();
        return;
      }

      await requestElementFullscreen(appShellRef.current || document.documentElement);
    } catch {
      // Some browsers reject fullscreen requests outside trusted gestures.
    }
  }, []);

  const startPdfExport = useCallback(() => {
    const plan = buildExportPlan(allTopics, exportTree, selectedExportIds, exportScopeLabel);
    if (!plan.documents.length) return;

    const generatedAt = new Date().toISOString();
    const fileBase = plan.selectedTopicCount === 1
      ? slugify(plan.documents[0]?.topicTitle || 'technical-notes')
      : slugify(plan.scopeLabel || 'technical-notes-cookbook');

    startExport({
      plan,
      generatedAt,
      filename: `${fileBase || 'technical-notes'}-${generatedAt.slice(0, 10)}.pdf`
    });
    setExportDialogOpen(false);
  }, [exportScopeLabel, exportTree, selectedExportIds, startExport]);

  const renderTopicShell = useCallback((topic, { fullScroll = false, index = 0 } = {}) => {
    const sectionCount = getSections(topic.content || '').length;
    const overviewId = createScopedHeadingId(topic.id, 'overview', fullScroll ? 'full' : 'reader');

    return (
      <section
        key={`${fullScroll ? 'full' : 'topic'}-${topic.id}`}
        data-topic-shell="true"
        data-topic-id={topic.id}
        data-topic-title={topic.title}
        className={fullScroll ? `full-scroll-topic-shell${index === 0 ? '' : ' mt-12'}` : ''}
      >
        <div
          id={overviewId}
          data-overview-anchor="true"
          data-heading-id="overview"
          data-heading-key={`${topic.id}:overview`}
          data-topic-id={topic.id}
          className="scroll-mt-28"
        />

        <div className="hero-card mb-8 overflow-hidden rounded-[2rem] border p-6 shadow-xl md:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">{topic.group || topic.domain}</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              {fullScroll ? 'continuous cookbook chapter' : 'single topic view'}
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              {sectionCount ? `${sectionCount} sections` : 'topic overview'}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--heading)] md:text-5xl">{topic.title}</h1>
          <p className="mt-4 max-w-4xl text-base leading-8 text-[var(--muted)] md:text-lg">{topic.summary}</p>
          {topic.sourceFiles?.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {topic.sourceFiles.slice(0, fullScroll ? 8 : 14).map((file) => (
                <span key={file} className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{file}</span>
              ))}
              {topic.sourceFiles.length > (fullScroll ? 8 : 14) ? (
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                  +{topic.sourceFiles.length - (fullScroll ? 8 : 14)} sources
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <LazyTopicContent
          topic={topic}
          darkMode={true}
          monacoTheme={readerMonacoTheme}
          scrollRootRef={scrollRef}
          fullScroll={fullScroll}
          sectionCount={sectionCount}
          forceHydrated={!fullScroll || topic.id === activeTopic.id}
        />
      </section>
    );
  }, [activeTopic.id, readerMonacoTheme]);

  return (
    <div ref={appShellRef} className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] transition-colors">
      <ProgressBar ref={progressRef} />

      {sidebarOpen ? (
        <button
          aria-label="Close sidebar overlay"
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      ) : null}

      <div className="app-grid" style={{ gridTemplateColumns }}>
        <Sidebar
          topics={allTopics}
          activeId={activeTopic.id}
          onSelect={selectTopic}
          query={rawQuery}
          setQuery={setRawQuery}
          searchResults={searchResults}
          onSearchSelect={handleSearchSelect}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={leftCollapsed}
          setCollapsed={setLeftCollapsedAnchored}
          groupOrderPreference={groupOrderPreference}
          searchTerm={debouncedQuery}
        />

        <main ref={scrollRef} className="main-scroll bg-[radial-gradient(circle_at_top_left,var(--hero-glow),transparent_32rem),var(--app-bg)]">
          <Topbar
            topic={activeTopic}
            darkMode={darkMode}
            setDarkMode={setDarkModeSmooth}
            setSidebarOpen={setSidebarOpen}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            setLeftCollapsed={setLeftCollapsedAnchored}
            setRightCollapsed={setRightCollapsedAnchored}
            monacoThemePrefs={monacoThemePrefs}
            onMonacoThemeChange={updateMonacoTheme}
            onOpenExportDialog={openExportDialog}
            fullScrollMode={isFullScrollMode}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            readMode={readMode}
            onReadModeChange={switchReadMode}
          />

          <article ref={articleRef} className="chat-article mx-auto max-w-6xl px-4 py-8 md:px-8 lg:px-10 print:max-w-none print:px-0">
            {isFullScrollMode
              ? allTopics.map((topic, index) => renderTopicShell(topic, { fullScroll: true, index }))
              : renderTopicShell(activeTopic)}
          </article>
        </main>

        <Toc
          topic={activeTopic}
          activeSectionId={activeSectionId}
          onJump={handleTocJump}
          collapsed={rightCollapsed}
          setCollapsed={setRightCollapsedAnchored}
        />
      </div>

      <ExportStatusToast
        task={exportTask}
        onCancel={cancelExport}
        onDismiss={resetTask}
      />

      <ExportDialog
        open={exportDialogOpen}
        onClose={closeExportDialog}
        tree={exportTree}
        selectedIds={selectedExportIds}
        selectedCount={selectedExportCount}
        scopeLabel={exportScopeLabel}
        currentTopicTitle={activeTopic.title}
        currentSectionTitle={currentSection?.title || 'Overview / topic-level export'}
        canSelectCurrentSection={Boolean(activeTopic?.id)}
        onToggleCheck={handleExportNodeToggle}
        onSelectAll={selectAllForExport}
        onClearAll={clearExportSelection}
        onSelectCurrentTopic={selectCurrentTopicForExport}
        onSelectCurrentSection={selectCurrentSectionForExport}
        onExport={startPdfExport}
        status={exportTask.status}
        stage={exportTask.stage}
        progress={exportTask.progress}
        error={exportTask.error}
        onCancel={cancelExport}
      />
    </div>
  );
}
