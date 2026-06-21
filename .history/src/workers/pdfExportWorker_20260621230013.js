import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import { normalizeCodeFenceContent, slugify } from '../utils/text.js';

const PAGE = {
  width: 210,
  height: 297,
  left: 16,
  right: 16,
  top: 19,
  bottom: 19
};

const CONTENT_WIDTH = PAGE.width - PAGE.left - PAGE.right;
const PAGE_BOTTOM = PAGE.height - PAGE.bottom;

const COLORS = {
  text: [15, 23, 42],
  muted: [100, 116, 139],
  faint: [148, 163, 184],
  accent: [37, 99, 235],
  accentDark: [30, 64, 175],
  accentSoft: [219, 234, 254],
  accentSofter: [239, 246, 255],
  border: [191, 219, 254],
  borderSoft: [226, 232, 240],
  white: [255, 255, 255],
  codeBg: [15, 23, 42],
  codeTop: [30, 41, 59],
  codeText: [226, 232, 240],
  codeLineNo: [148, 163, 184],
  codeComment: [125, 211, 252],
  codeKeyword: [147, 197, 253],
  codeString: [253, 224, 71],
  codeNumber: [196, 181, 253],
  codeFunction: [134, 239, 172],
  codeOperator: [252, 165, 165],
  codePunctuation: [203, 213, 225],
  codeProperty: [249, 168, 212],
  quoteBg: [239, 246, 255],
  quoteBorder: [96, 165, 250],
  tableHead: [219, 234, 254],
  tableOdd: [255, 255, 255],
  tableEven: [248, 250, 252]
};

const JS_KEYWORDS = [
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import',
  'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield', 'true', 'false', 'null'
];
const PY_KEYWORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
  'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'
];
const SQL_KEYWORDS = [
  'select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer', 'full', 'on', 'group', 'by',
  'order', 'having', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'alter', 'drop',
  'table', 'view', 'index', 'primary', 'key', 'foreign', 'references', 'constraint', 'and', 'or', 'not',
  'null', 'is', 'as', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'distinct', 'union'
];
const SHELL_KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac', 'while', 'function', 'sudo', 'export'];
const YAML_KEYWORDS = ['true', 'false', 'null', 'yes', 'no', 'on', 'off'];
const HCL_KEYWORDS = ['resource', 'variable', 'provider', 'module', 'output', 'locals', 'data', 'terraform', 'true', 'false', 'null'];
const DOCKER_KEYWORDS = ['from', 'run', 'cmd', 'label', 'maintainer', 'expose', 'env', 'add', 'copy', 'entrypoint', 'volume', 'user', 'workdir', 'arg', 'onbuild', 'stopsignal', 'healthcheck', 'shell'];

const KEYWORDS_BY_LANG = {
  javascript: JS_KEYWORDS,
  js: JS_KEYWORDS,
  jsx: JS_KEYWORDS,
  typescript: JS_KEYWORDS,
  ts: JS_KEYWORDS,
  tsx: JS_KEYWORDS,
  python: PY_KEYWORDS,
  py: PY_KEYWORDS,
  sql: SQL_KEYWORDS,
  bash: SHELL_KEYWORDS,
  shell: SHELL_KEYWORDS,
  sh: SHELL_KEYWORDS,
  yaml: YAML_KEYWORDS,
  yml: YAML_KEYWORDS,
  terraform: HCL_KEYWORDS,
  hcl: HCL_KEYWORDS,
  dockerfile: DOCKER_KEYWORDS,
  docker: DOCKER_KEYWORDS,
  json: ['true', 'false', 'null']
};

let activeTaskId = '';

function post(type, payload = {}, transfer = undefined) {
  self.postMessage({ type, taskId: activeTaskId, ...payload }, transfer || []);
}

function progress(stage, value, status = 'rendering') {
  post('progress', {
    status,
    stage,
    progress: Math.max(0, Math.min(100, Math.round(value)))
  });
}

function mmLineHeight(fontSize, multiplier = 1.42) {
  return fontSize * 0.352778 * multiplier;
}

function createCursor() {
  return { x: PAGE.left, y: PAGE.top, width: CONTENT_WIDTH };
}

function addPage(pdf, cursor) {
  pdf.addPage();
  cursor.x = PAGE.left;
  cursor.y = PAGE.top;
  cursor.width = CONTENT_WIDTH;
}

function ensureSpace(pdf, cursor, height) {
  const safeHeight = Math.max(0, Number(height) || 0);
  if (cursor.y + safeHeight <= PAGE_BOTTOM) return false;
  addPage(pdf, cursor);
  return true;
}


function withFont(pdf, family, style, size, color = COLORS.text) {
  pdf.setFont(family, style);
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
}

