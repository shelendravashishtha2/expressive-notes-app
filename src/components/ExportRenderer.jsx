import { memo, useMemo } from 'react';
import MarkdownRenderer from './MarkdownRenderer.jsx';

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
}

function sectionAnchor(topicId, sectionId) {
  return `${topicId}__pdf__${sectionId}`;
}

function ExportRenderer({ plan, generatedAt }) {
  const timestamp = useMemo(() => formatTimestamp(generatedAt || new Date()), [generatedAt]);

  if (!plan) return null;

  return (
    <div className="pdf-all-root pdf-document-root">
      <section className="pdf-cover">
        <p className="pdf-kicker">Technical Notes Cookbook</p>
        <h1 className="pdf-cover-title">Selected Technical Notes Export</h1>
        <p className="pdf-cover-summary">
          {plan.summaryText}. Generated from the current curated notes dataset with static code and diagram fallbacks for PDF output.
        </p>

        <div className="pdf-meta-grid">
          <div className="pdf-meta-card">
            <span className="pdf-meta-label">Scope</span>
            <strong>{plan.scopeLabel}</strong>
          </div>
          <div className="pdf-meta-card">
            <span className="pdf-meta-label">Generated</span>
            <strong>{timestamp}</strong>
          </div>
          <div className="pdf-meta-card">
            <span className="pdf-meta-label">Topics</span>
            <strong>{plan.selectedTopicCount}</strong>
          </div>
          <div className="pdf-meta-card">
            <span className="pdf-meta-label">Sections</span>
            <strong>{plan.selectedSectionCount}</strong>
          </div>
        </div>
      </section>

      <section className="pdf-page-break pdf-summary-page">
        <h2>Export Summary</h2>
        <p>
          This document includes only the currently selected notes and sections. Interactive app controls, sidebars, buttons,
          Monaco editor UI, and live navigation panels are excluded from the export.
        </p>

        <div className="pdf-summary-grid">
          <div className="pdf-summary-card">
            <h3>Selection scope</h3>
            <p>{plan.scopeLabel}</p>
          </div>
          <div className="pdf-summary-card">
            <h3>Included content</h3>
            <p>{plan.summaryText}</p>
          </div>
        </div>

        <h2>Table of Contents</h2>
        <nav className="pdf-toc">
          {plan.documents.map((document) => (
            <div key={document.topicId} className="pdf-toc-topic">
              <a href={`#${document.anchorId}`} className="pdf-toc-topic-link">{document.topicTitle}</a>
              {document.tocSections.length ? (
                <div className="pdf-toc-sections">
                  {document.tocSections.map((section) => (
                    <a
                      key={`${document.topicId}-${section.id}`}
                      href={`#${sectionAnchor(document.topicId, section.id)}`}
                      className={`pdf-toc-section-link level-${section.level}`}
                    >
                      {section.title}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </section>

      {plan.documents.map((document, index) => (
        <section
          key={document.topicId}
          id={document.anchorId}
          className={index === 0 ? 'pdf-topic-sheet' : 'pdf-page-break pdf-topic-sheet'}
        >
          <p className="pdf-topic-kicker">{document.topicGroup}</p>
          <h1>{document.topicTitle}</h1>
          {document.summary ? <p className="pdf-topic-summary">{document.summary}</p> : null}

          <div className="pdf-topic-meta">
            <span><strong>Domain:</strong> {document.domain || document.topicGroup}</span>
            <span><strong>Mode:</strong> {document.includeFullTopic ? 'Full topic export' : 'Selected sections only'}</span>
            <span><strong>Sections:</strong> {document.tocSections.length || 'Topic-level content only'}</span>
          </div>

          {document.sourceFiles.length ? (
            <p className="pdf-source-list"><strong>Source files:</strong> {document.sourceFiles.join(', ')}</p>
          ) : null}

          <MarkdownRenderer
            content={document.markdown}
            darkMode={false}
            pdfMode
            topicId={document.topicId}
            headingIdPrefix={`${document.topicId}__pdf__`}
          />
        </section>
      ))}
    </div>
  );
}

export default memo(ExportRenderer);
