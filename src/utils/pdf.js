import { jsPDF } from 'jspdf';

const PAGE = {
  width: 210,
  height: 297,
  left: 16,
  right: 16,
  top: 18,
  bottom: 16
};

const COLORS = {
  text: [15, 23, 42],
  muted: [100, 116, 139],
  accent: [37, 99, 235],
  accentSoft: [219, 234, 254],
  border: [191, 219, 254],
  codeBg: [241, 245, 249],
  codeTop: [226, 232, 240],
  quoteBg: [239, 246, 255],
  quoteBorder: [96, 165, 250],
  tableHead: [239, 246, 255],
  tableRow: [248, 250, 252]
};

function report(callback, value) {
  if (typeof callback === 'function') callback(value);
}

function abortIfNeeded(signal) {
  if (signal?.aborted) {
    throw new DOMException('Export cancelled by user.', 'AbortError');
  }
}

async function cooperativeYield(signal) {
  abortIfNeeded(signal);
  await new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 32 });
    } else {
      window.requestAnimationFrame(() => resolve());
    }
  });
  abortIfNeeded(signal);
}

function mmLineHeight(fontSize, multiplier = 1.42) {
  return fontSize * 0.352778 * multiplier;
}

function createCursor() {
  return {
    x: PAGE.left,
    y: PAGE.top,
    width: PAGE.width - PAGE.left - PAGE.right
  };
}

function addPage(pdf, cursor) {
  pdf.addPage();
  cursor.y = PAGE.top;
}

function ensureSpace(pdf, cursor, height) {
  if (cursor.y + height <= PAGE.height - PAGE.bottom) return false;
  addPage(pdf, cursor);
  return true;
}

function withFont(pdf, family, style, size, color = COLORS.text) {
  pdf.setFont(family, style);
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
}

function splitToLines(pdf, text, width) {
  return pdf.splitTextToSize(String(text || ''), width);
}

function writeWrappedParagraph(pdf, cursor, text, options = {}) {
  const {
    font = 'helvetica',
    style = 'normal',
    size = 11,
    color = COLORS.text,
    after = 4.6,
    width = cursor.width,
    x = cursor.x
  } = options;

  const lineHeight = mmLineHeight(size, 1.5);
  const lines = splitToLines(pdf, text, width);

  withFont(pdf, font, style, size, color);

  let index = 0;
  while (index < lines.length) {
    const availableHeight = PAGE.height - PAGE.bottom - cursor.y;
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
    const chunk = lines.slice(index, index + maxLines);
    pdf.text(chunk, x, cursor.y);
    cursor.y += chunk.length * lineHeight;
    index += chunk.length;

    if (index < lines.length) {
      addPage(pdf, cursor);
    }
  }

  cursor.y += after;
}

function drawRule(pdf, cursor) {
  ensureSpace(pdf, cursor, 6);
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.45);
  pdf.line(PAGE.left, cursor.y + 1.5, PAGE.width - PAGE.right, cursor.y + 1.5);
  cursor.y += 5;
}

function drawHeading(pdf, cursor, block, destinations, topicId) {
  const config = {
    1: { size: 22, after: 6.5 },
    2: { size: 17, after: 5.2 },
    3: { size: 13.5, after: 4.4 },
    4: { size: 11.8, after: 3.8 }
  }[block.level] || { size: 11.8, after: 3.8 };

  const lineHeight = mmLineHeight(config.size, 1.25);
  const lines = splitToLines(pdf, block.text, cursor.width);
  ensureSpace(pdf, cursor, Math.max(12, lines.length * lineHeight + 4));

  destinations.set(`heading:${topicId}:${block.id}`, {
    page: pdf.getNumberOfPages(),
    top: cursor.y - 2
  });

  withFont(pdf, 'helvetica', 'bold', config.size, COLORS.text);
  pdf.text(lines, cursor.x, cursor.y);
  cursor.y += lines.length * lineHeight + config.after;
}

