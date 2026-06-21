# Tech Notes

A polished Vite + React study app for reading, searching, and exporting long-form technical notes.

This project turns raw learning material such as ChatGPT PDF exports, HTML notes, and curated topic expansions into a clean local knowledge base with section search, sticky outlines, Monaco-rendered code blocks, Mermaid diagrams, and background PDF export.

---

## Overview

`Tech Notes` is a static frontend application. There is no backend, database, or auth layer in the current project. All content is bundled from local source files and rendered client-side.

The app is designed for deep reading rather than short snippets:

- topic-by-topic reading and full continuous reading modes
- grouped navigation for AWS, Python, React, FastAPI, Databases, DevOps, and more
- section-level search with ranked matches and highlighted snippets
- right-side table of contents with stable heading anchors
- lazy code rendering with Monaco editor previews
- Mermaid diagram rendering with graceful fallback
- selectable PDF export running in a Web Worker
- light and dark app themes, plus separate Monaco theme preferences

---

## Feature Highlights

| Area | What it includes |
|---|---|
| Reader experience | Single-topic mode, full-notes mode, sticky topbar, reading progress, smooth section jumps |
| Navigation | Grouped sidebar, mobile drawer, collapsible left and right panels, persisted UI state |
| Search | Fast section-level search across title, summary, headings, body text, and code-adjacent text |
| Markdown rendering | GitHub-flavored Markdown, code fences, tables, lists, blockquotes, Mermaid diagrams |
| Code blocks | Read-only Monaco editor, lazy hydration near viewport, copy button, expand/compact modes |
| Export | Tree-based selection by group, topic, or section, background PDF generation, cancel support |
| Content pipeline | Merge, normalize, dedupe, enrich, group, and section-index multiple note sources |
| Deployment | Production build with Vite and SPA-ready Firebase Hosting config |

---

## How It Works

```text
Source notes
  -> src/data/baseNotes.js
  -> src/data/coreDeepNotes.js
  -> src/data/generatedSourceNotes.js
  -> src/data/expandedDeepNotes.js

Merge + enhancement pipeline
  -> src/data/notes.js
  -> merge related sources into curated topics
  -> normalize markdown and code fences
  -> infer groups/domains
  -> build section metadata and search text

Reader UI
  -> src/App.jsx
  -> Sidebar + TOC + Markdown renderer
  -> search index + section navigation
  -> persisted theme/panel preferences

Export pipeline
  -> export tree selection
  -> PDF worker prepares and renders content
  -> browser download starts when export completes
```

---

## Tech Stack

| Layer | Tools |
|---|---|
| App framework | React, Vite |
| Styling | Tailwind CSS utilities + custom CSS variables |
| Markdown | `react-markdown`, `remark-gfm`, `rehype-slug` |
| Code rendering | `@monaco-editor/react`, `monaco-editor` |
| Diagrams | `mermaid` |
| Icons | `lucide-react` |
| Export | `jsPDF`, Web Workers |
| Hosting | Firebase Hosting |

---

## Local Development

### Prerequisites

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

Vite opens the app automatically. The default local URL is usually:

```text
http://localhost:5173
```

### Create a production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

---

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Project Structure

```text
.
├── README.md
├── firebase.json
├── package.json
├── vite.config.js
├── tailwind.config.js
└── src
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── components
    │   ├── Sidebar.jsx
    │   ├── Topbar.jsx
    │   ├── Toc.jsx
    │   ├── MarkdownRenderer.jsx
    │   ├── LazyTopicContent.jsx
    │   ├── ExportDialog.jsx
    │   ├── ExportTree.jsx
    │   └── ExportStatusToast.jsx
    ├── hooks
    │   └── useExportTask.js
    ├── workers
    │   ├── exportWorker.js
    │   └── pdfExportWorker.js
    ├── utils
    │   ├── text.js
    │   ├── search.js
    │   ├── exportTree.js
    │   ├── exportPreparation.js
    │   ├── monacoThemes.js
    │   └── pdf.js
    └── data
        ├── notes.js
        ├── baseNotes.js
        ├── coreDeepNotes.js
        ├── generatedSourceNotes.js
        ├── expandedDeepNotes.js
        ├── topicDepthEnhancements.js
        └── markdown/
```

