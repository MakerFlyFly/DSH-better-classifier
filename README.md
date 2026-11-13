# DSH-better-classifier

[中文](README_ZH.md) · English

Organize the DSH conversation sidebar with nested virtual folders, colored tags, and search results that preserve the tree.

![Sidebar with synthetic demo projects and tags](detail/sidebar.jpg)

Version **0.2.0** targets stock **DSH 0.2.2-rc.2**, without modifying DSH source or installed packages. Node.js **24.9.0 or later** is required. Validated on Windows x64; other host versions and platforms are not declared compatible. See the [validation record](docs/validation.md).

## What it does

- Organizes projects in outer folders and conversations in folders within their project. Moving classification never moves files or changes working directories.
- Creates root folders from a right-click on list whitespace, including empty lists and empty search results. The focused background also supports the menu key and Shift+F10.
- Supports nested folders, single-item drag and drop, ordering, rename, and move menus. Deleting a folder moves its direct children up one level.
- Edits direct tags as chips on one page. Add, remove, create, rename, or recolor in a draft; Save commits together and Cancel discards it. Tags never inherit.
- Fits tags to the available row width, using `+N` only for overflow and keeping space before the time/actions.
- Searches names, direct tag names, conversation IDs, and message content through the stock DSH index. Matching containers start collapsed; leaf matches show their ancestor path. Up to 20 result entries are shown.
- Retains native project/session menus, pinning, archive filters, status indicators, sorting, directory picker, and shortcuts. Disabling the plugin restores the native list.

## Installation

Verify `dsh --version` reports `0.2.2-rc.2`. Download `dsh-better-classifier-0.2.0.tgz` from [GitHub Releases](https://github.com/MakerFlyFly/DSH-better-classifier/releases), verify its SHA-256 against the accompanying checksum file, then run:

```sh
dsh plugin --profile web add ./dsh-better-classifier-0.2.0.tgz
dsh web --no-open
```

Restart an already running DSH process and refresh its browser after installing. Replace `web` with the intended profile. The archive includes its build output; installation does not run a build or apply a source patch.

The Git repository contains source code and needs the development build below before local installation. npm publication and community-directory submissions are tracked in [distribution status](docs/distribution.md).

## Upgrade and remove

The `better_classifier` storage domain remains version 1. Versions 0.1.x and 0.2.0 share the folder, tag, placement, revision, and order representation; no data migration is required. The browser expansion key is unchanged. Old tag visibility and standalone-filter preferences remain ignored.

Version 0.1.x required a custom host patch. For 0.2.0, install into a stock 0.2.2-rc.2 host using the same DSH data directory/profile, after making a backup. Do not reverse-apply an old patch over a working tree with unrelated edits. The existing local 0.1.5 trial can remain alongside an isolated 0.2.0 review instance.

Disable the plugin through DSH's Plugins page, or remove it with:

```sh
dsh plugin --profile web remove dsh-better-classifier
```

Classification data remains in the configured DSH storage backend (by default `storages/better_classifier.json`) for reinstallation. Folder expansion remains browser-local. No cloud synchronization is provided.

## Development and verification

Build dependencies come from npm; the Loader regression also uses the system `tar` utility. No DSH source checkout, local symlink, or fixed machine path is needed.

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm typecheck
pnpm package
pnpm test
pnpm dev --fixture
```

The isolated review uses `.dev/review-0.2.0/home` and port 3085 (`--port=...` overrides it). The startup output contains a local authentication URL. `--fixture` seeds synthetic projects/conversations and exercises storage and search without calling a model. `--installed` starts the already installed package. Tests use their own homes and the exact published DSH CLI. The tarball and source ZIP are written to `dist/`.

The client adapter shadows the public `sidebar.workspaces` registration while borrowing its native action/state shares. Native picker and row contributions are mirrored into plugin-owned child seats and released with the owning registration. The compatibility boundary is therefore pinned, rather than claiming support for future DSH releases. `betterClassifier.searchContent` owns candidate-filtered search; authorization and filters run before the result limit. Remote metadata is generated in a disposable build workspace; installed host/generator files remain unchanged.

## Data and failures

Classification metadata is separate from conversation logs and model context. Saves use the server revision and commit atomically. A conflicting draft is refused and must be reopened; write failures retain the draft. Body-search failures retain name matches and offer Retry. Unknown/unloaded project and conversation IDs are not automatically deleted from classification storage.

Only synthetic test data is used in public documentation. Local profiles, session files, credentials, build caches, logs, and work records are excluded from distributable archives.

## License

MIT. The UI adapter derives from MIT-licensed DeepSeek Harness. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
