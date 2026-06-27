# Loader Optimization Fixes

## What was causing the freeze

The previous loader used a canvas animation with `requestAnimationFrame()` and `getImageData()` every frame. When multiple loader sections or lazy placeholders were visible, the browser had to read and rewrite thousands of pixels repeatedly, which could freeze scrolling and make the side panels feel stuck.

## What changed

- Replaced the canvas loader with a pure CSS ambient blob layer.
- Removed all runtime pixel processing from loader animations.
- Kept the loader as a section-level background layer instead of rendering it inside each content container.
- Kept colors theme-aware through `var(--accent)`, `var(--accent-soft)`, `var(--article-bg)`, `var(--panel-soft)`, and related variables.
- Added reduced-motion support.
- Fixed lazy topic fetching so far-away full-scroll topics do not fetch just because their content is empty.

## Files changed

- `src/components/loaders/AppLoading.jsx`
- `src/components/LazyTopicContent.jsx`
- `src/index.css`

## Build

`npm run build` passes.
