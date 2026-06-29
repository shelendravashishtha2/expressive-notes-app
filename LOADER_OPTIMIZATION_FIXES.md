# Loader Replacement Notes

The previous canvas/blob loader has been removed from the runtime loader path and replaced with a lightweight pure CSS four-dash loader based on the requested CodePen animation pattern.

## What changed

- Replaced the canvas animation in `src/components/loaders/AppLoading.jsx` with a reusable CSS dash loader.
- Added a tiny `Loading... <percentage>%` label directly above the loader for startup, inline topic loading, and full-scroll tail loading. Full-scroll tail loading receives the app's real visible-topic percentage; startup/topic fetch placeholders use a capped loading estimate because the current fetch layer does not expose byte-level progress.
- Kept the loader animation infinite while the loading component is mounted.
- Bound all loader colors/glow/card surfaces to the app theme variables: `--accent`, `--accent-strong`, `--article-bg`, `--app-bg`, `--panel-soft`, and `--border`.
- Preserved the existing public exports: `AppStartupLoader`, `InlineTopicLoader`, `InlineContentLoader`, `FullScrollTailLoader`, `SyncStatusDock`, `SectionBlobLoader`, and the default `BlobLoader`.

## Files updated

- `src/components/loaders/AppLoading.jsx`
- `src/index.css`
- `dist/` regenerated via `npm run build`

## Validation

`npm run build` completed successfully.