function drawList(pdf, cursor, block) {
  const baseSize = 11;
  const lineHeight = mmLineHeight(baseSize, 1.48);
  const bulletWidth = 7;
  const textWidth = cursor.width - bulletWidth;

  withFont(pdf, 'helvetica', 'normal', baseSize, COLORS.text);

  block.items.forEach((item, index) => {
    const marker = block.ordered ? `${(block.start || 1) + index}.` : '•';
    const lines = splitToLines(pdf, item, textWidth);
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      ensureSpace(pdf, cursor, lineHeight + 1);
      if (lineIndex === 0) {
        pdf.text(marker, cursor.x, cursor.y);
      }

      const availableHeight = PAGE.height - PAGE.bottom - cursor.y;
      const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
      const chunk = lines.slice(lineIndex, lineIndex + maxLines);
      pdf.text(chunk, cursor.x + bulletWidth, cursor.y);
      cursor.y += chunk.length * lineHeight;
      lineIndex += chunk.length;

      if (lineIndex < lines.length) {
        addPage(pdf, cursor);
      }
    }

    cursor.y += 1.3;
  });

  cursor.y += 2.8;
}

function drawQuote(pdf, cursor, block) {
  const fontSize = 10.5;
  const lineHeight = mmLineHeight(fontSize, 1.55);
  const paddingX = 4;
  const paddingY = 3.4;
  const lines = splitToLines(pdf, block.text, cursor.width - paddingX * 2 - 3);
  let index = 0;
  let firstChunk = true;

  while (index < lines.length) {
    const minHeight = lineHeight * 3 + paddingY * 2;
    ensureSpace(pdf, cursor, minHeight);
    const availableHeight = PAGE.height - PAGE.bottom - cursor.y;
    const maxLines = Math.max(1, Math.floor((availableHeight - paddingY * 2) / lineHeight));
    const chunk = lines.slice(index, index + maxLines);
    const boxHeight = chunk.length * lineHeight + paddingY * 2;

    pdf.setFillColor(...COLORS.quoteBg);
    pdf.setDrawColor(...COLORS.quoteBorder);
    pdf.roundedRect(cursor.x, cursor.y, cursor.width, boxHeight, 3, 3, 'FD');
    pdf.setFillColor(...COLORS.quoteBorder);
    pdf.rect(cursor.x, cursor.y, 1.8, boxHeight, 'F');
    withFont(pdf, 'helvetica', 'italic', fontSize, COLORS.text);
    pdf.text(chunk, cursor.x + paddingX + 1.2, cursor.y + paddingY + lineHeight * 0.76);

    cursor.y += boxHeight + 4.6;
    index += chunk.length;
    if (index < lines.length) {
      addPage(pdf, cursor);
      firstChunk = false;
    }
  }
}

function codeHeaderLabel(block, continued = false) {
  const base = block.type === 'diagram'
    ? 'Mermaid diagram fallback'
    : `${block.language || 'text'} code`;
  return continued ? `${base} (continued)` : base;
}