function breakLongWordsForPdf(pdf, text, width) {
  const maxWidth = Math.max(8, width);
  const parts = normalizePdfText(text).split(/(\s+)/);

  return parts.map((part) => {
    if (!part || /\s+/.test(part) || pdf.getTextWidth(part) <= maxWidth) return part;

    const chunks = [];
    let current = '';
    Array.from(part).forEach((char) => {
      const next = `${current}${char}`;
      if (current && pdf.getTextWidth(next) > maxWidth) {
        chunks.push(current);
        current = char;
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks.join(' ');
  }).join('');
}

function splitToLines(pdf, text, width) {
  const safeWidth = Math.max(8, Number(width) || 8);
  const normalized = normalizePdfText(text || ' ').replace(/[ \t]+/g, ' ').trim() || ' ';
  const sourceLines = normalized.split('\n');
  const lines = [];

  sourceLines.forEach((sourceLine) => {
    const words = String(sourceLine || ' ').split(/(\s+)/).filter(Boolean);
    let current = '';

    const flush = () => {
      if (current) {
        lines.push(current.trimEnd());
        current = '';
      }
    };

    words.forEach((word) => {
      if (!word) return;
      const normalizedWord = /\s+/.test(word) ? ' ' : word;
      if (!current && normalizedWord === ' ') return;
      const candidate = `${current}${normalizedWord}`;
      if (pdf.getTextWidth(candidate) <= safeWidth) {
        current = candidate;
        return;
      }

      flush();
      if (normalizedWord === ' ') return;
      if (pdf.getTextWidth(normalizedWord) <= safeWidth) {
        current = normalizedWord;
        return;
      }

      let chunk = '';
      Array.from(normalizedWord).forEach((char) => {
        const next = `${chunk}${char}`;
        if (chunk && pdf.getTextWidth(next) > safeWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = next;
        }
      });
      current = chunk;
    });

    flush();
    if (!words.length) lines.push(' ');
  });

  return lines.length ? lines : [' '];
}

function parseInlineCodeSegments(value = '') {
  const text = normalizePdfText(value || '');
  const segments = [];
  let cursor = 0;
  const regex = /`([^`\n]+)`/g;
  let match;

  while ((match = regex.exec(text))) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), code: false });
    if (match[1]) segments.push({ text: match[1], code: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), code: false });
  return segments.length ? segments : [{ text, code: false }];
}

function measureInlineSegment(pdf, segment, fontSize, baseStyle = 'normal') {
  if (!segment?.text) return 0;
  if (segment.code) {
    withFont(pdf, 'courier', 'normal', Math.max(6.8, fontSize * 0.9), COLORS.accentDark);
    return pdf.getTextWidth(segment.text) + 2.4;
  }
  withFont(pdf, 'helvetica', baseStyle, fontSize, COLORS.text);
  return pdf.getTextWidth(segment.text);
}

function splitInlineSegmentToFit(pdf, segment, maxWidth, fontSize, baseStyle = 'normal') {
  const pieces = [];
  let current = '';
  Array.from(segment.text || '').forEach((char) => {
    const next = `${current}${char}`;
    if (current && measureInlineSegment(pdf, { ...segment, text: next }, fontSize, baseStyle) > maxWidth) {
      pieces.push({ ...segment, text: current });
      current = char;
    } else {
      current = next;
    }
  });
  if (current) pieces.push({ ...segment, text: current });
  return pieces.length ? pieces : [{ ...segment, text: ' ' }];
}

function mergeInlineSegments(segments) {
  return segments.reduce((acc, segment) => {
    if (!segment?.text) return acc;
    const previous = acc[acc.length - 1];
    if (previous && previous.code === segment.code) {
      previous.text += segment.text;
    } else {
      acc.push({ ...segment });
    }
    return acc;
  }, []);
}

function wrapInlineText(pdf, text, maxWidth, fontSize = 10.8, baseStyle = 'normal') {
  const safeWidth = Math.max(8, Number(maxWidth) || 8);
  const tokens = [];

  parseInlineCodeSegments(text).forEach((segment) => {
    if (segment.code) {
      tokens.push(segment);
      return;
    }
    String(segment.text || '').split(/(\s+)/).forEach((part) => {
      if (!part) return;
      tokens.push({ text: /\s+/.test(part) ? ' ' : part, code: false });
    });
  });

  const lines = [];
  let line = [];
  let lineWidth = 0;

  const flush = () => {
    const cleaned = mergeInlineSegments(line).filter((segment, index) => !(index === 0 && !segment.code && /^\s+$/.test(segment.text)));
    if (cleaned.length) lines.push(cleaned);
    line = [];
    lineWidth = 0;
  };

  tokens.forEach((token) => {
    if (!token.text) return;
    if (!line.length && !token.code && /^\s+$/.test(token.text)) return;
    const tokenWidth = measureInlineSegment(pdf, token, fontSize, baseStyle);

    if (line.length && lineWidth + tokenWidth > safeWidth) flush();

    if (tokenWidth > safeWidth) {
      const pieces = splitInlineSegmentToFit(pdf, token, safeWidth, fontSize, baseStyle);
      pieces.forEach((piece) => {
        const pieceWidth = measureInlineSegment(pdf, piece, fontSize, baseStyle);
        if (line.length && lineWidth + pieceWidth > safeWidth) flush();
        line.push(piece);
        lineWidth += pieceWidth;
      });
      return;
    }

    line.push(token);
    lineWidth += tokenWidth;
  });

  flush();
  return lines.length ? lines : [[{ text: ' ', code: false }]];
}

function drawInlineLine(pdf, segments, x, baselineY, fontSize = 10.8, color = COLORS.text, baseStyle = 'normal', lineHeight = mmLineHeight(fontSize, 1.55)) {
  let currentX = x;
  segments.forEach((segment) => {
    if (!segment?.text) return;

    if (segment.code) {
      const codeSize = Math.max(6.8, fontSize * 0.9);
      withFont(pdf, 'courier', 'normal', codeSize, COLORS.accentDark);
      const textWidth = pdf.getTextWidth(segment.text);
      const pillHeight = Math.max(4.2, lineHeight * 0.82);
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(...COLORS.border);
      pdf.roundedRect(currentX - 0.4, baselineY - pillHeight + 1.05, textWidth + 2.0, pillHeight, 1.1, 1.1, 'FD');
      pdf.text(segment.text, currentX + 0.6, baselineY);
      currentX += textWidth + 2.4;
      return;
    }

    withFont(pdf, 'helvetica', baseStyle, fontSize, color);
    pdf.text(segment.text, currentX, baselineY);
    currentX += pdf.getTextWidth(segment.text);
  });
}


function reportYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function inlineText(tokens = []) {
  return tokens.map((token) => {
    if (!token) return '';

    switch (token.type) {
      case 'text':
        return token.tokens ? inlineText(token.tokens) : (token.text || '');
      case 'strong':
      case 'em':
      case 'del':
        return inlineText(token.tokens || []);
      case 'codespan':
        return `\`${token.text || ''}\``;
      case 'link': {
        const label = inlineText(token.tokens || []) || token.text || token.href || '';
        return token.href ? `${label} (${token.href})` : label;
      }
      case 'image':
        return `[Image: ${token.text || 'image'}]${token.href ? ` ${token.href}` : ''}`;
      case 'br':
        return '\n';
      default:
        return token.tokens ? inlineText(token.tokens) : (token.text || '');
    }
  }).join('');
}

