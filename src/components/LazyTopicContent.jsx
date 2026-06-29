import { memo, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer.jsx';
import { InlineTopicLoader } from './loaders/AppLoading.jsx';
import { useGetTopicQuery } from '../features/notes/notesApi.js';

function estimateTopicHeight(markdown = '', sectionCount = 0) {
  const contentLength = markdown.length;
  const byLength = Math.round(contentLength * 0.11);
  const bySections = sectionCount * 260;
  return Math.max(540, Math.min(4200, Math.max(byLength, bySections) + 260));
}

function useNearViewport(rootRef, enabled, rootMargin = '5600px 0px 7200px 0px', suspended = false) {
  const targetRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(!enabled);

  useEffect(() => {
    if (!enabled || nearViewport || suspended) return undefined;

    const target = targetRef.current;
    const root = rootRef.current;
    if (!target || !root) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, {
      root,
      rootMargin,
      threshold: 0.01
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, nearViewport, rootMargin, rootRef, suspended]);

  return [targetRef, nearViewport];
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function topicContent(topic = {}) {
  return firstString(
    topic.content,
    topic.body_markdown,
    topic.bodyMarkdown,
    topic.markdown,
    topic.markdown_body,
    topic.rawText,
    topic.raw_text,
    topic.body,
    topic.text,
    topic.md
  );
}

function topicSections(topic = {}) {
  return firstArray(
    topic.sections,
    topic.section_tree,
    topic.sectionTree,
    topic.headings,
    topic.toc,
    topic.children,
    topic.subsections,
    topic.items
  );
}

function mergeTopic(baseTopic = {}, remoteTopic = null) {
  if (!remoteTopic) return baseTopic;
  return {
    ...baseTopic,
    ...remoteTopic,
    content: topicContent(remoteTopic) || topicContent(baseTopic),
    sections: topicSections(remoteTopic).length ? topicSections(remoteTopic) : topicSections(baseTopic),
    sourceFiles: remoteTopic.sourceFiles?.length ? remoteTopic.sourceFiles : baseTopic.sourceFiles || []
  };
}

function LazyTopicContent({
  topic,
  darkMode,
  codeThemeStyle,
  mermaidThemePrefs,
  scrollRootRef,
  fullScroll = false,
  suspendHydration = false,
  sectionCount = 0,
  forceHydrated = false,
  lockContent = false,
  onTopicLoaded
}) {
  const [shellRef, nearViewport] = useNearViewport(scrollRootRef, fullScroll, '5600px 0px 7200px 0px', suspendHydration);
  const [hydrated, setHydrated] = useState(!fullScroll || forceHydrated);
  const shouldFetch = !lockContent && Boolean(topic?.id) && (hydrated || nearViewport || forceHydrated || Boolean(topic?.content));
  const topicQuery = useGetTopicQuery(topic?.id, {
    skip: !shouldFetch,
    refetchOnMountOrArgChange: false
  });
  const renderedTopic = useMemo(() => (lockContent ? topic : mergeTopic(topic, topicQuery.data)), [lockContent, topic, topicQuery.data]);
  const hasRenderableContent = Boolean(renderedTopic?.content);
  const estimatedHeight = useMemo(
    () => estimateTopicHeight(renderedTopic?.content || topic?.content || '', sectionCount || renderedTopic?.section_count || 0),
    [renderedTopic?.content, renderedTopic?.section_count, sectionCount, topic?.content]
  );

  useEffect(() => {
    if (nearViewport || forceHydrated || renderedTopic?.content) {
      setHydrated(true);
    }
  }, [forceHydrated, nearViewport, renderedTopic?.content]);

  useEffect(() => {
    if (topicQuery.data?.id) {
      onTopicLoaded?.(topicQuery.data);
    }
  }, [onTopicLoaded, topicQuery.data]);

  const showInlineLoader = hydrated && !hasRenderableContent && !topicQuery.isError;
  const showSyncRibbon = !lockContent && hydrated && hasRenderableContent && topicQuery.isFetching && !topicQuery.data;

  return (
    <div ref={shellRef} className={`topic-content-shell${forceHydrated ? ' is-force-hydrated' : ''}`}>
      {hydrated ? (
        showInlineLoader ? (
          <InlineTopicLoader message="Loading..." minHeight="320px" />
        ) : (
          <div className="chat-response rounded-[2rem] border border-[var(--border)] bg-[var(--article-bg)] p-5 md:p-8">
            {showSyncRibbon ? (
              <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                Syncing latest copy in the background
              </div>
            ) : null}

            {topicQuery.isError && !hasRenderableContent ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm font-semibold text-[var(--muted)]">
                Could not load this topic right now. Please retry once the backend is awake.
              </div>
            ) : (
              <div style={codeThemeStyle}>
                <MarkdownRenderer
                  content={renderedTopic.content || ''}
                  darkMode={darkMode}
                  mermaidThemePrefs={mermaidThemePrefs}
                  topicId={renderedTopic.id}
                  headingIdPrefix={`${renderedTopic.id}__reader__`}
                />
              </div>
            )}
          </div>
        )
      ) : (
        <InlineTopicLoader message="Loading..." minHeight={`${estimatedHeight}px`} />
      )}
    </div>
  );
}

export default memo(LazyTopicContent);
