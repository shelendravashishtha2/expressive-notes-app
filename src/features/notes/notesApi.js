import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const DEFAULT_API_BASE_URL = 'https://technical-notes-backend.onrender.com/api/v1';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function unwrapTopicPayload(topic = {}) {
  if (topic?.topic && typeof topic.topic === 'object') return topic.topic;
  if (topic?.data && typeof topic.data === 'object') return topic.data;
  if (topic?.item && typeof topic.item === 'object') return topic.item;
  return topic || {};
}

function normalizeTopic(topic = {}) {
  const source = unwrapTopicPayload(topic);
  const content = firstString(
    source.content,
    source.body_markdown,
    source.bodyMarkdown,
    source.markdown,
    source.markdown_body,
    source.rawText,
    source.raw_text,
    source.body,
    source.text,
    source.md
  );
  const sections = firstArray(
    source.sections,
    source.section_tree,
    source.sectionTree,
    source.headings,
    source.toc,
    source.children,
    source.subsections,
    source.items
  );

  return {
    ...source,
    id: source.id || source.slug || source.topicId || source.topic_id,
    slug: source.slug || source.id || source.topicId || source.topic_id,
    content,
    body_hash: source.body_hash || source.content_hash || source.bodyHash || source.hash || '',
    sections,
    sourceFiles: Array.isArray(source.sourceFiles)
      ? source.sourceFiles
      : Array.isArray(source.sources)
        ? source.sources.map((item) => item.source_key || item.sourceKey || item.filename || item.name || item.id).filter(Boolean)
        : []
  };
}

function normalizeBootstrap(payload = {}) {
  const topics = Array.isArray(payload.topics) ? payload.topics.map(normalizeTopic) : [];
  return {
    ...payload,
    topics,
    groupOrderPreference: Array.isArray(payload.groupOrderPreference)
      ? payload.groupOrderPreference
      : Array.isArray(payload.groups)
        ? payload.groups.map((group) => group.name).filter(Boolean)
        : []
  };
}

function normalizeSearchResponse(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  return items.map((item) => ({
    ...item,
    topicId: item.topicId || item.topic_slug || item.slug || item.id,
    topicTitle: item.topicTitle || item.topic_title || item.title,
    sectionId: item.sectionId || item.section_slug || 'overview',
    sectionTitle: item.sectionTitle || item.section_title || null,
    sectionPath: Array.isArray(item.sectionPath)
      ? item.sectionPath
      : [item.topicTitle || item.topic_title || item.title, item.sectionTitle || item.section_title].filter(Boolean),
    snippet: item.snippet || item.summary || ''
  }));
}

export const notesApi = createApi({
  reducerPath: 'notesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: configuredBaseUrl,
    prepareHeaders: (headers) => {
      headers.set('Accept', 'application/json');
      return headers;
    }
  }),
  tagTypes: ['Bootstrap', 'Topic', 'Search'],
  keepUnusedDataFor: 60 * 60,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getBootstrap: builder.query({
      query: () => '/bootstrap',
      transformResponse: normalizeBootstrap,
      providesTags: ['Bootstrap'],
      keepUnusedDataFor: 60 * 60
    }),
    getTopic: builder.query({
      query: (topicId) => `/topics/${encodeURIComponent(topicId)}?include_sources=true&include_section_bodies=true`,
      transformResponse: normalizeTopic,
      providesTags: (_result, _error, topicId) => [{ type: 'Topic', id: topicId }],
      keepUnusedDataFor: 60 * 60
    }),
    hydrateTopics: builder.query({
      query: ({ ids = [], includeSectionBodies = true } = {}) => ({
        url: '/topics/hydrate',
        method: 'POST',
        body: {
          ids,
          include_sections: true,
          include_sources: true,
          include_assets: false,
          include_section_bodies: includeSectionBodies
        }
      }),
      transformResponse: (payload) => (Array.isArray(payload) ? payload : payload?.items || []).map(normalizeTopic),
      providesTags: (result = []) => [
        ...result.map((topic) => ({ type: 'Topic', id: topic.id })),
        'Topic'
      ],
      keepUnusedDataFor: 60 * 60
    }),
    searchSections: builder.query({
      query: ({ q, limit = 18 } = {}) => `/search/sections?q=${encodeURIComponent(q || '')}&limit=${limit}`,
      transformResponse: normalizeSearchResponse,
      providesTags: (_result, _error, arg) => [{ type: 'Search', id: arg?.q || '' }],
      keepUnusedDataFor: 10 * 60
    })
  })
});

export const {
  useGetBootstrapQuery,
  useGetTopicQuery,
  useLazyGetTopicQuery,
  useLazyHydrateTopicsQuery,
  useSearchSectionsQuery,
  usePrefetch
} = notesApi;

export { configuredBaseUrl as API_BASE_URL };