function blockText(tokens = []) {
  return tokens
    .map((token) => {
      if (!token) return '';

      switch (token.type) {
        case 'paragraph':
          return inlineText(token.tokens || []);
        case 'list':
          return token.items
            ?.map((item, index) => {
              const prefix = token.ordered ? `${(token.start || 1) + index}. ` : '• ';
              return `${prefix}${inlineText(item.tokens || [])}`;
            })
            .join('\n') || '';
        case 'blockquote':
          return blockText(token.tokens || []);
        case 'heading':
          return inlineText(token.tokens || []);
        case 'code':
          return normalizeCodeFenceContent(token.text || '', token.lang || '');
        case 'hr':
          return '---';
        default:
          return token.tokens ? inlineText(token.tokens) : (token.text || token.raw || '');
      }
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function headingIdFactory(topicId = '') {
  const used = new Map();
  return (text = '') => {
    const base = slugify(text) || 'section';
    const scopedBase = `${topicId}-${base}`;
    const count = used.get(scopedBase) || 0;
    used.set(scopedBase, count + 1);
    return count === 0 ? scopedBase : `${scopedBase}-${count + 1}`;
  };
}

function maybeImageBlock(token) {
  if (token?.type !== 'paragraph') return null;
  if (!Array.isArray(token.tokens) || token.tokens.length !== 1) return null;
  const image = token.tokens[0];
  if (image?.type !== 'image') return null;
  return { type: 'figure', alt: image.text || 'Image reference', src: image.href || '' };
}

function normalizePdfText(value = '') {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[→⇒⟶⟹]/g, '->')
    .replace(/[←⇐⟵⟸]/g, '<-')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[×]/g, 'x')
    .replace(/[÷]/g, '/')
    .replace(/[✓✔]/g, 'check')
    .replace(/[✗✘]/g, 'x')
    .replace(/[•·]/g, '-')
    .replace(/\b(?:[A-Za-z]\s){4,}[A-Za-z]\b/g, (match) => match.replace(/\s+/g, ''))
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
}

function sanitizeText(value = '') {
  return normalizePdfText(value)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}


function prepareDocument(document) {
  const tokens = marked.lexer(document.markdown || '', { gfm: true, breaks: false });
  const blocks = [];
  const tocEntries = [];
  const nextHeadingId = headingIdFactory(document.topicId);

  tokens.forEach((token, index) => {
    if (!token || token.type === 'space') return;

    if (
      token.type === 'heading'
      && token.depth === 1
      && index === 0
      && String(token.text || '').trim().toLowerCase() === String(document.topicTitle || '').trim().toLowerCase()
    ) {
      return;
    }

    const imageBlock = maybeImageBlock(token);
    if (imageBlock) {
      blocks.push(imageBlock);
      return;
    }

    switch (token.type) {
      case 'heading': {
        const text = sanitizeText(inlineText(token.tokens || []));
        if (!text) return;
        const id = nextHeadingId(text);
        blocks.push({ type: 'heading', level: token.depth, id, text });
        if (token.depth >= 2 && token.depth <= 4) {
          tocEntries.push({ id, title: text, level: token.depth });
        }
        return;
      }
      case 'paragraph': {
        const text = sanitizeText(inlineText(token.tokens || []));
        if (text) blocks.push({ type: 'paragraph', text });
        return;
      }
      case 'blockquote': {
        const text = blockText(token.tokens || []);
        if (text) blocks.push({ type: 'blockquote', text: sanitizeText(text) });
        return;
      }
      case 'list': {
        const items = token.items?.map((item) => sanitizeText(inlineText(item.tokens || []))).filter(Boolean) || [];
        if (items.length) {
          blocks.push({ type: 'list', ordered: Boolean(token.ordered), start: Number(token.start) || 1, items });
        }
        return;
      }
      case 'table': {
        const header = (token.header || []).map((cell) => sanitizeText(inlineText(cell.tokens || [])));
        const rows = (token.rows || []).map((row) => row.map((cell) => sanitizeText(inlineText(cell.tokens || []))));
        if (header.length) blocks.push({ type: 'table', header, rows });
        return;
      }
      case 'code': {
        const language = String(token.lang || '').trim().toLowerCase();
        const text = normalizeCodeFenceContent(token.text || '', language);
        if (!text) return;
        blocks.push({ type: language === 'mermaid' ? 'diagram' : 'code', language: language || 'text', text });
        return;
      }
      case 'hr':
        blocks.push({ type: 'rule' });
        return;
      default: {
        const text = sanitizeText(blockText([token]));
        if (text) blocks.push({ type: 'paragraph', text });
      }
    }
  });

  return { ...document, blocks, tocEntries };
}

function writeWrappedParagraph(pdf, cursor, text, options = {}) {
  const {
    font = 'helvetica',
    style = 'normal',
    size = 10.8,
    color = COLORS.text,
    after = 4.6,
    width = cursor.width,
    x = cursor.x
  } = options;

  const lineHeight = mmLineHeight(size, 1.5);
  const lines = wrapInlineText(pdf, text, width, size, style);

  let index = 0;
  while (index < lines.length) {
    if (PAGE_BOTTOM - cursor.y < lineHeight + 1) addPage(pdf, cursor);
    const availableHeight = Math.max(lineHeight, PAGE_BOTTOM - cursor.y - 1);
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
    const chunk = lines.slice(index, index + maxLines);
    chunk.forEach((line, offset) => {
      drawInlineLine(pdf, line, x, cursor.y + offset * lineHeight, size, color, style, lineHeight);
    });
    cursor.y += chunk.length * lineHeight;
    index += chunk.length;
    if (index < lines.length) addPage(pdf, cursor);
  }
  cursor.y += after;
  if (cursor.y > PAGE_BOTTOM) addPage(pdf, cursor);
} {
  const {
    font = 'helvetica',
    style = 'normal',
    size = 10.8,
    color = COLORS.text,
    after = 5.6,
    width = cursor.width,
    x = cursor.x
  } = options;

  const lineHeight = mmLineHeight(size, 1.55);
  const lines = splitToLines(pdf, text, width);
  withFont(pdf, font, style, size, color);

  let index = 0;
  while (index < lines.length) {
    if (PAGE_BOTTOM - cursor.y < lineHeight + 1) addPage(pdf, cursor);
    const availableHeight = Math.max(lineHeight, PAGE_BOTTOM - cursor.y - 1);
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
    const chunk = lines.slice(index, index + maxLines);
    chunk.forEach((line, offset) => {
      pdf.text(normalizePdfText(line), x, cursor.y + offset * lineHeight);
    });
    cursor.y += chunk.length * lineHeight;
    index += chunk.length;
    if (index < lines.length) addPage(pdf, cursor);
  }
  cursor.y += after;
  if (cursor.y > PAGE_BOTTOM) addPage(pdf, cursor);
}


function drawRule(pdf, cursor) {
  ensureSpace(pdf, cursor, 7);
  pdf.setDrawColor(...COLORS.borderSoft);
  pdf.setLineWidth(0.35);
  pdf.line(PAGE.left, cursor.y + 1.5, PAGE.width - PAGE.right, cursor.y + 1.5);
  cursor.y += 5.5;
}

function headingConfig(level) {
  return {
    1: { size: 20, after: 6.6, color: COLORS.text },
    2: { size: 15.6, after: 5.3, color: COLORS.accentDark },
    3: { size: 13.0, after: 4.7, color: COLORS.text },
    4: { size: 11.4, after: 4.0, color: COLORS.muted }
  }[level] || { size: 11.4, after: 4.0, color: COLORS.muted };
}

function estimateHeadingHeight(pdf, cursor, block) {
  const config = headingConfig(block.level);
  const lineHeight = mmLineHeight(config.size, 1.25);
  const indent = block.level <= 2 ? 4 : 0;
  withFont(pdf, 'helvetica', 'bold', config.size, config.color);
  const lines = splitToLines(pdf, block.text, cursor.width - indent - 5);
  return Math.max(10, lines.length * lineHeight + config.after + 2.5);
}

function drawHeading(pdf, cursor, block, destinations, topicId) {
  const config = headingConfig(block.level);
  const lineHeight = mmLineHeight(config.size, 1.25);
  const indent = block.level <= 2 ? 4 : 0;
  withFont(pdf, 'helvetica', 'bold', config.size, config.color);
  const lines = splitToLines(pdf, block.text, cursor.width - indent - 5);
  ensureSpace(pdf, cursor, Math.max(11, lines.length * lineHeight + config.after + 2.5));

  destinations.set(`heading:${topicId}:${block.id}`, { page: pdf.getNumberOfPages(), top: cursor.y - 3 });

  if (block.level <= 2) {
    pdf.setFillColor(...COLORS.accentSoft);
    pdf.roundedRect(cursor.x - 1.5, cursor.y - 5.8, 3, 7.2, 1.2, 1.2, 'F');
  }

  withFont(pdf, 'helvetica', 'bold', config.size, config.color);
  lines.forEach((line, offset) => {
    pdf.text(normalizePdfText(line), cursor.x + indent, cursor.y + offset * lineHeight);
  });
  cursor.y += lines.length * lineHeight + config.after;
}


function drawList(pdf, cursor, block) {
  const baseSize = 10.5;
  const lineHeight = mmLineHeight(baseSize, 1.5);
  const bulletWidth = 7.8;
  const textWidth = cursor.width - bulletWidth;

  block.items.forEach((item, index) => {
    const marker = block.ordered ? `${(block.start || 1) + index}.` : '•';
    const lines = wrapInlineText(pdf, item, textWidth, baseSize, 'normal');
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      if (PAGE_BOTTOM - cursor.y < lineHeight + 1.5) addPage(pdf, cursor);
      const availableHeight = Math.max(lineHeight, PAGE_BOTTOM - cursor.y - 1.5);
      const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
      const chunk = lines.slice(lineIndex, lineIndex + maxLines);
      if (lineIndex === 0) {
        withFont(pdf, 'helvetica', 'bold', baseSize, COLORS.accent);
        pdf.text(marker, cursor.x, cursor.y);
      }
      chunk.forEach((line, offset) => {
        drawInlineLine(pdf, line, cursor.x + bulletWidth, cursor.y + offset * lineHeight, baseSize, COLORS.text, 'normal', lineHeight);
      });
      cursor.y += chunk.length * lineHeight;
      lineIndex += chunk.length;
      if (lineIndex < lines.length) addPage(pdf, cursor);
    }
    cursor.y += 1.9;
  });
  cursor.y += 3.2;
  if (cursor.y > PAGE_BOTTOM) addPage(pdf, cursor);
}


