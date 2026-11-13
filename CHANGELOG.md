# Changelog

## 0.2.1 — 2026-11-13

- Makes blank/pinned priority deterministic while preserving mixed folders and ordinary sessions. Dissolving folders retains manual child order without freezing unrelated conversations.
- Restores search-result scrolling and reveals previously collapsed Ungrouped conversations.
- Keeps editor drafts through write failures, coalesces retries, and ignores stale responses after subscription failure or disposal.
- Restores the native sidebar when mirrored contributions are incompatible, without interrupting another plugin's registration; supports recovery after the conflict is removed.
- Skips unchanged transactions inside serialized CAS, improves large-catalog lookups, and validates new Unicode names without rewriting historical metadata.
- Applies ignore rules and private-file guards to source packaging, adds Host/Client test typechecking and `pnpm verify`, and documents persistent body indexing and user configuration precedence.
- Isolates test fixtures from plugin Client discovery so Loader and browser lifecycle checks exercise the installed bundle.
- Keeps storage domain version 1 and stock DSH 0.2.2-rc.2 compatibility.

## 0.2.0 — 2026-11-13

- Runs on stock DSH 0.2.2-rc.2 through the public sidebar slot. Host source patches are no longer an installation requirement.
- Keeps the established classification tree and tag editor while sharing native navigation, menus, shortcuts, picker, and viewing state.
- Adds candidate-filtered `betterClassifier.searchContent`, using the stock index and access checks before the 20-result limit.
- Moves the installable package to the repository root. Build dependencies come from npm; generated Remote metadata uses an isolated build workspace.
- Preserves the version 1 classification store and existing expansion preferences.
- Adds bilingual documentation, plugin detail pages, an icon, synthetic-data imagery, and read-only upgrade verification.

- Verified real browser folder/project/conversation dragging and persisted manual ordering with a human-operated pointer, alongside automated guards for invalid moves.

Validated on Windows x64 with stock DSH 0.2.2-rc.2. Distribution status is recorded in `docs/distribution.md`.

## 0.1.5 — previous local delivery

- Removed the classification toolbar, standalone filtering, global tag management, tag visibility control, and bulk-selection UI.
- Added root-folder creation from empty list space through the native context menu.
- Required DSH browser-extension patch version 3 on the recorded source baseline.