function drawCodeLikeBlock(pdf, cursor, block) {
  const fontSize = 9.4;
  const lineHeight = mmLineHeight(fontSize, 1.35);
  const headerHeight = 8;
  const paddingX = 4;
  const paddingY = 3;
  const bodyWidth = cursor.width - paddingX * 2;
  const physicalLines = String(block.text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((line) => {
      const wrapped = splitToLines(pdf, line || ' ', bodyWidth);
      return wrapped.length ? wrapped : [' '];
    });

  let index = 0;
  let continued = false;

  while (index < physicalLines.length) {
    ensureSpace(pdf, cursor, headerHeight + paddingY * 2 + lineHeight * 4);
    const availableHeight = PAGE.height - PAGE.bottom - cursor.y;
    const maxLines = Math.max(
      1,
      Math.floor((availableHeight - headerHeight - paddingY * 2) / lineHeight)
    );
    const chunk = physicalLines.slice(index, index + maxLines);
    const boxHeight = headerHeight + paddingY * 2 + chunk.length * lineHeight;

    pdf.setFillColor(...COLORS.codeBg);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(cursor.x, cursor.y, cursor.width, boxHeight, 3, 3, 'FD');
    pdf.setFillColor(...COLORS.codeTop);
    pdf.roundedRect(cursor.x, cursor.y, cursor.width, headerHeight, 3, 3, 'F');

    withFont(pdf, 'helvetica', 'bold', 10, COLORS.accent);
    pdf.text(codeHeaderLabel(block, continued), cursor.x + 3.2, cursor.y + 5.3);

    withFont(pdf, 'courier', 'normal', fontSize, COLORS.text);
    pdf.text(chunk, cursor.x + paddingX, cursor.y + headerHeight + paddingY + lineHeight * 0.7);

    cursor.y += boxHeight + 4.8;
    index += chunk.length;
    continued = true;

    if (index < physicalLines.length) {
      addPage(pdf, cursor);
    }
  }
}

function drawTable(pdf, cursor, block) {
  const fontSize = 10;
  const lineHeight = mmLineHeight(fontSize, 1.35);
  const columns = Math.max(1, block.header.length);
  const colWidth = cursor.width / columns;
  const rows = [block.header, ...(block.rows || [])];

  const drawRow = (cells, isHeader = false) => {
    const paddedWidth = colWidth - 4;
    const cellLines = cells.map((cell) => splitToLines(pdf, cell || ' ', paddedWidth));
    const rowHeight = Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + 4;
    ensureSpace(pdf, cursor, rowHeight + 0.5);

    cellLines.forEach((lines, columnIndex) => {
      const x = cursor.x + columnIndex * colWidth;
      pdf.setFillColor(...(isHeader ? COLORS.tableHead : COLORS.tableRow));
      pdf.setDrawColor(...COLORS.border);
      pdf.rect(x, cursor.y, colWidth, rowHeight, 'FD');
      withFont(pdf, 'helvetica', isHeader ? 'bold' : 'normal', fontSize, COLORS.text);
      pdf.text(lines, x + 2, cursor.y + 3 + lineHeight * 0.68);
    });

    cursor.y += rowHeight;
  };

  drawRow(rows[0], true);
  rows.slice(1).forEach((row) => drawRow(row, false));
  cursor.y += 4.8;
}

function drawFigure(pdf, cursor, block) {
  const lines = [
    `Image reference: ${block.alt || 'Image'}`,
    ...(block.src ? [block.src] : [])
  ];
  const fontSize = 10.2;
  const lineHeight = mmLineHeight(fontSize, 1.42);
  const boxHeight = lines.length * lineHeight + 7;
  ensureSpace(pdf, cursor, boxHeight);
  pdf.setFillColor(...COLORS.accentSoft);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(cursor.x, cursor.y, cursor.width, boxHeight, 3, 3, 'FD');
  withFont(pdf, 'helvetica', 'bold', fontSize, COLORS.text);
  pdf.text(lines[0], cursor.x + 3.2, cursor.y + 4.6);
  if (lines[1]) {
    withFont(pdf, 'helvetica', 'normal', 9.4, COLORS.muted);
    pdf.text(splitToLines(pdf, lines[1], cursor.width - 6), cursor.x + 3.2, cursor.y + 4.6 + lineHeight);
  }
  cursor.y += boxHeight + 4.6;
}

function drawDocumentHeader(pdf, cursor, document, destinations) {
  ensureSpace(pdf, cursor, 46);
  destinations.set(`topic:${document.topicId}`, {
    page: pdf.getNumberOfPages(),
    top: cursor.y - 2
  });

  withFont(pdf, 'helvetica', 'bold', 10, COLORS.accent);
  pdf.text(document.topicGroup || document.domain || 'Reference', cursor.x, cursor.y);
  cursor.y += 7;

  withFont(pdf, 'helvetica', 'bold', 21, COLORS.text);
  const titleLines = splitToLines(pdf, document.topicTitle, cursor.width);
  pdf.text(titleLines, cursor.x, cursor.y);
  cursor.y += titleLines.length * mmLineHeight(21, 1.15) + 2.5;

  if (document.summary) {
    writeWrappedParagraph(pdf, cursor, document.summary, {
      size: 11,
      color: COLORS.muted,
      after: 4
    });
  }

  const metaBits = [
    `Domain: ${document.domain || document.topicGroup}`,
    `Mode: ${document.includeFullTopic ? 'Full topic export' : 'Selected sections only'}`,
    document.tocEntries?.length ? `Sections: ${document.tocEntries.length}` : 'Topic-level export'
  ];
  withFont(pdf, 'helvetica', 'normal', 9.8, COLORS.muted);
  pdf.text(metaBits.join('  •  '), cursor.x, cursor.y);
  cursor.y += 6.2;

  if (document.sourceFiles?.length) {
    writeWrappedParagraph(pdf, cursor, `Source files: ${document.sourceFiles.join(', ')}`, {
      size: 9.2,
      color: COLORS.muted,
      after: 4.6
    });
  }

  drawRule(pdf, cursor);
}

async function renderDocument(pdf, cursor, document, destinations, options = {}) {
  const { signal } = options;
  drawDocumentHeader(pdf, cursor, document, destinations);

  for (let index = 0; index < document.blocks.length; index += 1) {
    abortIfNeeded(signal);
    const block = document.blocks[index];

    switch (block.type) {
      case 'heading':
        drawHeading(pdf, cursor, block, destinations, document.topicId);
        break;
      case 'paragraph':
        writeWrappedParagraph(pdf, cursor, block.text);
        break;
      case 'list':
        drawList(pdf, cursor, block);
        break;
      case 'blockquote':
        drawQuote(pdf, cursor, block);
        break;
      case 'table':
        drawTable(pdf, cursor, block);
        break;
      case 'code':
      case 'diagram':
        drawCodeLikeBlock(pdf, cursor, block);
        break;
      case 'rule':
        drawRule(pdf, cursor);
        break;
      case 'figure':
        drawFigure(pdf, cursor, block);
        break;
      default:
        writeWrappedParagraph(pdf, cursor, block.text || '');
    }

    if (index > 0 && index % 8 === 0) {
      await cooperativeYield(signal);
    }
  }
}

function renderCover(pdf, plan, timestamp) {
  const cursor = createCursor();
  pdf.setFillColor(...COLORS.accentSoft);
  pdf.roundedRect(PAGE.left, PAGE.top, PAGE.width - PAGE.left - PAGE.right, 56, 6, 6, 'F');

  withFont(pdf, 'helvetica', 'bold', 11, COLORS.accent);
  pdf.text('Technical Notes Cookbook', cursor.x + 3, cursor.y + 9);

  withFont(pdf, 'helvetica', 'bold', 26, COLORS.text);
  pdf.text(splitToLines(pdf, 'Selected Technical Notes Export', cursor.width - 10), cursor.x + 3, cursor.y + 24);

  withFont(pdf, 'helvetica', 'normal', 12, COLORS.muted);
  pdf.text(
    splitToLines(
      pdf,
      `${plan.summaryText}. Generated from the current curated notes dataset with worker-prepared chapters and incremental PDF rendering.`,
      cursor.width - 10
    ),
    cursor.x + 3,
    cursor.y + 39
  );

  cursor.y = 92;
  const cards = [
    ['Scope', plan.scopeLabel],
    ['Generated', timestamp],
    ['Topics', String(plan.selectedTopicCount)],
    ['Sections', String(plan.selectedSectionCount)]
  ];

  cards.forEach(([label, value], index) => {
    const cardX = PAGE.left + (index % 2) * ((cursor.width - 6) / 2 + 6);
    const cardY = cursor.y + Math.floor(index / 2) * 30;
    const cardWidth = (cursor.width - 6) / 2;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(cardX, cardY, cardWidth, 24, 4, 4, 'FD');
    withFont(pdf, 'helvetica', 'bold', 9.2, COLORS.accent);
    pdf.text(label, cardX + 3, cardY + 6.5);
    withFont(pdf, 'helvetica', 'bold', 12.5, COLORS.text);
    pdf.text(splitToLines(pdf, value, cardWidth - 6), cardX + 3, cardY + 15);
  });
}

function reserveTocPages(pdf, documents) {
  const lineBudget = documents.reduce(
    (sum, document) => sum + 1 + (document.tocEntries?.length || 0),
    0
  );
  const tocPageCount = Math.max(1, Math.ceil((lineBudget + 10) / 28));
  const tocStartPage = 2;

  for (let index = 0; index < tocPageCount; index += 1) {
    pdf.addPage();
  }

  return { tocStartPage, tocPageCount };
}

function renderSummaryAndToc(pdf, plan, destinations, tocStartPage, tocPageCount) {
  const entries = [];
  plan.documents.forEach((document) => {
    entries.push({
      label: document.topicTitle,
      level: 1,
      key: `topic:${document.topicId}`
    });

    (document.tocEntries || []).forEach((section) => {
      entries.push({
        label: section.title,
        level: section.level,
        key: `heading:${document.topicId}:${section.id}`
      });
    });
  });

  let page = tocStartPage;
  let y = PAGE.top;

  for (let offset = 0; offset < tocPageCount; offset += 1) {
    pdf.setPage(page + offset);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, PAGE.width, PAGE.height, 'F');
  }

  pdf.setPage(tocStartPage);
  withFont(pdf, 'helvetica', 'bold', 18, COLORS.text);
  pdf.text('Export Summary', PAGE.left, y);
  y += 9;
  const summaryFontSize = 10.8;
  const summaryLineHeight = mmLineHeight(summaryFontSize, 1.5);
  const summaryLines = splitToLines(
    pdf,
    'This document includes only the currently selected notes and sections. Interactive app controls, sidebars, buttons, Monaco editor UI, and live navigation panels are excluded from the export.',
    PAGE.width - PAGE.left - PAGE.right
  );
  withFont(pdf, 'helvetica', 'normal', summaryFontSize, COLORS.muted);
  pdf.text(summaryLines, PAGE.left, y);
  y += summaryLines.length * summaryLineHeight + 6;

  const summaryCards = [
    ['Selection scope', plan.scopeLabel],
    ['Included content', plan.summaryText]
  ];

  summaryCards.forEach(([label, value], index) => {
    const cardWidth = (PAGE.width - PAGE.left - PAGE.right - 6) / 2;
    const cardX = PAGE.left + index * (cardWidth + 6);
    pdf.setFillColor(...COLORS.accentSoft);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(cardX, y, cardWidth, 24, 4, 4, 'FD');
    withFont(pdf, 'helvetica', 'bold', 9, COLORS.accent);
    pdf.text(label, cardX + 3, y + 6.5);
    withFont(pdf, 'helvetica', 'normal', 10.5, COLORS.text);
    pdf.text(splitToLines(pdf, value, cardWidth - 6), cardX + 3, y + 14);
  });
  y += 33;

  withFont(pdf, 'helvetica', 'bold', 16, COLORS.text);
  pdf.text('Table of Contents', PAGE.left, y);
  y += 8;

  entries.forEach((entry, index) => {
    const destination = destinations.get(entry.key);
    if (!destination) return;

    const fontSize = entry.level <= 1 ? 11.2 : entry.level === 2 ? 10.2 : 9.6;
    const indent = entry.level <= 1 ? 0 : entry.level === 2 ? 8 : entry.level === 3 ? 14 : 20;
    const availableWidth = PAGE.width - PAGE.left - PAGE.right - indent - 18;
    const lines = splitToLines(pdf, entry.label, availableWidth);
    const lineHeight = mmLineHeight(fontSize, 1.32);
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight) + 1.4;

    if (y + blockHeight > PAGE.height - PAGE.bottom) {
      page += 1;
      pdf.setPage(page);
      y = PAGE.top;
    }

    withFont(pdf, 'helvetica', entry.level <= 1 ? 'bold' : 'normal', fontSize, COLORS.text);
    const x = PAGE.left + indent;
    pdf.text(lines, x, y);
    const pageLabel = String(destination.page);
    const pageWidth = pdf.getTextWidth(pageLabel);
    pdf.text(pageLabel, PAGE.width - PAGE.right - pageWidth, y);
    pdf.setDrawColor(...COLORS.border);
    pdf.setLineWidth(0.15);
    pdf.line(x, y + 1.8, PAGE.width - PAGE.right - pageWidth - 2, y + 1.8);
    pdf.link(x, y - lineHeight + 1, PAGE.width - PAGE.left - PAGE.right, blockHeight, {
      pageNumber: destination.page,
      top: Math.max(0, destination.top)
    });

    y += blockHeight;
  });
}