---

## Core App Behavior

### Reading modes

- `Single topic` shows the active topic only.
- `Full notes` turns the app into one continuous reader across all topics.

### Search model

The search index is built from section-level content, not only from topic titles. Queries are ranked using phrase hits, heading matches, topic/group matches, and token/prefix matching.

### Heading + TOC system

- headings are extracted from markdown sections
- duplicate-safe IDs are generated for stable deep links
- the active section is tracked while scrolling
- TOC jumps scroll precisely to the relevant heading

### Code and diagram rendering

- code blocks first render as lightweight static previews
- Monaco editors hydrate only when the block approaches the viewport
- long blocks can expand into their own scroll area
- Mermaid diagrams are rendered lazily and fall back safely if rendering fails

### Export flow

- users can export all notes, the current topic, or only selected sections
- export selection is built from a group/topic/section tree
- PDF generation runs in a worker so the UI stays responsive
- download begins automatically after the worker finishes

---

## Data Pipeline

The main content assembly happens in [`src/data/notes.js`](src/data/notes.js).

This file is responsible for:

1. importing multiple note collections
2. merging source notes into broader curated topics
3. normalizing markdown and code fences
4. inferring groups such as `AWS`, `Python`, `React`, `Databases`, and `DevOps`
5. generating section metadata for navigation and search
6. sorting the final note catalog into a predictable reading order

This gives the UI one clean array: `curatedNotes`.

---

## Adding or Editing Notes

You can extend the app in two ways:

1. Add a fully curated note directly to `src/data/expandedDeepNotes.js`
2. Add source material to one of the imported source files and let `src/data/notes.js` merge it

Recommended note shape:

```js
{
  id: 'aws-new-service',
  group: 'AWS',
  domain: 'AWS Services',
  title: 'New Service',
  summary: 'Short searchable summary.',
  sourceFiles: ['optional-source.pdf'],
  content: `# New Service

## What it is

## Why it exists

## Core concepts

## Setup

## Example

\`\`\`js
console.log('hello');
\`\`\`

## Diagram

\`\`\`mermaid
flowchart LR
  A[Client] --> B[Service]
\`\`\`
`
}
```

### Authoring tips

- Use `##`, `###`, and `####` headings for sections you want indexed.
- Keep the top-level title aligned with the topic title when possible.
- Prefer fenced code blocks with an explicit language.
- Use Mermaid for flows and architecture sketches.
- Put key terms in the summary so search results rank better.

---

## Deployment

The project already includes Firebase Hosting configuration:

- `firebase.json` serves the `dist/` folder
- all routes rewrite to `index.html`
- the hosting target is `notes`

### Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting:notes
```

The current Firebase target mapping is stored in `.firebaserc`.

---

## Key Files

| File | Role |
|---|---|
| `src/App.jsx` | Main application state, reading mode, search wiring, panel behavior |
| `src/components/Sidebar.jsx` | Navigation, grouping, search UI, mobile sidebar |
| `src/components/Topbar.jsx` | Theme controls, read mode switch, export entry point |
| `src/components/Toc.jsx` | Active outline and section jump navigation |
| `src/components/MarkdownRenderer.jsx` | Markdown, Monaco code blocks, Mermaid diagrams |
| `src/hooks/useExportTask.js` | Worker lifecycle, progress updates, download trigger |
| `src/utils/search.js` | Search indexing and ranking |
| `src/utils/text.js` | Section extraction, slugging, markdown normalization |
| `src/utils/exportTree.js` | Export selection model and export plan builder |
| `src/data/notes.js` | Curated note assembly pipeline |

---

## Current Status

The production build is working:

```bash
npm run build
```

This was verified successfully in the current workspace on June 22, 2026.

---

## Summary

This repository is a static technical knowledge base with a strong reader experience, a non-trivial content pipeline, and a solid export workflow. If you want to turn large, messy learning material into a structured, searchable frontend app, this project already has the key pieces in place.
