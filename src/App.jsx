import { startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Toc from './components/Toc.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import SelectionDialog from './components/SelectionDialog.jsx';
import ExportStatusToast from './components/ExportStatusToast.jsx';
import LazyTopicContent from './components/LazyTopicContent.jsx';
import { AppStartupLoader, FullScrollTailLoader, SyncStatusDock } from './components/loaders/AppLoading.jsx';
import { useGetBootstrapQuery, useLazyHydrateTopicsQuery, usePrefetch, useSearchSectionsQuery } from './features/notes/notesApi.js';
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
  getStaticCodeThemeCssVariables,
  normalizeMonacoThemePrefs
} from './utils/monacoThemes.js';
import {
  DEFAULT_MERMAID_THEME_PREFS,
  normalizeMermaidThemePrefs
} from './utils/mermaidThemes.js';
import { createScopedHeadingId, getSections, slugify } from './utils/text.js';

const FULL_SCROLL_INITIAL_COUNT = 8;
const FULL_SCROLL_BATCH_SIZE = 10;
const FULL_SCROLL_PREFETCH_AHEAD = 14;
const TOPIC_PREFETCH_WINDOW = 8;
const EMPTY_TOPIC = Object.freeze({
  id: '',
  title: '',
  summary: '',
  group: '',
  domain: '',
  content: '',
  sections: [],
  sourceFiles: [],
  section_count: 0
});

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

function mergeTopicRecord(metadata = {}, detail = {}) {
  const content = detail.content ?? detail.body_markdown ?? metadata.content ?? '';
  const sections = detail.sections?.length
    ? detail.sections
    : metadata.sections?.length
      ? metadata.sections
      : content
        ? getSections(content)
        : [];

  return {
    ...metadata,
    ...detail,
    id: detail.id || metadata.id,
    slug: detail.slug || metadata.slug || metadata.id,
    title: detail.title || metadata.title || 'Untitled topic',
    summary: detail.summary ?? metadata.summary ?? '',
    group: detail.group || metadata.group || metadata.domain || 'Reference',
    domain: detail.domain || metadata.domain || metadata.group || 'Reference',
    content,
    sections,
    sourceFiles: detail.sourceFiles?.length
      ? detail.sourceFiles
      : metadata.sourceFiles || [],
    body_hash: detail.body_hash || detail.content_hash || metadata.body_hash || metadata.content_hash || '',
    section_count: detail.section_count ?? metadata.section_count ?? sections.length,
    __remoteReady: Boolean(content),
  };
}


