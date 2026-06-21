import { marked } from 'marked';
import { normalizeCodeFenceContent, slugify } from '../utils/text.js';

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
  return {
    type: 'figure',
    alt: image.text || 'Image reference',
    src: image.href || ''
  };
}

function sanitizeText(value = '') {
  return String(value).replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function prepareDocument(document) {
  const tokens = marked.lexer(document.markdown || '', {
    gfm: true,
    breaks: false
  });
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
        const heading = {
          type: 'heading',
          level: token.depth,
          id,
          text
        };
        blocks.push(heading);
        if (token.depth >= 2 && token.depth <= 4) {
          tocEntries.push({
            id,
            title: text,
            level: token.depth
          });
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
        const items = token.items
          ?.map((item) => sanitizeText(inlineText(item.tokens || [])))
          .filter(Boolean) || [];
        if (items.length) {
          blocks.push({
            type: 'list',
            ordered: Boolean(token.ordered),
            start: Number(token.start) || 1,
            items
          });
        }
        return;
      }
      case 'table': {
        const header = (token.header || []).map((cell) => sanitizeText(inlineText(cell.tokens || [])));
        const rows = (token.rows || []).map((row) => row.map((cell) => sanitizeText(inlineText(cell.tokens || []))));
        if (header.length) {
          blocks.push({
            type: 'table',
            header,
            rows
          });
        }
        return;
      }
      case 'code': {
        const language = String(token.lang || '').trim().toLowerCase();
        const text = normalizeCodeFenceContent(token.text || '', language);
        if (!text) return;
        blocks.push({
          type: language === 'mermaid' ? 'diagram' : 'code',
          language: language || 'text',
          text
        });
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

  return {
    ...document,
    blocks,
    tocEntries
  };
}

self.onmessage = (event) => {
  const { type, payload, taskId } = event.data || {};
  if (type !== 'prepare-document' || !payload) return;

  try {
    const document = prepareDocument(payload);
    self.postMessage({
      type: 'prepared-document',
      taskId,
      payload: document
    });
  } catch (error) {
    self.postMessage({
      type: 'prepare-error',
      taskId,
      error: error?.message || 'Unable to prepare export document.'
    });
  }
};