function addPageNumbers(pdf) {
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    withFont(pdf, 'helvetica', 'normal', 9, COLORS.muted);
    pdf.text(`Page ${page} of ${totalPages}`, PAGE.width - PAGE.right, PAGE.height - 7, {
      align: 'right'
    });
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportPreparedPlanToPdf(preparedPlan, filename = 'notes.pdf', options = {}) {
  if (!preparedPlan?.documents?.length) {
    throw new Error('No selected documents were available for export.');
  }

  const {
    signal,
    onStage,
    onProgress,
    generatedAt
  } = options;

  abortIfNeeded(signal);
  report(onStage, 'Rendering cover and summary');
  report(onProgress, 44);

  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
    putOnlyUsedFonts: true
  });
  pdf.setProperties({
    title: 'Technical Notes Cookbook Export',
    subject: preparedPlan.scopeLabel,
    creator: 'Technical Notes Web App'
  });

  const destinations = new Map();
  renderCover(pdf, preparedPlan, generatedAt || new Date().toISOString());
  const { tocStartPage, tocPageCount } = reserveTocPages(pdf, preparedPlan.documents);

  pdf.addPage();
  const cursor = createCursor();

  for (let index = 0; index < preparedPlan.documents.length; index += 1) {
    abortIfNeeded(signal);
    const document = preparedPlan.documents[index];
    if (index > 0) {
      addPage(pdf, cursor);
    }

    report(onStage, `Rendering chapter ${index + 1} of ${preparedPlan.documents.length}: ${document.topicTitle}`);
    report(onProgress, 48 + Math.round(((index + 1) / preparedPlan.documents.length) * 40));
    await renderDocument(pdf, cursor, document, destinations, { signal });
    await cooperativeYield(signal);
  }

  report(onStage, 'Generating table of contents');
  report(onProgress, 92);
  renderSummaryAndToc(pdf, preparedPlan, destinations, tocStartPage, tocPageCount);

  report(onStage, 'Finalizing download');
  report(onProgress, 97);
  addPageNumbers(pdf);
  await cooperativeYield(signal);
  abortIfNeeded(signal);

  const blob = pdf.output('blob');
  downloadBlob(blob, filename);
  report(onProgress, 100);
}

