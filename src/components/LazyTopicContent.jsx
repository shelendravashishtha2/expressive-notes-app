import { memo, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer.jsx';

function estimateTopicHeight(markdown = '', sectionCount = 0) {
  const contentLength = markdown.length;
  const byLength = Math.round(contentLength * 0.11);
  const bySections = sectionCount * 260;
  return Math.max(540, Math.min(4200, Math.max(byLength, bySections) + 260));
}

function useNearViewport(rootRef, enabled, rootMargin = '1400px 0px 1400px 0px') {
  const targetRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(!enabled);

  useEffect(() => {
    if (!enabled || nearViewport) return undefined;

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
  }, [enabled, nearViewport, rootMargin, rootRef]);

  return [targetRef, nearViewport];
}

function LazyTopicContent({
  topic,
  darkMode,
  monacoTheme,
  scrollRootRef,
  fullScroll = false,
  sectionCount = 0,
  forceHydrated = false
}) {
  const [shellRef, nearViewport] = useNearViewport(scrollRootRef, fullScroll);
  const [hydrated, setHydrated] = useState(!fullScroll || forceHydrated);
  const estimatedHeight = useMemo(
    () => estimateTopicHeight(topic?.content || '', sectionCount),
    [sectionCount, topic?.content]
  );

  useEffect(() => {
    if (nearViewport || forceHydrated) {
      setHydrated(true);
    }
  }, [forceHydrated, nearViewport]);

  return (
    <div ref={shellRef} className="topic-content-shell">
      {hydrated ? (
        <div className="chat-response rounded-[2rem] border border-[var(--border)] bg-[var(--article-bg)] p-5 shadow-sm md:p-8">
          <MarkdownRenderer
            content={topic.content}
            darkMode={darkMode}
            monacoTheme={monacoTheme}
            topicId={topic.id}
            headingIdPrefix={`${topic.id}__reader__`}
          />
        </div>
      ) : (
        <div
          className="topic-lazy-placeholder rounded-[2rem] border border-[var(--border)] bg-[var(--article-bg)] p-5 shadow-sm md:p-8"
          style={{ minHeight: `${estimatedHeight}px` }}
        >
          <div className="topic-lazy-meta">
            <span>{sectionCount} sections queued</span>
            <span>Loading near viewport</span>
          </div>
          <div className="topic-lazy-bars">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(LazyTopicContent);