function drawQuote(pdf, cursor, block) {
  const fontSize = 10.2;
  const lineHeight = mmLineHeight(fontSize, 1.58);
  const paddingX = 5;
  const paddingY = 4;
  const after = 5.2;
  const lines = splitToLines(pdf, block.text, cursor.width - paddingX * 2 - 3);
  let index = 0;
  let continued = false;

  while (index < lines.length) {
    if (PAGE_BOTTOM - cursor.y < paddingY * 2 + lineHeight + after) addPage(pdf, cursor);
    const usableHeight = Math.max(lineHeight, PAGE_BOTTOM - cursor.y - paddingY * 2 - after);
    const maxLines = Math.max(1, Math.floor(usableHeight / lineHeight));
    const chunk = lines.slice(index, index + maxLines);
    const boxHeight = chunk.length * lineHeight + paddingY * 2;

    pdf.setFillColor(...COLORS.quoteBg);
    pdf.setDrawColor(...COLORS.quoteBorder);
    pdf.roundedRect(cursor.x, cursor.y, cursor.width, boxHeight, 3, 3, 'FD');
    pdf.setFillColor(...COLORS.quoteBorder);
    pdf.rect(cursor.x, cursor.y, 2, boxHeight, 'F');
    withFont(pdf, 'helvetica', 'italic', fontSize, COLORS.text);
    chunk.forEach((line, offset) => {
      pdf.text(normalizePdfText(line), cursor.x + paddingX + 1.4, cursor.y + paddingY + (offset + 0.82) * lineHeight);
    });
    if (continued) {
      withFont(pdf, 'helvetica', 'bold', 7.8, COLORS.muted);
      pdf.text('continued', cursor.x + cursor.width - 18, cursor.y + 4);
    }

    cursor.y += boxHeight + after;
    index += chunk.length;
    if (index < lines.length) {
      addPage(pdf, cursor);
      continued = true;
    }
  }
}


function normalizedLanguage(language = '') {
  const lang = String(language || 'text').toLowerCase().trim();
  if (lang === 'javascriptreact') return 'jsx';
  if (lang === 'typescriptreact') return 'tsx';
  if (lang === 'shellscript') return 'bash';
  if (lang === 'tf') return 'terraform';
  return lang || 'text';
}

function codeHeaderLabel(block, continued = false) {
  const base = block.type === 'diagram' ? 'Mermaid diagram fallback' : `${normalizedLanguage(block.language)} code`;
  return continued ? `${base} · continued` : base;
}