function normalizeRemoteSearchResult(result = {}) {
  return {
    ...result,
    topicId: result.topicId || result.topic_slug || result.id,
    sectionId: result.sectionId || result.section_slug || 'overview',
    sectionPath: result.sectionPath?.length
      ? result.sectionPath
      : [result.topicTitle || result.topic_title || result.title, result.sectionTitle || result.section_title].filter(Boolean),
    snippet: result.snippet || result.summary || ''
  };
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
  const bootstrapQuery = useGetBootstrapQuery();
  const prefetchTopic = usePrefetch('getTopic');
  const [hydrateTopicsTrigger] = useLazyHydrateTopicsQuery();
  const [topicDetailsById, setTopicDetailsById] = useState({});
  const [isPreparingRemoteSelection, setIsPreparingRemoteSelection] = useState(false);
  const [visibleFullTopicCount, setVisibleFullTopicCount] = useState(FULL_SCROLL_INITIAL_COUNT);
  const [activeId, setActiveIdState] = useState(() => localStorage.getItem('activeTopicId') || '');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [leftCollapsed, setLeftCollapsed] = useState(() => readBool('notes:leftCollapsed', false));
  const [rightCollapsed, setRightCollapsed] = useState(() => readBool('notes:rightCollapsed', false));
  const [monacoThemePrefs, setMonacoThemePrefs] = useState(() => normalizeMonacoThemePrefs(
    readObject('notes:monacoThemes', DEFAULT_MONACO_THEME_PREFS)
  ));
  const [mermaidThemePrefs, setMermaidThemePrefs] = useState(() => normalizeMermaidThemePrefs(
    readObject('notes:mermaidThemes', DEFAULT_MERMAID_THEME_PREFS)
  ));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('overview');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [readMode, setReadMode] = useState(() => localStorage.getItem('notes:readMode') || 'topic');
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(getFullscreenElement()));
  const [pauseLazyHydration, setPauseLazyHydration] = useState(false);
  const [forcedHydratedTopicIds, setForcedHydratedTopicIds] = useState(() => new Set());

  const appShellRef = useRef(null);
  const articleRef = useRef(null);
  const scrollRef = useRef(null);
  const progressRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const scrollRetryTimerRef = useRef(0);
  const scrollSettleFrameRef = useRef(0);
  const scrollSettleTimeoutRef = useRef(0);
  const activeSectionRef = useRef('overview');
  const activeTopicRef = useRef(activeId);
  const darkModeRef = useRef(darkMode);
  const wasFullScrollRef = useRef(false);
  const fullScrollSnapshotRef = useRef({ topicId: activeId, sectionId: 'overview' });
  const visibleHeadingEntriesRef = useRef(emptyVisibleMap());
  const visibleTopicEntriesRef = useRef(emptyVisibleMap());
  const pendingLayoutAnchorRef = useRef(null);
  const pendingReadModeViewportAnchorRef = useRef(null);
  const preserveNextScrollResetRef = useRef(false);
  const readModeRestoreTimerRef = useRef(0);
  const readModeHydrationTimerRef = useRef(0);
  const readModeFreezeCleanupTimerRef = useRef(0);
  const readModeFreezeOverlayRef = useRef(null);
  const scrollAnimationFrameRef = useRef(0);
  const scrollAnimationTokenRef = useRef(0);
  const scrollRetryFrameRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollReleaseTimerRef = useRef(0);
  const fullScrollLoadMoreRef = useRef(null);

  const remoteTopics = bootstrapQuery.data?.topics || [];
  const groupOrderPreference = bootstrapQuery.data?.groupOrderPreference || [];

  const allTopics = useMemo(() => (
    remoteTopics.map((topic) => mergeTopicRecord(topic, topicDetailsById[topic.id] || {}))
  ), [remoteTopics, topicDetailsById]);

  const exportTree = useMemo(() => buildExportTree(allTopics), [allTopics]);
  const topicsById = useMemo(() => new Map(allTopics.map((topic) => [topic.id, topic])), [allTopics]);
  const [selectedExportIds, setSelectedExportIds] = useState(() => clearSelection());
  const [exportScopeLabel, setExportScopeLabel] = useState('Custom selection');
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [readerSelectionIds, setReaderSelectionIds] = useState(() => clearSelection());
  const [readerSelectionScopeLabel, setReaderSelectionScopeLabel] = useState('Custom notes selection');
  const [draftReaderSelectionIds, setDraftReaderSelectionIds] = useState(() => clearSelection());
  const [draftReaderSelectionScopeLabel, setDraftReaderSelectionScopeLabel] = useState('Custom notes selection');

  const readerSelectionPlan = useMemo(() => {
    if (!readerSelectionIds.length) return null;
    const plan = buildExportPlan(allTopics, exportTree, readerSelectionIds, readerSelectionScopeLabel);
    return plan.documents.length ? plan : null;
  }, [allTopics, exportTree, readerSelectionIds, readerSelectionScopeLabel]);
  const isReaderSelectionMode = Boolean(readerSelectionPlan?.documents.length);
  const readerSelectionTopics = useMemo(() => {
    if (!readerSelectionPlan?.documents?.length) return [];

    return readerSelectionPlan.documents.map((document) => {
      const sourceTopic = topicsById.get(document.topicId) || {};
      const selectedSectionCount = document.tocSections?.length || 0;
      const selectionSummary = document.includeFullTopic
        ? sourceTopic.summary || document.summary || ''
        : [
            sourceTopic.summary || document.summary || '',
            `${selectedSectionCount} selected section${selectedSectionCount === 1 ? '' : 's'} are visible in this custom notes view.`
          ].filter(Boolean).join(' ');

      return {
        ...sourceTopic,
        id: document.topicId,
        title: document.topicTitle,
        group: document.topicGroup,
        domain: document.domain,
        summary: selectionSummary,
        sourceFiles: document.sourceFiles || sourceTopic.sourceFiles || [],
        content: document.markdown || '',
        selectedSectionCount,
        includeFullTopic: document.includeFullTopic
      };
    });
  }, [readerSelectionPlan, topicsById]);
  const readerTopics = isReaderSelectionMode ? readerSelectionTopics : allTopics;
  const readerTopicSectionsById = useMemo(() => {
    const nextMap = new Map();
    readerTopics.forEach((topic) => {
      nextMap.set(topic.id, topic.sections?.length ? topic.sections : getSections(topic.content || ''));
    });
    return nextMap;
  }, [readerTopics]);
  const remoteSearchQuery = useSearchSectionsQuery(
    { q: debouncedQuery, limit: 24 },
    { skip: debouncedQuery.trim().length < 2 || !allTopics.length }
  );
  const searchResults = useMemo(() => {
    if (debouncedQuery.trim().length < 2) return [];
    return remoteSearchQuery.data?.map(normalizeRemoteSearchResult) || [];
  }, [debouncedQuery, remoteSearchQuery.data]);

  const activeTopic = useMemo(
    () => readerTopics.find((topic) => topic.id === activeId) || readerTopics[0] || allTopics[0] || EMPTY_TOPIC,
    [activeId, allTopics, readerTopics]
  );
  const activeTopicId = activeTopic.id || '';
  const activeTopicTitle = activeTopic.title || '';
  const activeTopicSections = readerTopicSectionsById.get(activeTopic?.id) || [];
  const deferredMermaidThemePrefs = useDeferredValue(mermaidThemePrefs);
  const currentSection = useMemo(
    () => activeTopicSections.find((section) => section.id === activeSectionId) || null,
    [activeSectionId, activeTopicSections]
  );
  const isFullScrollMode = readMode === 'full';
  const activeTopicIndex = useMemo(
    () => readerTopics.findIndex((topic) => topic.id === activeTopic?.id),
    [activeTopic?.id, readerTopics]
  );
  const visibleFullScrollTopics = useMemo(
    () => readerTopics.slice(0, Math.min(readerTopics.length, visibleFullTopicCount)),
    [readerTopics, visibleFullTopicCount]
  );
  const fullScrollRemaining = Math.max(0, readerTopics.length - visibleFullScrollTopics.length);
  const readerMonacoTheme = darkMode ? monacoThemePrefs.dark : monacoThemePrefs.light;
  const codeThemeStyle = useMemo(
    () => getStaticCodeThemeCssVariables(readerMonacoTheme),
    [readerMonacoTheme]
  );
  const selectedExportCount = selectedExportIds.length;
  const selectedReaderCount = draftReaderSelectionIds.length;

  const {
    task: exportTask,
    startExport,
    cancelExport,
    resetTask
  } = useExportTask();

  const hydrateTopicsByIds = useCallback(async (topicIds = [], { includeSectionBodies = true } = {}) => {
    const uniqueIds = Array.from(new Set(topicIds.filter(Boolean)));
    if (!uniqueIds.length) return new Map();

    const missingIds = uniqueIds.filter((id) => !topicDetailsById[id]?.content);
    if (!missingIds.length) {
      return new Map(uniqueIds.map((id) => [id, topicDetailsById[id]]).filter(([, topic]) => Boolean(topic)));
    }

    setIsPreparingRemoteSelection(true);
    try {
      const hydrated = await hydrateTopicsTrigger({ ids: missingIds, includeSectionBodies }, true).unwrap();
      const hydratedMap = new Map((hydrated || []).map((topic) => [topic.id, topic]));

      if (hydratedMap.size) {
        setTopicDetailsById((current) => {
          const next = { ...current };
          hydratedMap.forEach((topic, id) => {
            next[id] = topic;
          });
          return next;
        });
      }

      return new Map(uniqueIds.map((id) => [id, hydratedMap.get(id) || topicDetailsById[id]]).filter(([, topic]) => Boolean(topic)));
    } finally {
      setIsPreparingRemoteSelection(false);
    }
  }, [hydrateTopicsTrigger, topicDetailsById]);

  const mergeHydratedTopicList = useCallback((topics, hydratedMap) => (
    topics.map((topic) => hydratedMap.get(topic.id) ? mergeTopicRecord(topic, hydratedMap.get(topic.id)) : topic)
  ), []);

  const forceHydrateTopic = useCallback((topicId) => {
    if (!topicId) return;
    const topicIndex = readerTopics.findIndex((topic) => topic.id === topicId);
    const idsToHydrate = [
      readerTopics[topicIndex - 2]?.id,
      readerTopics[topicIndex - 1]?.id,
      topicId,
      readerTopics[topicIndex + 1]?.id,
      readerTopics[topicIndex + 2]?.id
    ].filter(Boolean);

    idsToHydrate.forEach((id) => prefetchTopic(id, { force: false }));

    setForcedHydratedTopicIds((current) => {
      if (idsToHydrate.every((id) => current.has(id))) return current;
      const next = new Set(current);
      idsToHydrate.forEach((id) => next.add(id));
      return next;
    });
  }, [prefetchTopic, readerTopics]);

  const handleTopicLoaded = useCallback((topic) => {
    if (!topic?.id) return;
    setTopicDetailsById((current) => {
      const previous = current[topic.id];
      if (previous?.body_hash && previous.body_hash === topic.body_hash && previous.content === topic.content) {
        return current;
      }
      return { ...current, [topic.id]: topic };
    });
  }, []);

  const ensureFullScrollTopicVisible = useCallback((topicId, extra = FULL_SCROLL_PREFETCH_AHEAD) => {
    if (!topicId) return;
    const index = readerTopics.findIndex((topic) => topic.id === topicId);
    if (index < 0) return;
    setVisibleFullTopicCount((current) => Math.min(
      readerTopics.length,
      Math.max(current, index + extra)
    ));
  }, [readerTopics]);

  const queueSectionScroll = useCallback((topicId, sectionId = 'overview', behavior = 'auto') => {
    if (topicId) forceHydrateTopic(topicId);
    pendingScrollRef.current = {
      topicId,
      sectionId: sectionId || 'overview',
      behavior
    };
  }, [forceHydrateTopic]);

  const releaseProgrammaticScrollSoon = useCallback((delay = 240) => {
    window.clearTimeout(programmaticScrollReleaseTimerRef.current);
    programmaticScrollReleaseTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, delay);
  }, []);

  const lockProgrammaticScroll = useCallback((duration = 600) => {
    programmaticScrollRef.current = true;
    releaseProgrammaticScrollSoon(duration + 260);
  }, [releaseProgrammaticScrollSoon]);

  const syncActiveSectionState = useCallback((nextSectionId) => {
    const normalizedSectionId = nextSectionId || 'overview';
    activeSectionRef.current = normalizedSectionId;
    startTransition(() => {
      setActiveSectionId((current) => (current === normalizedSectionId ? current : normalizedSectionId));
    });
  }, []);

  const syncActiveTopicState = useCallback((nextTopicId) => {
    if (!nextTopicId) return;
    activeTopicRef.current = nextTopicId;
    startTransition(() => {
      setActiveIdState((current) => (current === nextTopicId ? current : nextTopicId));
    });
  }, []);

  const resolveScrollTarget = useCallback((topicId, sectionId = 'overview') => {
    const article = articleRef.current;
    if (!article || !topicId) return { topicShell: null, target: null };

    const safeTopicId = escapeSelectorValue(topicId);
    const topicShell = article.querySelector(`[data-topic-shell="true"][data-topic-id="${safeTopicId}"]`);
    if (!topicShell) return { topicShell: null, target: null };

    const normalizedSectionId = sectionId || 'overview';
    const overviewAnchor = topicShell.querySelector('[data-overview-anchor="true"]') || topicShell;
    if (normalizedSectionId === 'overview') {
      return { topicShell, target: overviewAnchor };
    }

    const safeSectionId = escapeSelectorValue(normalizedSectionId);
    return {
      topicShell,
      target: topicShell.querySelector(`[data-heading-id="${safeSectionId}"]`)
    };
  }, []);

  const flashScrollTarget = useCallback((topicShell, target, sectionId = 'overview') => {
    const flashTarget = sectionId === 'overview'
      ? topicShell?.querySelector('.chat-response') || topicShell
      : target;
    if (!flashTarget) return;

    flashTarget.classList.remove('section-flash');
    window.setTimeout(() => flashTarget.classList.add('section-flash'), 20);
    window.setTimeout(() => flashTarget.classList.remove('section-flash'), 1700);
  }, []);

  const getStickyHeaderOffset = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return 84;

    const scrollerBox = scroller.getBoundingClientRect();
    const topbar = scroller.querySelector('header');
    if (!topbar) return 84;

    return Math.max(0, topbar.getBoundingClientRect().bottom - scrollerBox.top);
  }, []);

  const resolveScrollTop = useCallback((target) => {
    const scroller = scrollRef.current;
    if (!scroller || !target) return null;

    const scrollerBox = scroller.getBoundingClientRect();
    const desiredTop = getStickyHeaderOffset() + 18;
    const targetTop = target.getBoundingClientRect().top - scrollerBox.top;
    const nextTop = scroller.scrollTop + targetTop - desiredTop;
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

    return Math.max(0, Math.min(nextTop, maxTop));
  }, [getStickyHeaderOffset]);

  const captureReadModeViewportAnchor = useCallback(() => {
    const scroller = scrollRef.current;
    const article = articleRef.current;
    if (!scroller || !article) return null;

    const scrollerBox = scroller.getBoundingClientRect();
    const anchorLine = scrollerBox.top + getStickyHeaderOffset() + 24;
    const topicCandidates = Array.from(article.querySelectorAll('[data-topic-shell="true"]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height > 0);

    if (!topicCandidates.length) return null;

    const containingTopic = topicCandidates.find(({ rect }) => rect.top <= anchorLine && rect.bottom >= anchorLine);
    const nextTopic = topicCandidates.find(({ rect }) => rect.top > anchorLine);
    const previousTopic = [...topicCandidates].reverse().find(({ rect }) => rect.bottom < anchorLine);
    const activeTopicEntry = containingTopic || nextTopic || previousTopic;
    const topicElement = activeTopicEntry?.element;
    if (!topicElement) return null;

    const topicId = topicElement.getAttribute('data-topic-id') || activeTopicRef.current;
    const headingCandidates = Array.from(topicElement.querySelectorAll('[data-heading-key]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height > 0);

    const headingAbove = headingCandidates
      .filter(({ rect }) => rect.top <= anchorLine)
      .sort((left, right) => right.rect.top - left.rect.top)[0];
    const headingBelow = headingCandidates
      .filter(({ rect }) => rect.top > anchorLine)
      .sort((left, right) => left.rect.top - right.rect.top)[0];
    const activeHeading = headingAbove || headingBelow;
    const anchorElement = activeHeading?.element || topicElement.querySelector('[data-overview-anchor="true"]') || topicElement;
    const anchorRect = anchorElement.getBoundingClientRect();

    return {
      topicId,
      sectionId: activeHeading?.element?.getAttribute('data-heading-id') || activeSectionRef.current || 'overview',
      headingKey: activeHeading?.element?.getAttribute('data-heading-key') || `${topicId}:overview`,
      offset: anchorRect.top - scrollerBox.top,
      anchorLineOffset: anchorLine - scrollerBox.top,
      scrollTop: scroller.scrollTop
    };
  }, [getStickyHeaderOffset]);

  const restoreReadModeViewportAnchor = useCallback((anchor) => {
    const scroller = scrollRef.current;
    const article = articleRef.current;
    if (!anchor || !scroller || !article || !anchor.topicId) return false;

    const topicTarget = article.querySelector(
      `[data-topic-shell="true"][data-topic-id="${escapeSelectorValue(anchor.topicId)}"]`
    );
    if (!topicTarget) return false;

    const headingTarget = anchor.headingKey
      ? topicTarget.querySelector(`[data-heading-key="${escapeSelectorValue(anchor.headingKey)}"]`)
      : null;
    const sectionTarget = anchor.sectionId && anchor.sectionId !== 'overview'
      ? topicTarget.querySelector(`[data-heading-id="${escapeSelectorValue(anchor.sectionId)}"]`)
      : null;
    const target = headingTarget || sectionTarget || topicTarget.querySelector('[data-overview-anchor="true"]') || topicTarget;
    if (!target) return false;

    const restoreOnce = () => {
      const scrollerBox = scroller.getBoundingClientRect();
      const currentOffset = target.getBoundingClientRect().top - scrollerBox.top;
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const nextTop = Math.max(0, Math.min(scroller.scrollTop + currentOffset - anchor.offset, maxTop));
      scroller.scrollTop = nextTop;
    };

    restoreOnce();
    window.clearTimeout(readModeRestoreTimerRef.current);
    readModeRestoreTimerRef.current = window.setTimeout(restoreOnce, 220);
    return true;
  }, []);

  const resumeLazyHydrationSoon = useCallback((delay = 260) => {
    window.clearTimeout(readModeHydrationTimerRef.current);
    readModeHydrationTimerRef.current = window.setTimeout(() => {
      setPauseLazyHydration(false);
    }, delay);
  }, []);

  const clearReadModeFreezeOverlay = useCallback(() => {
    window.clearTimeout(readModeFreezeCleanupTimerRef.current);
    const overlay = readModeFreezeOverlayRef.current;
    if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
    readModeFreezeOverlayRef.current = null;
  }, []);

  const createReadModeFreezeOverlay = useCallback(() => {
    const source = scrollRef.current;
    if (!source || typeof document === 'undefined') return null;

    clearReadModeFreezeOverlay();
    const rect = source.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'read-mode-freeze-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: `${rect.top}px auto auto ${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '120',
      background: getComputedStyle(source).background || getComputedStyle(source).backgroundColor || 'transparent'
    });

    const clone = source.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.scrollTop = source.scrollTop;
      clone.style.height = `${rect.height}px`;
      clone.style.width = '100%';
      clone.style.overflow = 'hidden';
      clone.style.margin = '0';
      clone.style.pointerEvents = 'none';
      overlay.appendChild(clone);
    }

    document.body.appendChild(overlay);
    readModeFreezeOverlayRef.current = overlay;
    return overlay;
  }, [clearReadModeFreezeOverlay]);

  const stopAnimatedScroll = useCallback(() => {
    scrollAnimationTokenRef.current += 1;
    window.cancelAnimationFrame(scrollAnimationFrameRef.current);
    scrollAnimationFrameRef.current = 0;
  }, []);

  const animateScrollerTo = useCallback((topOrGetter, duration = 380) => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const getTop = typeof topOrGetter === 'function' ? topOrGetter : () => topOrGetter;
    const firstTargetTop = getTop();
    if (!Number.isFinite(firstTargetTop)) return;

    const startTop = scroller.scrollTop;
    const initialDelta = firstTargetTop - startTop;
    if (Math.abs(initialDelta) < 1) {
      scroller.scrollTop = firstTargetTop;
      return;
    }

    stopAnimatedScroll();
    const token = scrollAnimationTokenRef.current;
    const startedAt = performance.now();

    const easeInOutCubic = (value) => (
      value < 0.5
        ? 4 * value * value * value
        : 1 - ((-2 * value + 2) ** 3) / 2
    );

    const step = (now) => {
      if (scrollAnimationTokenRef.current !== token) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeInOutCubic(progress);
      const latestTargetTop = getTop();
      const safeTargetTop = Number.isFinite(latestTargetTop) ? latestTargetTop : firstTargetTop;
      scroller.scrollTop = startTop + (safeTargetTop - startTop) * eased;

      if (progress < 1) {
        scrollAnimationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        const exactTop = getTop();
        if (Number.isFinite(exactTop)) scroller.scrollTop = exactTop;
        scrollAnimationFrameRef.current = 0;
      }
    };

    scrollAnimationFrameRef.current = window.requestAnimationFrame(step);
  }, [stopAnimatedScroll]);

  const performScrollTo = useCallback((topOrGetter, behavior = 'auto', duration = 380) => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const getTop = typeof topOrGetter === 'function' ? topOrGetter : () => topOrGetter;
    const top = getTop();
    if (!Number.isFinite(top)) return;

    if (behavior === 'smooth') {
      animateScrollerTo(getTop, duration);
      return;
    }

    stopAnimatedScroll();
    scroller.scrollTo({ top, behavior: 'auto' });
  }, [animateScrollerTo, stopAnimatedScroll]);

  const scrollToSection = useCallback((sectionId, behavior = 'smooth', topicId = activeTopicRef.current, attempt = 0) => {
    const scroller = scrollRef.current;
    if (!scroller || !topicId) return false;

    forceHydrateTopic(topicId);

    const normalizedSectionId = sectionId || 'overview';
    const knownSections = readerTopicSectionsById.get(topicId) || [];
    const sectionExists = normalizedSectionId === 'overview'
      || knownSections.some((section) => section.id === normalizedSectionId);
    const { topicShell, target } = resolveScrollTarget(topicId, normalizedSectionId);
    const fallbackTarget = topicShell?.querySelector('[data-overview-anchor="true"]') || topicShell;
    const finalTarget = target || (!sectionExists || normalizedSectionId === 'overview' ? fallbackTarget : null);

    if (!topicShell || !finalTarget) {
      if (attempt < 28) {
        window.cancelAnimationFrame(scrollRetryFrameRef.current);
        scrollRetryFrameRef.current = window.requestAnimationFrame(() => {
          scrollToSection(normalizedSectionId, behavior, topicId, attempt + 1);
        });
      }
      return false;
    }

    window.clearTimeout(scrollRetryTimerRef.current);
    window.cancelAnimationFrame(scrollRetryFrameRef.current);

    const getDynamicTop = () => {
      const latest = resolveScrollTarget(topicId, normalizedSectionId);
      const latestFallback = latest.topicShell?.querySelector('[data-overview-anchor="true"]') || latest.topicShell;
      const latestTarget = latest.target || (!sectionExists || normalizedSectionId === 'overview' ? latestFallback : finalTarget);
      return resolveScrollTop(latestTarget);
    };

    const nextTop = getDynamicTop();
    if (!Number.isFinite(nextTop)) return false;

    const distance = Math.abs(nextTop - scroller.scrollTop);
    const duration = behavior === 'smooth'
      ? Math.min(1150, Math.max(320, Math.round(distance * 0.45)))
      : 0;

    lockProgrammaticScroll(duration || 180);
    performScrollTo(getDynamicTop, behavior, duration || 1);

    const exactCorrection = () => {
      const correctedTop = getDynamicTop();
      if (Number.isFinite(correctedTop) && Math.abs(correctedTop - scroller.scrollTop) > 1) {
        scroller.scrollTop = correctedTop;
      }
    };

    window.cancelAnimationFrame(scrollSettleFrameRef.current);
    window.clearTimeout(scrollSettleTimeoutRef.current);
    scrollSettleFrameRef.current = window.requestAnimationFrame(() => {
      scrollSettleFrameRef.current = window.requestAnimationFrame(exactCorrection);
    });
    scrollSettleTimeoutRef.current = window.setTimeout(() => {
      exactCorrection();
      releaseProgrammaticScrollSoon(120);
    }, duration + 90);

    flashScrollTarget(topicShell, finalTarget, normalizedSectionId);
    syncActiveTopicState(topicId);
    syncActiveSectionState(normalizedSectionId);
    fullScrollSnapshotRef.current = { topicId, sectionId: normalizedSectionId };
    return true;
  }, [
    flashScrollTarget,
    forceHydrateTopic,
    lockProgrammaticScroll,
    performScrollTo,
    releaseProgrammaticScrollSoon,
    resolveScrollTarget,
    resolveScrollTop,
    syncActiveSectionState,
    syncActiveTopicState,
    readerTopicSectionsById
  ]);

  const captureLayoutAnchor = useCallback(() => {
    const scroller = scrollRef.current;
    const article = articleRef.current;
    if (!scroller || !article) return;

    const scrollerBox = scroller.getBoundingClientRect();
    const anchorLine = scrollerBox.top + getStickyHeaderOffset() + 24;
    const topicCandidates = Array.from(article.querySelectorAll('[data-topic-shell="true"]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height > 0);

    const activeTopic = topicCandidates.find(({ rect }) => rect.top <= anchorLine && rect.bottom >= anchorLine)
      || topicCandidates.find(({ rect }) => rect.top > anchorLine)
      || [...topicCandidates].reverse().find(({ rect }) => rect.bottom < anchorLine);

    const topicElement = activeTopic?.element;
    if (!topicElement) return;
    const topicId = topicElement.getAttribute('data-topic-id') || activeTopicRef.current;

    const headingCandidates = Array.from(topicElement.querySelectorAll('[data-heading-key]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height > 0);

    const activeHeading = headingCandidates
      .filter(({ rect }) => rect.top <= anchorLine)
      .sort((left, right) => right.rect.top - left.rect.top)[0]
      || headingCandidates
        .filter(({ rect }) => rect.top > anchorLine)
        .sort((left, right) => left.rect.top - right.rect.top)[0];
    const anchorElement = activeHeading?.element || topicElement.querySelector('[data-overview-anchor="true"]') || topicElement;

    pendingLayoutAnchorRef.current = {
      headingKey: activeHeading?.element?.getAttribute('data-heading-key') || `${topicId}:overview`,
      topicId,
      offset: anchorElement.getBoundingClientRect().top - scrollerBox.top
    };
  }, [getStickyHeaderOffset]);

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
    forceHydrateTopic(id);
    activeTopicRef.current = id;
    activeSectionRef.current = normalizedSectionId;
    fullScrollSnapshotRef.current = { topicId: id, sectionId: normalizedSectionId };
    setActiveIdState(id);
    setSidebarOpen(false);

    if (isFullScrollMode) {
      ensureFullScrollTopicVisible(id);
      const travelBehavior = behavior === 'auto' ? 'smooth' : behavior;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollToSection(normalizedSectionId, travelBehavior, id);
        });
      });
      return;
    }

    if (sectionId) queueSectionScroll(id, sectionId, behavior === 'auto' ? 'smooth' : behavior);
  }, [ensureFullScrollTopicVisible, forceHydrateTopic, isFullScrollMode, queueSectionScroll, scrollToSection]);

  const handleSearchSelect = useCallback((result) => {
    selectTopic(
      result.topicId,
      result.sectionId === 'overview' ? null : result.sectionId,
      'smooth'
    );
    setRawQuery('');
  }, [selectTopic]);

  const handleTocJump = useCallback((section) => {
    const topicId = isFullScrollMode ? activeTopicRef.current || activeTopicId : activeTopicId;
    if (!topicId || !section?.id) return;
    forceHydrateTopic(topicId);
    scrollToSection(section.id, 'smooth', topicId);
  }, [activeTopicId, forceHydrateTopic, isFullScrollMode, scrollToSection]);

  useEffect(() => {
    if (!readerTopics.length) return;

    const currentIndex = Math.max(0, readerTopics.findIndex((topic) => topic.id === (activeTopic?.id || activeId)));
    const idsToWarm = readerTopics
      .slice(Math.max(0, currentIndex - 1), currentIndex + TOPIC_PREFETCH_WINDOW)
      .map((topic) => topic.id)
      .filter(Boolean);

    idsToWarm.forEach((id) => prefetchTopic(id, { force: false }));
  }, [activeId, activeTopic?.id, prefetchTopic, readerTopics]);

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
    localStorage.setItem('notes:mermaidThemes', JSON.stringify(mermaidThemePrefs));
  }, [mermaidThemePrefs]);

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

  useEffect(() => () => {
    window.clearTimeout(scrollRetryTimerRef.current);
    window.cancelAnimationFrame(scrollRetryFrameRef.current);
    window.cancelAnimationFrame(scrollSettleFrameRef.current);
    window.clearTimeout(scrollSettleTimeoutRef.current);
    window.clearTimeout(readModeRestoreTimerRef.current);
    window.clearTimeout(readModeHydrationTimerRef.current);
    window.clearTimeout(readModeFreezeCleanupTimerRef.current);
    window.clearTimeout(programmaticScrollReleaseTimerRef.current);
    stopAnimatedScroll();
    clearReadModeFreezeOverlay();
  }, [clearReadModeFreezeOverlay, stopAnimatedScroll]);

  useEffect(() => {
    if (!isFullScrollMode) {
      setVisibleFullTopicCount(FULL_SCROLL_INITIAL_COUNT);
      return;
    }

    setVisibleFullTopicCount((current) => Math.min(
      readerTopics.length,
      Math.max(current, FULL_SCROLL_INITIAL_COUNT, activeTopicIndex + FULL_SCROLL_PREFETCH_AHEAD)
    ));
  }, [activeTopicIndex, isFullScrollMode, readerTopics.length]);

  useEffect(() => {
    if (!isFullScrollMode) return undefined;
    const root = scrollRef.current;
    const sentinel = fullScrollLoadMoreRef.current;
    if (!root || !sentinel || visibleFullScrollTopics.length >= readerTopics.length) return undefined;

    const prefetchUpcoming = (startIndex) => {
      readerTopics
        .slice(startIndex, startIndex + FULL_SCROLL_BATCH_SIZE + FULL_SCROLL_PREFETCH_AHEAD)
        .forEach((topic) => topic?.id && prefetchTopic(topic.id, { force: false }));
    };

    prefetchUpcoming(visibleFullScrollTopics.length);

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisibleFullTopicCount((current) => {
        const next = Math.min(readerTopics.length, current + FULL_SCROLL_BATCH_SIZE);
        prefetchUpcoming(next);
        return next;
      });
    }, {
      root,
      rootMargin: '5200px 0px 6800px 0px',
      threshold: 0.01
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isFullScrollMode, prefetchTopic, readerTopics, visibleFullScrollTopics.length]);

  useLayoutEffect(() => {
    const anchor = pendingReadModeViewportAnchorRef.current;
    if (!anchor) return undefined;
    pendingReadModeViewportAnchorRef.current = null;

    const restore = () => restoreReadModeViewportAnchor(anchor);
    restore();

    let frameA = 0;
    let frameB = 0;
    let settleTimer = 0;

    frameA = window.requestAnimationFrame(() => {
      restore();
      frameB = window.requestAnimationFrame(() => {
        restore();
        settleTimer = window.setTimeout(() => {
          restore();
          clearReadModeFreezeOverlay();
          resumeLazyHydrationSoon();
        }, 220);
      });
    });

    return () => {
      if (frameA) window.cancelAnimationFrame(frameA);
      if (frameB) window.cancelAnimationFrame(frameB);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [clearReadModeFreezeOverlay, readMode, restoreReadModeViewportAnchor, resumeLazyHydrationSoon]);

  useLayoutEffect(() => {
    const anchor = pendingLayoutAnchorRef.current;
    if (!anchor) return undefined;
    pendingLayoutAnchorRef.current = null;

    let frameA = 0;
    let frameB = 0;
    let settleTimer = 0;

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
        const target = headingTarget || topicTarget;
        if (!target) return;

        const scrollerBox = scroller.getBoundingClientRect();
        const restoreAnchor = () => {
          const currentOffset = target.getBoundingClientRect().top - scrollerBox.top;
          scroller.scrollTop += currentOffset - anchor.offset;
        };

        restoreAnchor();
        settleTimer = window.setTimeout(restoreAnchor, 180);
      });
    });

    return () => {
      if (frameA) window.cancelAnimationFrame(frameA);
      if (frameB) window.cancelAnimationFrame(frameB);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [leftCollapsed, rightCollapsed, readMode]);

  useEffect(() => {
    activeTopicRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!readerTopics.length) return;

    const activeStillExists = activeId && readerTopics.some((topic) => topic.id === activeId);
    const nextId = activeStillExists ? activeId : readerTopics[0]?.id;
    if (!nextId) return;

    if (nextId !== activeId) {
      activeTopicRef.current = nextId;
      activeSectionRef.current = 'overview';
      setActiveIdState(nextId);
      setActiveSectionId('overview');
    }

    setForcedHydratedTopicIds((current) => {
      if (current.has(nextId)) return current;
      const next = new Set(current);
      next.add(nextId);
      return next;
    });

    prefetchTopic(nextId, { force: false });
  }, [activeId, prefetchTopic, readerTopics]);

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
      syncActiveSectionState('overview');
    }

    preserveNextScrollResetRef.current = false;

    if (progressRef.current && !isFullScrollMode) {
      progressRef.current.style.transform = 'scaleX(0)';
      progressRef.current.parentElement?.style.setProperty('--scroll-percent', '0%');
      progressRef.current.parentElement?.setAttribute('data-progress-label', '0%');
    }
  }, [activeTopic?.id, isFullScrollMode, scrollToSection, syncActiveSectionState]);

  useEffect(() => {
    const root = scrollRef.current;
    const article = articleRef.current;
    const bar = progressRef.current;
    if (!root || !bar) return undefined;

    let frame = 0;
    let topicShells = [];
    let headingElements = [];

    const collectScrollTargets = () => {
      if (!article) {
        topicShells = [];
        headingElements = [];
        return;
      }

      topicShells = Array.from(article.querySelectorAll('[data-topic-shell="true"]'));
      headingElements = Array.from(article.querySelectorAll('[data-heading-key]'));
    };

    const updateProgress = () => {
      const max = Math.max(0, root.scrollHeight - root.clientHeight);
      const ratio = max <= 0 ? 0 : root.scrollTop / max;
      const safeRatio = Math.min(1, Math.max(0, ratio));
      const percent = Math.round(safeRatio * 100);

      bar.style.transform = `scaleX(${safeRatio})`;
      bar.parentElement?.style.setProperty('--scroll-percent', `${safeRatio * 100}%`);
      bar.parentElement?.setAttribute('data-progress-label', `${percent}%`);
      bar.setAttribute('aria-valuenow', String(percent));
    };

    const chooseActiveTopicElement = (anchorLine) => {
      if (!topicShells.length) return null;

      let closest = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      let previous = null;
      let next = null;

      for (const element of topicShells) {
        const rect = element.getBoundingClientRect();
        if (rect.height <= 0) continue;

        if (rect.top <= anchorLine && rect.bottom >= anchorLine) return element;
        if (rect.bottom < anchorLine) previous = element;
        if (!next && rect.top > anchorLine) next = element;

        const distance = Math.min(Math.abs(rect.top - anchorLine), Math.abs(rect.bottom - anchorLine));
        if (distance < closestDistance) {
          closest = element;
          closestDistance = distance;
        }
      }

      return previous || next || closest;
    };

    const chooseActiveHeadingElement = (topicElement, anchorLine) => {
      if (!topicElement) return null;
      const topicId = topicElement.getAttribute('data-topic-id');
      if (!topicId) return null;

      let lastAbove = null;
      let firstBelow = null;
      let closest = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const heading of headingElements) {
        if (heading.getAttribute('data-topic-id') !== topicId) continue;
        const rect = heading.getBoundingClientRect();
        if (rect.height <= 0) continue;

        if (rect.top <= anchorLine) lastAbove = heading;
        else if (!firstBelow) firstBelow = heading;

        const distance = Math.abs(rect.top - anchorLine);
        if (distance < closestDistance) {
          closest = heading;
          closestDistance = distance;
        }
      }

      return lastAbove || firstBelow || closest;
    };

    const updateActiveState = () => {
      if (!article) return;

      const rootBox = root.getBoundingClientRect();
      const anchorLine = rootBox.top + getStickyHeaderOffset() + 34;
      const topicElement = chooseActiveTopicElement(anchorLine);
      const topicId = topicElement?.getAttribute('data-topic-id');
      if (!topicElement || !topicId) return;

      const headingElement = chooseActiveHeadingElement(topicElement, anchorLine);
      const sectionId = headingElement?.getAttribute('data-heading-id') || 'overview';

      if (isFullScrollMode && activeTopicRef.current !== topicId) {
        syncActiveTopicState(topicId);
      }

      if (activeSectionRef.current !== sectionId) {
        syncActiveSectionState(sectionId);
      }

      if (isFullScrollMode) {
        fullScrollSnapshotRef.current = { topicId, sectionId };
      }
    };

    const updateProgressAndActiveState = () => {
      frame = 0;
      updateProgress();
      updateActiveState();
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateProgressAndActiveState);
    };

    const recalculateTargets = () => {
      collectScrollTargets();
      requestUpdate();
    };

    collectScrollTargets();

    const headingObserver = typeof IntersectionObserver !== 'undefined' && article
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            const key = entry.target.getAttribute('data-heading-key');
            if (!key) return;
            if (entry.isIntersecting) {
              visibleHeadingEntriesRef.current.set(key, entry);
            } else {
              visibleHeadingEntriesRef.current.delete(key);
            }
          });
          requestUpdate();
        }, {
          root,
          rootMargin: '-18% 0px -62% 0px',
          threshold: [0, 0.01, 0.25, 0.5, 0.75, 1]
        })
      : null;

    const topicObserver = typeof IntersectionObserver !== 'undefined' && article
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            const id = entry.target.getAttribute('data-topic-id');
            if (!id) return;
            if (entry.isIntersecting) {
              visibleTopicEntriesRef.current.set(id, entry);
            } else {
              visibleTopicEntriesRef.current.delete(id);
            }
          });
          requestUpdate();
        }, {
          root,
          rootMargin: '-12% 0px -48% 0px',
          threshold: [0, 0.01, 0.1, 0.35, 0.65, 1]
        })
      : null;

    topicShells.forEach((element) => topicObserver?.observe(element));
    headingElements.forEach((element) => headingObserver?.observe(element));

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(requestUpdate)
      : null;
    if (resizeObserver) {
      resizeObserver.observe(root);
      if (article) resizeObserver.observe(article);
    }

    const mutationObserver = typeof MutationObserver !== 'undefined' && article
      ? new MutationObserver(() => {
          topicObserver?.disconnect();
          headingObserver?.disconnect();
          visibleHeadingEntriesRef.current = emptyVisibleMap();
          visibleTopicEntriesRef.current = emptyVisibleMap();
          collectScrollTargets();
          topicShells.forEach((element) => topicObserver?.observe(element));
          headingElements.forEach((element) => headingObserver?.observe(element));
          requestUpdate();
        })
      : null;
    mutationObserver?.observe(article, { childList: true, subtree: true });

    root.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', recalculateTargets, { passive: true });

    requestUpdate();
    const settleTimer = window.setTimeout(recalculateTargets, 260);

    return () => {
      root.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', recalculateTargets);
      window.clearTimeout(settleTimer);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      headingObserver?.disconnect();
      topicObserver?.disconnect();
      visibleHeadingEntriesRef.current = emptyVisibleMap();
      visibleTopicEntriesRef.current = emptyVisibleMap();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [
    activeTopicId,
    activeTopicSections.length,
    getStickyHeaderOffset,
    isFullScrollMode,
    readMode,
    syncActiveSectionState,
    syncActiveTopicState,
    topicDetailsById,
    visibleFullScrollTopics.length
  ]);

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
    syncActiveSectionState(snapshot.sectionId || 'overview');

    if (snapshot.topicId !== activeId) {
      preserveNextScrollResetRef.current = true;
      syncActiveTopicState(snapshot.topicId);
    }
  }, [activeId, activeSectionId, activeTopic?.id, isFullScrollMode, syncActiveSectionState, syncActiveTopicState]);

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
    if (!activeTopicId) return;
    setExportSelection(
      createSelectionForTopic(exportTree, activeTopicId),
      `Current topic: ${activeTopicTitle}`
    );
  }, [activeTopicId, activeTopicTitle, exportTree, setExportSelection]);

  const selectCurrentSectionForExport = useCallback(() => {
    if (!activeTopicId) return;
    const sectionId = activeSectionRef.current || activeSectionId || 'overview';
    const ids = createSelectionForSection(exportTree, activeTopicId, sectionId);
    const label = currentSection
      ? `Current section: ${activeTopicTitle} / ${currentSection.title}`
      : `Current topic: ${activeTopicTitle}`;
    setExportSelection(ids, label);
  }, [activeSectionId, activeTopicId, activeTopicTitle, currentSection, exportTree, setExportSelection]);

  const switchReadMode = useCallback((nextMode) => {
    const normalized = nextMode === 'full' ? 'full' : 'topic';
    if (normalized === readMode) return;

    stopAnimatedScroll();
    const viewportAnchor = captureReadModeViewportAnchor();
    const fallbackSnapshot = {
      topicId: activeTopicRef.current || activeTopic?.id || allTopics[0]?.id,
      sectionId: activeSectionRef.current || activeSectionId || 'overview'
    };
    const snapshot = viewportAnchor || fallbackSnapshot;
    forceHydrateTopic(snapshot.topicId);
    createReadModeFreezeOverlay();

    const applyModeChange = () => {
      preserveNextScrollResetRef.current = true;
      fullScrollSnapshotRef.current = {
        topicId: snapshot.topicId,
        sectionId: snapshot.sectionId || 'overview'
      };
      activeSectionRef.current = snapshot.sectionId || 'overview';
      setActiveSectionId(snapshot.sectionId || 'overview');

      if (normalized === 'topic' && snapshot.topicId && snapshot.topicId !== activeId) {
        activeTopicRef.current = snapshot.topicId;
        setActiveIdState(snapshot.topicId);
      }

      setPauseLazyHydration(true);
      setReadMode(normalized);
    };

    if (viewportAnchor) {
      pendingReadModeViewportAnchorRef.current = viewportAnchor;
    } else {
      captureLayoutAnchor();
      readModeFreezeCleanupTimerRef.current = window.setTimeout(() => {
        clearReadModeFreezeOverlay();
        resumeLazyHydrationSoon();
      }, 240);
    }

    flushSync(() => {
      applyModeChange();
    });
  }, [
    activeId,
    activeSectionId,
    activeTopic?.id,
    captureLayoutAnchor,
    captureReadModeViewportAnchor,
    clearReadModeFreezeOverlay,
    createReadModeFreezeOverlay,
    forceHydrateTopic,
    readMode,
    resumeLazyHydrationSoon,
    stopAnimatedScroll
  ]);

  const openExportDialog = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const updateMonacoTheme = useCallback((mode, theme) => {
    startTransition(() => {
      setMonacoThemePrefs((current) => normalizeMonacoThemePrefs({
        ...current,
        [mode]: theme
      }));
    });
  }, []);

  const updateMermaidTheme = useCallback((mode, field, value) => {
    startTransition(() => {
      setMermaidThemePrefs((current) => normalizeMermaidThemePrefs({
        ...current,
        [mode]: {
          ...current[mode],
          [field]: value
        }
      }));
    });
  }, []);

  const resetMonacoThemes = useCallback(() => {
    startTransition(() => {
      setMonacoThemePrefs(normalizeMonacoThemePrefs(DEFAULT_MONACO_THEME_PREFS));
    });
  }, []);

  const resetMermaidThemes = useCallback(() => {
    startTransition(() => {
      setMermaidThemePrefs(normalizeMermaidThemePrefs(DEFAULT_MERMAID_THEME_PREFS));
    });
  }, []);

  const resetReaderThemes = useCallback(() => {
    startTransition(() => {
      setMonacoThemePrefs(normalizeMonacoThemePrefs(DEFAULT_MONACO_THEME_PREFS));
      setMermaidThemePrefs(normalizeMermaidThemePrefs(DEFAULT_MERMAID_THEME_PREFS));
    });
  }, []);

  const closeExportDialog = useCallback(() => {
    setExportDialogOpen(false);
  }, []);

  const openSelectionDialog = useCallback(() => {
    setDraftReaderSelectionIds(readerSelectionIds.length ? [...readerSelectionIds] : clearSelection());
    setDraftReaderSelectionScopeLabel(readerSelectionIds.length ? readerSelectionScopeLabel : 'Custom notes selection');
    setSelectionDialogOpen(true);
  }, [readerSelectionIds, readerSelectionScopeLabel]);

  const closeSelectionDialog = useCallback(() => {
    setSelectionDialogOpen(false);
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

  const startPdfExport = useCallback(async () => {
    const skeletonPlan = buildExportPlan(allTopics, exportTree, selectedExportIds, exportScopeLabel);
    if (!skeletonPlan.documents.length) return;

    const hydratedMap = await hydrateTopicsByIds(
      skeletonPlan.documents.map((document) => document.topicId),
      { includeSectionBodies: true }
    );
    const hydratedTopics = mergeHydratedTopicList(allTopics, hydratedMap);
    const plan = buildExportPlan(hydratedTopics, exportTree, selectedExportIds, exportScopeLabel);
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
  }, [allTopics, exportScopeLabel, exportTree, hydrateTopicsByIds, mergeHydratedTopicList, selectedExportIds, startExport]);

  const setDraftReaderSelection = useCallback((nextIds, nextLabel) => {
    setDraftReaderSelectionIds(nextIds);
    setDraftReaderSelectionScopeLabel(nextLabel);
  }, []);

  const handleReaderNodeToggle = useCallback((nodeId, checked) => {
    setDraftReaderSelectionIds((previous) => applyNodeSelection(exportTree, previous, nodeId, checked));
    setDraftReaderSelectionScopeLabel('Custom notes selection');
  }, [exportTree]);

  const selectAllForReader = useCallback(() => {
    setDraftReaderSelection(createSelectionForAll(exportTree), 'All notes');
  }, [exportTree, setDraftReaderSelection]);

  const clearDraftReaderSelection = useCallback(() => {
    setDraftReaderSelection(clearSelection(), 'Custom notes selection');
  }, [setDraftReaderSelection]);

  const selectCurrentTopicForReader = useCallback(() => {
    if (!activeTopicId) return;
    setDraftReaderSelection(
      createSelectionForTopic(exportTree, activeTopicId),
      `Current topic: ${activeTopicTitle}`
    );
  }, [activeTopicId, activeTopicTitle, exportTree, setDraftReaderSelection]);

  const selectCurrentSectionForReader = useCallback(() => {
    if (!activeTopicId) return;
    const sectionId = activeSectionRef.current || activeSectionId || 'overview';
    const ids = createSelectionForSection(exportTree, activeTopicId, sectionId);
    const label = currentSection
      ? `Current section: ${activeTopicTitle} / ${currentSection.title}`
      : `Current topic: ${activeTopicTitle}`;
    setDraftReaderSelection(ids, label);
  }, [activeSectionId, activeTopicId, activeTopicTitle, currentSection, exportTree, setDraftReaderSelection]);

  const applyReaderSelection = useCallback(async () => {
    const skeletonPlan = buildExportPlan(allTopics, exportTree, draftReaderSelectionIds, draftReaderSelectionScopeLabel);
    if (!skeletonPlan.documents.length) return;

    const hydratedMap = await hydrateTopicsByIds(
      skeletonPlan.documents.map((document) => document.topicId),
      { includeSectionBodies: true }
    );
    const hydratedTopics = mergeHydratedTopicList(allTopics, hydratedMap);
    const plan = buildExportPlan(hydratedTopics, exportTree, draftReaderSelectionIds, draftReaderSelectionScopeLabel);
    const firstDocument = plan.documents[0];
    if (!firstDocument) return;

    setReaderSelectionIds([...draftReaderSelectionIds]);
    setReaderSelectionScopeLabel(draftReaderSelectionScopeLabel || 'Custom notes selection');

    const firstSectionId = firstDocument.tocSections?.[0]?.id || 'overview';
    activeTopicRef.current = firstDocument.topicId;
    activeSectionRef.current = firstSectionId;
    fullScrollSnapshotRef.current = {
      topicId: firstDocument.topicId,
      sectionId: firstSectionId
    };
    setActiveIdState(firstDocument.topicId);
    setActiveSectionId(firstSectionId);
    forceHydrateTopic(firstDocument.topicId);
    setSelectionDialogOpen(false);

    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [allTopics, draftReaderSelectionIds, draftReaderSelectionScopeLabel, exportTree, forceHydrateTopic, hydrateTopicsByIds, mergeHydratedTopicList]);

  const removeReaderSelection = useCallback(() => {
    const emptySelection = clearSelection();
    setReaderSelectionIds(emptySelection);
    setReaderSelectionScopeLabel('Custom notes selection');
    setDraftReaderSelectionIds(emptySelection);
    setDraftReaderSelectionScopeLabel('Custom notes selection');
    setSelectionDialogOpen(false);
  }, []);

  const renderTopicShell = useCallback((topic, { fullScroll = false, index = 0, selectionMode = false } = {}) => {
    const sectionCount = topic.sections?.length || topic.section_count || getSections(topic.content || '').length;
    const overviewId = createScopedHeadingId(topic.id, 'overview', fullScroll ? 'full' : 'reader');
    const forceHydratedForTopic = !fullScroll || topic.id === activeTopicId || forcedHydratedTopicIds.has(topic.id);
    const hasTopicBody = Boolean(topic.content || topicDetailsById[topic.id]?.content);
    const showTopicHeader = !fullScroll || forceHydratedForTopic || hasTopicBody;
    const shellClassName = fullScroll
      ? `full-scroll-topic-shell${index === 0 ? '' : ' mt-12'}${forceHydratedForTopic ? ' is-force-hydrated' : ''}`
      : '';

    return (
      <section
        key={`${fullScroll ? 'full' : 'topic'}-${topic.id}`}
        data-topic-shell="true"
        data-topic-id={topic.id}
        data-topic-title={topic.title}
        data-force-hydrated={forceHydratedForTopic ? 'true' : undefined}
        className={shellClassName}
      >
        <div
          id={overviewId}
          data-overview-anchor="true"
          data-heading-id="overview"
          data-heading-key={`${topic.id}:overview`}
          data-topic-id={topic.id}
          className="scroll-mt-28"
        />

        {showTopicHeader ? (
          <div className="hero-card mb-8 overflow-hidden rounded-[2rem] border p-6 md:p-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">{topic.group || topic.domain}</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                {selectionMode ? 'selected notes chapter' : fullScroll ? 'continuous cookbook chapter' : 'single topic view'}
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
        ) : null}

        <LazyTopicContent
          topic={topic}
          darkMode={darkMode}
          codeThemeStyle={codeThemeStyle}
          mermaidThemePrefs={deferredMermaidThemePrefs}
          scrollRootRef={scrollRef}
          fullScroll={fullScroll}
          suspendHydration={pauseLazyHydration}
          sectionCount={sectionCount}
          forceHydrated={forceHydratedForTopic}
          onTopicLoaded={handleTopicLoaded}
        />
      </section>
    );
  }, [activeTopicId, codeThemeStyle, darkMode, deferredMermaidThemePrefs, forcedHydratedTopicIds, handleTopicLoaded, pauseLazyHydration, topicDetailsById]);

  if (!allTopics.length && (bootstrapQuery.isLoading || bootstrapQuery.isFetching)) {
    return <AppStartupLoader message="Loading..." />;
  }

  if (!allTopics.length && bootstrapQuery.isError) {
    return <AppStartupLoader message="Remote notes could not be reached. Please retry after the backend wakes up." />;
  }

  if (!allTopics.length) {
    return <AppStartupLoader message="No remote notes are available yet." />;
  }

  return (
    <div ref={appShellRef} className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] transition-colors">
      <ProgressBar ref={progressRef} />
      <SyncStatusDock
        show={bootstrapQuery.isFetching || bootstrapQuery.isError || remoteSearchQuery.isFetching || isPreparingRemoteSelection}
        status={bootstrapQuery.isError ? 'error' : 'syncing'}
        message={bootstrapQuery.isError ? 'Backend is waking up. Retrying remote notes.' : isPreparingRemoteSelection ? 'Preparing selected remote notes' : undefined}
      />

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
          topics={readerTopics}
          activeId={activeTopicId}
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
            onResetMonacoThemes={resetMonacoThemes}
            mermaidThemePrefs={mermaidThemePrefs}
            onMermaidThemeChange={updateMermaidTheme}
            onResetMermaidThemes={resetMermaidThemes}
            onResetReaderThemes={resetReaderThemes}
            onOpenExportDialog={openExportDialog}
            onOpenSelectionDialog={openSelectionDialog}
            customSelectionActive={isReaderSelectionMode}
            fullScrollMode={isFullScrollMode}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            readMode={readMode}
            onReadModeChange={switchReadMode}
          />

          <article ref={articleRef} className="chat-article mx-auto max-w-6xl px-4 py-8 md:px-8 lg:px-10 print:max-w-none print:px-0">
            {isFullScrollMode
              ? visibleFullScrollTopics.map((topic, index) => renderTopicShell(topic, { fullScroll: true, index, selectionMode: isReaderSelectionMode }))
              : renderTopicShell(activeTopic, { selectionMode: isReaderSelectionMode })}

            {isFullScrollMode && fullScrollRemaining > 0 ? (
              <div ref={fullScrollLoadMoreRef}>
                <FullScrollTailLoader remaining={fullScrollRemaining} />
              </div>
            ) : null}
          </article>
        </main>

        <Toc
          topic={activeTopic}
          sections={activeTopicSections}
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
        currentTopicTitle={activeTopicTitle}
        currentSectionTitle={currentSection?.title || 'Overview / topic-level export'}
        canSelectCurrentSection={Boolean(activeTopic?.id)}
        onToggleCheck={handleExportNodeToggle}
        onSelectAll={selectAllForExport}
        onClearAll={clearExportSelection}
        onSelectCurrentTopic={selectCurrentTopicForExport}
        onSelectCurrentSection={selectCurrentSectionForExport}
        onExport={startPdfExport}
        status={isPreparingRemoteSelection ? 'preparing' : exportTask.status}
        stage={isPreparingRemoteSelection ? 'Hydrating selected remote notes' : exportTask.stage}
        progress={isPreparingRemoteSelection ? 12 : exportTask.progress}
        error={exportTask.error}
        onCancel={cancelExport}
      />

      <SelectionDialog
        open={selectionDialogOpen}
        onClose={closeSelectionDialog}
        tree={exportTree}
        selectedIds={draftReaderSelectionIds}
        selectedCount={selectedReaderCount}
        scopeLabel={draftReaderSelectionScopeLabel}
        currentTopicTitle={activeTopicTitle}
        currentSectionTitle={currentSection?.title || 'Overview / topic-level selection'}
        canSelectCurrentSection={Boolean(activeTopic?.id)}
        onToggleCheck={handleReaderNodeToggle}
        onSelectAll={selectAllForReader}
        onClearDraft={clearDraftReaderSelection}
        onSelectCurrentTopic={selectCurrentTopicForReader}
        onSelectCurrentSection={selectCurrentSectionForReader}
        onApply={applyReaderSelection}
        onRemoveSelection={removeReaderSelection}
        hasActiveSelection={isReaderSelectionMode}
      />
    </div>
  );
}
