import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const DEFAULT_API_BASE_URL = 'https://technical-notes-backend.onrender.com/api/v1';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

function normalizeTopic(topic = {}) {
  return {
    ...topic,
    id: topic.id || topic.slug,
    slug: topic.slug || topic.id,
    content: topic.content ?? topic.body_markdown ?? '',
    body_hash: topic.body_hash || topic.content_hash || topic.bodyHash || '',
    sections: Array.isArray(topic.sections) ? topic.sections : [],
    sourceFiles: Array.isArray(topic.sourceFiles)
      ? topic.sourceFiles
      : Array.isArray(topic.sources)
        ? topic.sources.map((source) => source.source_key || source.id).filter(Boolean)
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
  useLazyHydrateTopicsQuery,
  useSearchSectionsQuery,
  usePrefetch
} = notesApi;

export { configuredBaseUrl as API_BASE_URL };
