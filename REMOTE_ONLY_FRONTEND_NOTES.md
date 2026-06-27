# Remote-only frontend optimization

This build enforces the updated frontend contract:

1. Notes are loaded only from `https://technical-notes-backend.onrender.com/api/v1` or `VITE_API_BASE_URL`.
2. Local notes data files are removed from the source tree. Monaco theme JSON files remain because they are UI theme assets, not notes.
3. Bootstrap loads remote navigation metadata first.
4. Topic bodies are lazy-hydrated through RTK Query.
5. Full-scroll mode prefetches topics several screens before the user reaches them.
6. Loaders are visible and local to the current topic / scroll tail instead of blocking the whole page.
7. PDF export and custom reader selections hydrate selected remote topics before rendering/exporting, so they do not depend on local note content.

Important env:

```env
VITE_API_BASE_URL=https://technical-notes-backend.onrender.com/api/v1
```

Build verified with:

```bash
npm install
npm run build
```