function keywordRegexFor(language) {
  const words = KEYWORDS_BY_LANG[normalizedLanguage(language)] || [];
  if (!words.length) return null;
  return new RegExp(`(?:${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'iy');
}

function tokenizeCodeLine(line = '', language = 'text') {
  const lang = normalizedLanguage(language);
  const keywordPattern = keywordRegexFor(lang);
  const patterns = [];

  if (['javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx', 'java', 'csharp', 'css', 'terraform', 'hcl'].includes(lang)) {
    patterns.push(['comment', /\/\/.*|\/\*[\s\S]*?\*\//iy]);
  }
  if (['python', 'py', 'bash', 'shell', 'sh', 'yaml', 'yml', 'dockerfile', 'docker', 'terraform', 'hcl'].includes(lang)) {
    patterns.push(['comment', /#.*/iy]);
  }
  if (lang === 'sql') patterns.push(['comment', /--.*|\/\*[\s\S]*?\*\//iy]);

  patterns.push(['string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/iy]);
  if (keywordPattern) patterns.push(['keyword', keywordPattern]);
  if (lang === 'json' || lang === 'yaml' || lang === 'yml') patterns.push(['property', /[A-Za-z_$][\w$-]*(?=\s*:)/iy]);
  patterns.push(['function', /[A-Za-z_$][\w$]*(?=\s*\()/iy]);
  patterns.push(['number', /\b(?:0x[a-f\d]+|\d+(?:\.\d+)?)(?:e[+-]?\d+)?\b/iy]);
  patterns.push(['operator', /=>|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|?:]+/iy]);
  patterns.push(['punctuation', /[{}()[\].,;]/iy]);
  patterns.push(['space', /\s+/iy]);
  patterns.push(['text', /[^\s{}()[\].,;:+\-*/%=<>!&|?"'`#]+/iy]);

  const tokens = [];
  let index = 0;

  while (index < line.length) {
    let matched = null;
    for (const [type, regex] of patterns) {
      regex.lastIndex = index;
      const match = regex.exec(line);
      if (match && match.index === index && match[0]) {
        matched = { type, text: match[0] };
        break;
      }
    }

    if (!matched) matched = { type: 'text', text: line[index] };
    tokens.push(matched);
    index += matched.text.length;
  }

  return tokens;
}

function tokenColor(type) {
  switch (type) {
    case 'comment': return COLORS.codeComment;
    case 'keyword': return COLORS.codeKeyword;
    case 'string': return COLORS.codeString;
    case 'number': return COLORS.codeNumber;
    case 'function': return COLORS.codeFunction;
    case 'operator': return COLORS.codeOperator;
    case 'punctuation': return COLORS.codePunctuation;
    case 'property': return COLORS.codeProperty;
    default: return COLORS.codeText;
  }
}

function drawCodeTokens(pdf, tokens, x, y, fontSize) {
  let currentX = x;
  tokens.forEach((token) => {
    if (!token.text) return;
    withFont(pdf, 'courier', token.type === 'keyword' || token.type === 'function' ? 'bold' : 'normal', fontSize, tokenColor(token.type));
    pdf.text(token.text, currentX, y);
    currentX += pdf.getTextWidth(token.text);
  });
}

function wrapCodeLine(pdf, line, maxWidth, fontSize) {
  withFont(pdf, 'courier', 'normal', fontSize, COLORS.codeText);
  const raw = String(line ?? '');
  if (pdf.getTextWidth(raw || ' ') <= maxWidth) return [raw || ' '];

  const chunks = [];
  let remaining = raw;
  const approximateCharWidth = Math.max(1.5, pdf.getTextWidth('M'));
  const maxChars = Math.max(18, Math.floor(maxWidth / approximateCharWidth));

  while (remaining.length) {
    let slice = remaining.slice(0, maxChars);
    while (slice.length > 8 && pdf.getTextWidth(slice) > maxWidth) {
      slice = slice.slice(0, -1);
    }

    if (slice.length < remaining.length) {
      const breakIndex = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','), slice.lastIndexOf(';'));
      if (breakIndex > 12) slice = slice.slice(0, breakIndex + 1);
    }

    chunks.push(slice || remaining[0]);
    remaining = remaining.slice((slice || remaining[0]).length);
  }

  return chunks.length ? chunks : [' '];
}

function buildDisplayCodeLines(pdf, text, bodyWidth, fontSize) {
  const lineNumberDigits = String(String(text || '').split('\n').length || 1).length;
  withFont(pdf, 'courier', 'normal', fontSize, COLORS.codeText);
  const gutterWidth = Math.max(10, lineNumberDigits * pdf.getTextWidth('0') + 5);
  const codeWidth = bodyWidth - gutterWidth;
  const rawLines = normalizePdfText(text).replace(/\r\n?/g, '\n').split('\n');
  const displayLines = [];

  rawLines.forEach((rawLine, rawIndex) => {
    const wrapped = wrapCodeLine(pdf, rawLine || ' ', codeWidth, fontSize);
    wrapped.forEach((line, wrapIndex) => {
      displayLines.push({
        text: line || ' ',
        lineNumber: wrapIndex === 0 ? String(rawIndex + 1) : '>',
        isContinuation: wrapIndex > 0
      });
    });
  });

  return { displayLines, gutterWidth, codeWidth };
}

function drawCodeLikeBlock(pdf, cursor, block) {
  const fontSize = 8.4;
  const lineHeight = mmLineHeight(fontSize, 1.42);
  const headerHeight = 8.4;
  const paddingX = 4;
  const paddingY = 3.5;
  const after = 5.5;
  const bodyWidth = cursor.width - paddingX * 2;
  const { displayLines, gutterWidth } = buildDisplayCodeLines(pdf, block.text, bodyWidth, fontSize);
  let index = 0;
  let continued = false;

  while (index < displayLines.length) {
    if (PAGE_BOTTOM - cursor.y < headerHeight + paddingY * 2 + lineHeight + after) addPage(pdf, cursor);
    const usableHeight = Math.max(lineHeight, PAGE_BOTTOM - cursor.y - headerHeight - paddingY * 2 - after);
    const maxLines = Math.max(1, Math.floor(usableHeight / lineHeight));
    const chunk = displayLines.slice(index, index + maxLines);
    const boxHeight = headerHeight + paddingY * 2 + chunk.length * lineHeight;

    pdf.setFillColor(...COLORS.codeBg);
    pdf.setDrawColor(...COLORS.codeTop);
    pdf.roundedRect(cursor.x, cursor.y, cursor.width, boxHeight, 3, 3, 'FD');
    pdf.setFillColor(...COLORS.codeTop);
    pdf.roundedRect(cursor.x, cursor.y, cursor.width, headerHeight, 3, 3, 'F');
    pdf.setFillColor(...COLORS.codeBg);
    pdf.rect(cursor.x, cursor.y + headerHeight - 2.5, cursor.width, 2.5, 'F');

    withFont(pdf, 'helvetica', 'bold', 9.2, COLORS.codeText);
    pdf.text(codeHeaderLabel(block, continued), cursor.x + 3.5, cursor.y + 5.5);

    chunk.forEach((line, lineOffset) => {
      const y = cursor.y + headerHeight + paddingY + (lineOffset + 0.8) * lineHeight;
      withFont(pdf, 'courier', 'normal', fontSize, COLORS.codeLineNo);
      pdf.text(line.lineNumber, cursor.x + paddingX, y);
      const codeX = cursor.x + paddingX + gutterWidth;
      const tokens = tokenizeCodeLine(line.text, block.language);
      drawCodeTokens(pdf, tokens, codeX, y, fontSize);
    });

    cursor.y += boxHeight + after;
    index += chunk.length;
    continued = true;
    if (index < displayLines.length) addPage(pdf, cursor);
  }
}


