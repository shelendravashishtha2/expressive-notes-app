# Frontend backend integration and scroll optimization

This frontend now uses Redux Toolkit + RTK Query against:

```txt
https://technical-notes-backend.onrender.com/api/v1
```

## Main changes

- Added Redux store and RTK Query API layer.
- Bootstrap metadata loads from `/api/v1/bootstrap`.
- Topic content loads lazily from `/api/v1/topics/:id`.
- Topic content is prefetched for current, previous, and next topics.
- Full-scroll mode appends topics in batches instead of rendering the whole library at once.
- The next full-scroll batch is requested before the user reaches the end of the scroll.
- Search uses backend `/api/v1/search/sections` and falls back to local search if backend search is unavailable.
- Local static notes remain as a safety fallback so existing reader/export/search behavior does not break.
- Beautiful non-blocking loaders were added for startup, topic content, backend sync, and full-scroll tail loading.

## Required env

Create `.env` if you want to override the default backend URL:

```env
VITE_API_BASE_URL=https://technical-notes-backend.onrender.com/api/v1
```

## Install and run

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The build was verified successfully after these changes.