export async function exportElementToPdf(element, filename = 'notes.pdf', options = {}) {
  if (!element) throw new Error('Export element was not found.');

  const {
    onStage,
    onProgress,
    signal
  } = options;

  abortIfNeeded(signal);
  report(onStage, 'Preparing legacy export');
  report(onProgress, 12);

  const { default: html2pdf } = await import('html2pdf.js');
  const clone = element.cloneNode(true);
  clone.classList.add('pdf-export-mode');
  clone.style.width = '794px';
  clone.style.maxWidth = '794px';
  clone.style.padding = '36px';
  clone.style.background = '#ffffff';
  clone.style.color = '#111827';

  const scratch = document.createElement('div');
  scratch.style.position = 'fixed';
  scratch.style.left = '-99999px';
  scratch.style.top = '0';
  scratch.style.background = '#ffffff';
  scratch.appendChild(clone);
  document.body.appendChild(scratch);

  try {
    await cooperativeYield(signal);
    abortIfNeeded(signal);
    report(onStage, 'Creating PDF');
    report(onProgress, 58);

    const worker = html2pdf().set({
      margin: [12, 12, 14, 12],
      enableLinks: true,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.pdf-page-break' },
      filename
    }).from(clone);

    await worker.toPdf();
    const legacyPdf = await worker.get('pdf');
    const totalPages = legacyPdf.internal.getNumberOfPages();
    const pageWidth = legacyPdf.internal.pageSize.getWidth();
    const pageHeight = legacyPdf.internal.pageSize.getHeight();

    for (let page = 1; page <= totalPages; page += 1) {
      legacyPdf.setPage(page);
      legacyPdf.setFont('helvetica', 'normal');
      legacyPdf.setFontSize(9);
      legacyPdf.setTextColor(100, 116, 139);
      legacyPdf.text(`Page ${page} of ${totalPages}`, pageWidth - 18, pageHeight - 7, { align: 'right' });
    }

    abortIfNeeded(signal);
    await worker.save();
    report(onProgress, 100);
  } finally {
    document.body.removeChild(scratch);
  }
}