function computeTableColumnWidths(pdf, header, rows, totalWidth) {
  const columns = Math.max(1, header.length);
  const samples = Array.from({ length: columns }, (_, index) => [header[index] || '']);
  (rows || []).slice(0, 80).forEach((row) => {
    for (let index = 0; index < columns; index += 1) samples[index].push(row?.[index] || '');
  });

  const weights = samples.map((values) => {
    const longest = values.reduce((max, value) => Math.max(max, normalizePdfText(value).length), 0);
    return Math.max(9, Math.min(30, longest));
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || columns;
  const minWidth = Math.min(26, totalWidth / columns);
  const rawWidths = weights.map((weight) => Math.max(minWidth, totalWidth * (weight / weightTotal)));
  const rawTotal = rawWidths.reduce((sum, value) => sum + value, 0) || totalWidth;
  return rawWidths.map((width) => width * (totalWidth / rawTotal));
}

function drawTable(pdf, cursor, block) {
  const columns = Math.max(1, block.header.length);
  const fontSize = columns > 5 ? 7.3 : columns > 4 ? 7.8 : columns > 3 ? 8.35 : 8.8;
  const lineHeight = mmLineHeight(fontSize, 1.42);
  const paddingX = columns > 4 ? 1.45 : 2.0;
  const paddingY = 2.7;
  const after = 5.2;
  const colWidths = computeTableColumnWidths(pdf, block.header, block.rows || [], cursor.width);

  const normalizeRow = (cells = []) => Array.from({ length: columns }, (_, index) => sanitizeText(cells[index] || ' '));
  const prepareRow = (cells = [], isHeader = false) => normalizeRow(cells).map((cell, index) => {
    const cellWidth = Math.max(8, colWidths[index] - paddingX * 2);
    return wrapInlineText(pdf, cell || ' ', cellWidth, fontSize, isHeader ? 'bold' : 'normal');
  });
  const headerLines = prepareRow(block.header || [], true);

  const drawPreparedRowChunk = (cellLines, rowIndex, lineStart, lineEnd, isHeader = false, continued = false) => {
    const rowLines = Math.max(1, lineEnd - lineStart);
    const rowHeight = rowLines * lineHeight + paddingY * 2;
    if (PAGE_BOTTOM - cursor.y < rowHeight) addPage(pdf, cursor);
    const fill = isHeader ? COLORS.tableHead : rowIndex % 2 === 0 ? COLORS.tableEven : COLORS.tableOdd;

    let x = cursor.x;
    cellLines.forEach((lines, columnIndex) => {
      const width = colWidths[columnIndex];
      pdf.setFillColor(...fill);
      pdf.setDrawColor(...COLORS.borderSoft);
      pdf.rect(x, cursor.y, width, rowHeight, 'FD');
      const visibleLines = lines.slice(lineStart, lineEnd);
      (visibleLines.length ? visibleLines : [[{ text: ' ', code: false }]]).forEach((line, offset) => {
        drawInlineLine(pdf, line, x + paddingX, cursor.y + paddingY + (offset + 0.82) * lineHeight, fontSize, COLORS.text, isHeader ? 'bold' : 'normal', lineHeight);
      });
      x += width;
    });

    if (continued) {
      withFont(pdf, 'helvetica', 'bold', 7, COLORS.faint);
      pdf.text('continued', cursor.x + cursor.width - 17, cursor.y + 3.5);
    }
    cursor.y += rowHeight;
  };

  const drawHeader = () => {
    const totalLines = Math.max(...headerLines.map((lines) => lines.length), 1);
    drawPreparedRowChunk(headerLines, 0, 0, totalLines, true, false);
  };

  const drawBodyRow = (cells, rowIndex) => {
    const cellLines = prepareRow(cells, false);
    const totalLines = Math.max(...cellLines.map((lines) => lines.length), 1);
    let lineStart = 0;
    let continued = false;

    while (lineStart < totalLines) {
      if (PAGE_BOTTOM - cursor.y < lineHeight + paddingY * 2) {
        addPage(pdf, cursor);
        drawHeader();
      }
      const usableHeight = Math.max(lineHeight, PAGE_BOTTOM - cursor.y - paddingY * 2);
      const maxLinesThisPage = Math.max(1, Math.floor(usableHeight / lineHeight));
      const lineEnd = Math.min(totalLines, lineStart + maxLinesThisPage);
      drawPreparedRowChunk(cellLines, rowIndex, lineStart, lineEnd, false, continued);
      lineStart = lineEnd;
      continued = true;
      if (lineStart < totalLines) {
        addPage(pdf, cursor);
        drawHeader();
      }
    }
  };

  ensureSpace(pdf, cursor, 16);
  drawHeader();
  (block.rows || []).forEach((row, index) => drawBodyRow(row, index + 1));
  cursor.y += after;
  if (cursor.y > PAGE_BOTTOM) addPage(pdf, cursor);
}


function drawFigure(pdf, cursor, block) {
  const lines = [`Image reference: ${block.alt || 'Image'}`, ...(block.src ? [block.src] : [])];
  const fontSize = 10.2;
  const lineHeight = mmLineHeight(fontSize, 1.42);
  const boxHeight = lines.length * lineHeight + 8;
  ensureSpace(pdf, cursor, boxHeight);
  pdf.setFillColor(...COLORS.accentSofter);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(cursor.x, cursor.y, cursor.width, boxHeight, 3, 3, 'FD');
  withFont(pdf, 'helvetica', 'bold', fontSize, COLORS.text);
  pdf.text(lines[0], cursor.x + 3.5, cursor.y + 5);
  if (lines[1]) {
    withFont(pdf, 'helvetica', 'normal', 9.2, COLORS.muted);
    pdf.text(splitToLines(pdf, lines[1], cursor.width - 7), cursor.x + 3.5, cursor.y + 5 + lineHeight);
  }
  cursor.y += boxHeight + 5;
}

function drawDocumentHeader(pdf, cursor, document, destinations) {
  const titleLines = splitToLines(pdf, document.topicTitle, cursor.width - 8);
  const titleLineHeight = mmLineHeight(19, 1.15);
  const boxHeight = Math.max(40, titleLines.length * titleLineHeight + 22);
  ensureSpace(pdf, cursor, boxHeight + 24);
  destinations.set(`topic:${document.topicId}`, { page: pdf.getNumberOfPages(), top: cursor.y - 2 });

  const boxY = cursor.y - 4;
  pdf.setFillColor(...COLORS.accentSofter);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(cursor.x, boxY, cursor.width, boxHeight, 5, 5, 'FD');

  withFont(pdf, 'helvetica', 'bold', 9.2, COLORS.accentDark);
  pdf.text(normalizePdfText(document.topicGroup || document.domain || 'Reference'), cursor.x + 4, cursor.y + 3);

  withFont(pdf, 'helvetica', 'bold', 19, COLORS.text);
  titleLines.forEach((line, offset) => {
    pdf.text(normalizePdfText(line), cursor.x + 4, cursor.y + 13 + offset * titleLineHeight);
  });
  cursor.y = boxY + boxHeight + 8;

  if (document.summary) {
    writeWrappedParagraph(pdf, cursor, document.summary, { size: 10.3, color: COLORS.muted, after: 4.4 });
  }

  const metaBits = [
    `Domain: ${document.domain || document.topicGroup || 'Reference'}`,
    `Mode: ${document.includeFullTopic ? 'Full topic export' : 'Selected sections only'}`,
    document.tocEntries?.length ? `Sections: ${document.tocEntries.length}` : 'Topic-level export'
  ];
  writeWrappedParagraph(pdf, cursor, metaBits.join('  -  '), { size: 8.9, color: COLORS.muted, after: 2.8 });

  if (document.sourceFiles?.length) {
    writeWrappedParagraph(pdf, cursor, `Source files: ${document.sourceFiles.join(', ')}`, { size: 8.4, color: COLORS.muted, after: 4.4 });
  }
  drawRule(pdf, cursor);
}

function estimateBlockMinimumHeight(block) {
  switch (block?.type) {
    case 'heading': return block.level <= 2 ? 34 : 24;
    case 'paragraph': return 19;
    case 'list': return 22;
    case 'blockquote': return 36;
    case 'table': return 30;
    case 'code':
    case 'diagram': return 34;
    case 'figure': return 25;
    case 'rule': return 8;
    default: return 16;
  }
}


async function renderDocument(pdf, cursor, document, destinations, documentIndex, totalDocuments) {
  drawDocumentHeader(pdf, cursor, document, destinations);

  for (let index = 0; index < document.blocks.length; index += 1) {
    const block = document.blocks[index];
    if (block.type === 'heading') {
      const nextBlock = document.blocks[index + 1];
      const headingHeight = estimateHeadingHeight(pdf, cursor, block);
      const orphanGuard = block.level <= 2 ? 13 : 9;
      const needed = headingHeight + Math.min(orphanGuard, estimateBlockMinimumHeight(nextBlock));
      if (PAGE_BOTTOM - cursor.y < needed && PAGE_BOTTOM - cursor.y < 34) {
        addPage(pdf, cursor);
      }
    }
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

    if (index > 0 && index % 6 === 0) {
      const chapterWeight = document.blocks.length ? index / document.blocks.length : 1;
      progress(
        `Rendering chapter ${documentIndex + 1} of ${totalDocuments}: ${document.topicTitle}`,
        35 + ((documentIndex + chapterWeight) / Math.max(1, totalDocuments)) * 50,
        'rendering'
      );
      await reportYield();
    }
  }
}

function renderCover(pdf, plan, timestamp) {
  const cursor = createCursor();
  pdf.setFillColor(...COLORS.accentSoft);
  pdf.roundedRect(PAGE.left, PAGE.top, CONTENT_WIDTH, 62, 7, 7, 'F');
  pdf.setFillColor(...COLORS.accent);
  pdf.roundedRect(PAGE.left + 5, PAGE.top + 7, 3, 43, 1.5, 1.5, 'F');

  withFont(pdf, 'helvetica', 'bold', 11, COLORS.accentDark);
  pdf.text('Technical Notes Cookbook', cursor.x + 12, cursor.y + 10);
  withFont(pdf, 'helvetica', 'bold', 27, COLORS.text);
  pdf.text(splitToLines(pdf, 'Selected Technical Notes Export', cursor.width - 18), cursor.x + 12, cursor.y + 26);
  withFont(pdf, 'helvetica', 'normal', 11.5, COLORS.muted);
  pdf.text(splitToLines(pdf, `${plan.summaryText}. Generated as a clean, document-only cookbook PDF.`, cursor.width - 18), cursor.x + 12, cursor.y + 44);

  cursor.y = 94;
  const cards = [
    ['Scope', plan.scopeLabel],
    ['Generated', timestamp],
    ['Topics', String(plan.selectedTopicCount)],
    ['Sections', String(plan.selectedSectionCount)]
  ];

  cards.forEach(([label, value], index) => {
    const cardX = PAGE.left + (index % 2) * ((cursor.width - 7) / 2 + 7);
    const cardY = cursor.y + Math.floor(index / 2) * 31;
    const cardWidth = (cursor.width - 7) / 2;
    pdf.setFillColor(...COLORS.white);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(cardX, cardY, cardWidth, 25, 4, 4, 'FD');
    withFont(pdf, 'helvetica', 'bold', 8.8, COLORS.accentDark);
    pdf.text(label, cardX + 3.5, cardY + 6.7);
    withFont(pdf, 'helvetica', 'bold', 11.5, COLORS.text);
    pdf.text(splitToLines(pdf, value, cardWidth - 7), cardX + 3.5, cardY + 15.5);
  });

  cursor.y += 78;
  writeWrappedParagraph(
    pdf,
    cursor,
    'This export is generated in the background so the app remains usable while the PDF is prepared, rendered, linked, and finalized.',
    { size: 11, color: COLORS.muted }
  );
}

function reserveTocPages(pdf, documents) {
  const entries = [];
  documents.forEach((document) => {
    entries.push({ label: document.topicTitle, level: 1 });
    (document.tocEntries || []).forEach((section) => entries.push({ label: section.title, level: section.level }));
  });

  const estimatedLines = entries.reduce((sum, entry) => {
    const charsPerLine = entry.level <= 1 ? 58 : entry.level === 2 ? 64 : 70;
    return sum + Math.max(1, Math.ceil(normalizePdfText(entry.label).length / charsPerLine));
  }, 0);
  const firstPageCapacity = 20;
  const followingPageCapacity = 31;
  const tocPageCount = Math.max(
    2,
    1 + Math.ceil(Math.max(0, estimatedLines - firstPageCapacity) / followingPageCapacity) + 1
  );
  const tocStartPage = 2;
  for (let index = 0; index < tocPageCount; index += 1) pdf.addPage();
  return { tocStartPage, tocPageCount };
}


function renderSummaryAndToc(pdf, plan, destinations, tocStartPage, tocPageCount) {
  const entries = [];
  plan.documents.forEach((document) => {
    entries.push({ label: document.topicTitle, level: 1, key: `topic:${document.topicId}` });
    (document.tocEntries || []).forEach((section) => {
      entries.push({ label: section.title, level: section.level, key: `heading:${document.topicId}:${section.id}` });
    });
  });

  for (let offset = 0; offset < tocPageCount; offset += 1) {
    pdf.setPage(tocStartPage + offset);
    pdf.setFillColor(...COLORS.white);
    pdf.rect(0, 0, PAGE.width, PAGE.height, 'F');
  }

  let page = tocStartPage;
  let y = PAGE.top;
  pdf.setPage(page);
  withFont(pdf, 'helvetica', 'bold', 19, COLORS.text);
  pdf.text('Export Summary', PAGE.left, y);
  y += 9.5;

  const summaryFontSize = 10.6;
  const summaryLineHeight = mmLineHeight(summaryFontSize, 1.48);
  const summaryLines = splitToLines(pdf, 'This document includes only your selected notes and sections. App controls, sidebars, live navigation, and interactive editor chrome are intentionally excluded.', CONTENT_WIDTH);
  withFont(pdf, 'helvetica', 'normal', summaryFontSize, COLORS.muted);
  pdf.text(summaryLines, PAGE.left, y);
  y += summaryLines.length * summaryLineHeight + 7;

  const summaryCards = [
    ['Selection scope', plan.scopeLabel],
    ['Included content', plan.summaryText]
  ];
  summaryCards.forEach(([label, value], index) => {
    const cardWidth = (CONTENT_WIDTH - 6) / 2;
    const cardX = PAGE.left + index * (cardWidth + 6);
    pdf.setFillColor(...COLORS.accentSofter);
    pdf.setDrawColor(...COLORS.border);
    pdf.roundedRect(cardX, y, cardWidth, 25, 4, 4, 'FD');
    withFont(pdf, 'helvetica', 'bold', 8.8, COLORS.accentDark);
    pdf.text(label, cardX + 3, y + 6.6);
    withFont(pdf, 'helvetica', 'normal', 10.2, COLORS.text);
    pdf.text(splitToLines(pdf, value, cardWidth - 6), cardX + 3, y + 14.2);
  });
  y += 34;

  withFont(pdf, 'helvetica', 'bold', 16, COLORS.text);
  pdf.text('Table of Contents', PAGE.left, y);
  y += 8;

  entries.forEach((entry) => {
    const destination = destinations.get(entry.key);
    if (!destination) return;

    const fontSize = entry.level <= 1 ? 11.1 : entry.level === 2 ? 10.1 : 9.4;
    const indent = entry.level <= 1 ? 0 : entry.level === 2 ? 8 : entry.level === 3 ? 14 : 20;
    const availableWidth = CONTENT_WIDTH - indent - 20;
    const lines = splitToLines(pdf, entry.label, availableWidth);
    const lineHeight = mmLineHeight(fontSize, 1.32);
    const blockHeight = Math.max(lineHeight, lines.length * lineHeight) + 1.6;

    if (y + blockHeight > PAGE_BOTTOM) {
      page = Math.min(page + 1, tocStartPage + tocPageCount - 1);
      pdf.setPage(page);
      y = PAGE.top;
    }

    const x = PAGE.left + indent;
    withFont(pdf, 'helvetica', entry.level <= 1 ? 'bold' : 'normal', fontSize, COLORS.text);
    pdf.text(lines, x, y);
    const pageLabel = String(destination.page);
    const pageWidth = pdf.getTextWidth(pageLabel);
    pdf.text(pageLabel, PAGE.width - PAGE.right - pageWidth, y);

    pdf.setDrawColor(...COLORS.borderSoft);
    pdf.setLineWidth(0.15);
    pdf.line(x + Math.min(availableWidth, pdf.getTextWidth(lines[0] || '')) + 2, y - 0.8, PAGE.width - PAGE.right - pageWidth - 2, y - 0.8);
    pdf.link(x, y - lineHeight + 1, CONTENT_WIDTH, blockHeight, { pageNumber: destination.page, top: Math.max(0, destination.top) });
    y += blockHeight;
  });
}

function addPageNumbers(pdf) {
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    withFont(pdf, 'helvetica', 'normal', 8.6, COLORS.muted);
    pdf.text(`Page ${page} of ${totalPages}`, PAGE.width - PAGE.right, PAGE.height - 7, { align: 'right' });
  }
}

async function prepareDocuments(plan) {
  const documents = plan.documents || [];
  const prepared = [];
  for (let index = 0; index < documents.length; index += 1) {
    progress(`Preparing chapter ${index + 1} of ${documents.length}: ${documents[index].topicTitle}`, 6 + ((index + 1) / Math.max(1, documents.length)) * 28, 'preparing');
    prepared.push(prepareDocument(documents[index]));
    if (index % 2 === 0) await reportYield();
  }
  return { ...plan, documents: prepared };
}

async function renderPdf(plan, filename, generatedAt) {
  if (!plan?.documents?.length) throw new Error('No selected documents were available for export.');

  progress('Creating PDF shell', 35, 'rendering');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true });
  pdf.setProperties({ title: 'Technical Notes Cookbook Export', subject: plan.scopeLabel, creator: 'Technical Notes Web App' });

  const destinations = new Map();
  renderCover(pdf, plan, generatedAt || new Date().toISOString());
  const { tocStartPage, tocPageCount } = reserveTocPages(pdf, plan.documents);

  pdf.addPage();
  const cursor = createCursor();
  for (let index = 0; index < plan.documents.length; index += 1) {
    const document = plan.documents[index];
    if (index > 0) addPage(pdf, cursor);
    progress(`Rendering chapter ${index + 1} of ${plan.documents.length}: ${document.topicTitle}`, 35 + (index / Math.max(1, plan.documents.length)) * 50, 'rendering');
    await renderDocument(pdf, cursor, document, destinations, index, plan.documents.length);
    await reportYield();
  }

  progress('Building clickable table of contents', 88, 'finalizing');
  renderSummaryAndToc(pdf, plan, destinations, tocStartPage, tocPageCount);

  progress('Adding page numbers', 94, 'finalizing');
  addPageNumbers(pdf);
  await reportYield();

  progress('Finalizing PDF bytes', 98, 'finalizing');
  const arrayBuffer = pdf.output('arraybuffer');
  post('completed', { filename, arrayBuffer }, [arrayBuffer]);
}

self.onmessage = async (event) => {
  const { type, taskId, payload } = event.data || {};
  if (type !== 'start-pdf-export' || !payload) return;
  activeTaskId = taskId || `${Date.now()}`;

  try {
    const { plan, filename = 'notes.pdf', generatedAt } = payload;
    progress('Starting background export', 3, 'queued');
    const preparedPlan = await prepareDocuments(plan);
    await renderPdf(preparedPlan, filename, generatedAt);
  } catch (error) {
    post('error', { error: error?.message || 'Unable to generate the PDF.' });
  }
};
