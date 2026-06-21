import { buildSectionIndex } from './text.js';

const MAX_PREFIX_LENGTH = 28;
const MIN_SEARCH_TOKEN_LENGTH = 1;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'what', 'when', 'where', 'why'
]);

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9+#./:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return Array.from(new Set(normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_SEARCH_TOKEN_LENGTH)
    .filter((token) => !(token.length <= 2 && STOP_WORDS.has(token)))));
}

function addPosting(map, key, index) {
  if (!key) return;
  const existing = map.get(key);
  if (existing) existing.push(index);
  else map.set(key, [index]);
}

function pushUnique(target, values = []) {
  for (const value of values) target.add(value);
  return target;
}

function intersectPostingLists(lists = []) {
  if (!lists.length) return [];
  const sorted = [...lists].sort((a, b) => a.length - b.length);
  let current = new Set(sorted[0]);

  for (let i = 1; i < sorted.length; i += 1) {
    const next = new Set(sorted[i]);
    current = new Set([...current].filter((value) => next.has(value)));
    if (!current.size) break;
  }

  return [...current];
}

function getPostingsForTerm(index, term) {
  const exact = index.termPostings.get(term) || [];
  const prefix = index.prefixPostings.get(term) || [];
  if (!exact.length && !prefix.length) return null;
  return [...pushUnique(new Set(), exact), ...prefix.filter((value) => !exact.includes(value))];
}

function createSnippet(text = '', query = '') {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const normalizedCleaned = cleaned.toLowerCase();
  const terms = tokenize(query);
  const first = terms.find((term) => normalizedCleaned.includes(term));
  const index = first ? normalizedCleaned.indexOf(first) : 0;
  const start = Math.max(0, index - 90);
  const end = Math.min(cleaned.length, index + 220);
  return `${start > 0 ? '…' : ''}${cleaned.slice(start, end)}${end < cleaned.length ? '…' : ''}`;
}

function scoreEntry(entry, terms, phrase) {
  let score = 0;
  const normalizedTitle = normalizeText(`${entry.topicTitle || ''} ${entry.sectionTitle || ''}`);

  if (phrase && entry.normalizedText.includes(phrase)) score += 120;
  if (phrase && normalizedTitle.includes(phrase)) score += 180;

  for (const term of terms) {
    if (entry.topicTitleNormalized.includes(term)) score += 80;
    if (entry.sectionTitleNormalized.includes(term)) score += 100;
    if (entry.groupNormalized.includes(term)) score += 24;
    if (entry.tokenSet.has(term)) score += 22;
    if (entry.tokens.some((token) => token.startsWith(term))) score += 14;
    if (entry.normalizedText.includes(term)) score += 4;
  }

  score += Math.max(0, 20 - Math.floor((entry.plainText || '').length / 900));
  return score;
}

export function buildFastSearchIndex(topics = []) {
  const sectionEntries = buildSectionIndex(topics);
  const termPostings = new Map();
  const prefixPostings = new Map();

  const entries = sectionEntries.map((entry, index) => {
    const normalizedText = normalizeText(entry.plainText || '');
    const tokens = tokenize(normalizedText);
    const tokenSet = new Set(tokens);
    const topicTitleNormalized = normalizeText(entry.topicTitle || '');
    const sectionTitleNormalized = normalizeText(entry.sectionTitle || '');
    const groupNormalized = normalizeText(`${entry.group || ''} ${entry.domain || ''}`);

    for (const token of tokens) {
      addPosting(termPostings, token, index);
      const max = Math.min(MAX_PREFIX_LENGTH, token.length);
      for (let length = 2; length <= max; length += 1) {
        addPosting(prefixPostings, token.slice(0, length), index);
      }
    }

    return {
      ...entry,
      normalizedText,
      tokens,
      tokenSet,
      topicTitleNormalized,
      sectionTitleNormalized,
      groupNormalized
    };
  });

  return { entries, termPostings, prefixPostings };
}

export function searchSectionsFast(index, query, limit = 80) {
  const phrase = normalizeText(query);
  if (!phrase) return [];

  const terms = tokenize(phrase).filter(Boolean);
  if (!terms.length) return [];

  const postingLists = terms.map((term) => getPostingsForTerm(index, term));
  const canUseIndex = postingLists.every((list) => Array.isArray(list) && list.length > 0);
  const candidateIndexes = canUseIndex
    ? intersectPostingLists(postingLists)
    : index.entries.map((_, entryIndex) => entryIndex);

  return candidateIndexes
    .map((entryIndex) => index.entries[entryIndex])
    .filter(Boolean)
    .filter((entry) => terms.every((term) => (
      entry.tokenSet.has(term)
      || entry.tokens.some((token) => token.startsWith(term))
      || entry.normalizedText.includes(term)
    )))
    .map((entry) => ({
      ...entry,
      score: scoreEntry(entry, terms, phrase),
      snippet: createSnippet(entry.plainText, phrase),
      query: phrase
    }))
    .sort((a, b) => b.score - a.score || a.topicTitle.localeCompare(b.topicTitle) || a.sectionTitle.localeCompare(b.sectionTitle))
    .slice(0, limit);
}
