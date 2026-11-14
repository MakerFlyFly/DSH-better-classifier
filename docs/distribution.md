# Distribution status / 分发状态

Package: `dsh-better-classifier` · Published: `0.2.1` · Repository: [MakerFlyFly/DSH-better-classifier](https://github.com/MakerFlyFly/DSH-better-classifier)

0.2.1 is available on GitHub and npm. Publication, archive identity, and registry installation were verified on 2026-11-14 (Asia/Kuala_Lumpur). Five catalogue applications were submitted on 2026-11-14; the main community index entry is prepared but is waiting for its repository-age requirement. The `dsh-plugin` discovery topic has been restored. No catalogue acceptance or installation certification is implied by these submissions.

| Channel | Status |
| --- | --- |
| GitHub source and Release | [v0.2.1 published](https://github.com/MakerFlyFly/DSH-better-classifier/releases/tag/v0.2.1); [Windows CI passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/43459769538) |
| npm | [0.2.1 published](https://www.npmjs.com/package/dsh-better-classifier/v/0.2.1), `latest` is `0.2.1`; [trusted-publishing workflow passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/43460301031) with provenance |
| [Main community index](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) | One `session` YAML entry prepared, pointing to the pinned 0.2.1 Release tarball. Upstream entry validation passed. **Not submitted yet:** the repository reaches 24 hours at 2026-11-14 11:18:21 UTC; submit at or after 19:19 Asia/Kuala_Lumpur. This index supplies awesome-dsh-plugin.com and dshmarket.com. |
| [Workshop / dsh-market.com](https://github.com/zhu1090093659/dsh-community-plugins) | [PR #108](https://github.com/zhu1090093659/dsh-community-plugins/pull/108) open, awaiting review. Local checks passed. [Upstream CI](https://github.com/zhu1090093659/dsh-community-plugins/actions/runs/43542547267) requires maintainer approval to run (`action_required`); reviewer routing passed. Merge and downstream Workshop integration are not yet confirmed. |
| [DSH Plugin Hub / dsh-plugin.org](https://dsh-plugin.org/zh/submit) | [Issue #773](https://github.com/dshplugin/dsh-plugin-hub/issues/773) submitted, awaiting review; no verified/listed status claimed. |
| [Open Plugin Market / dshopen.org](https://github.com/polang233/dsh-plugin-index/blob/main/.github/CONTRIBUTING.md) | [Issue #486](https://github.com/polang233/dsh-plugin-index/issues/486) submitted for review of the published npm package. No entry was found in its public index before submission. |
| [DSH Market / dsh.market](https://github.com/2BingLing/dsh-market) | [Issue #382](https://github.com/2BingLing/dsh-market/issues/382) submitted; its bot acknowledged receipt and queued repository detection. Inclusion is not yet confirmed. |
| [DSH Plugin Radar](https://github.com/AdamPlatin123/dsh-plugin-radar) | [PR #1464](https://github.com/AdamPlatin123/dsh-plugin-radar/pull/1464) open, awaiting review. One `PLUGINS.md` row, run level `待测`; no CI check is attached to this registration-only change. |

Status checked at 2026-11-14 01:47 UTC (09:47 Asia/Kuala_Lumpur). Submitted, awaiting review, merged, indexed, and runtime-verified are distinct states. A discovery topic or submission receipt alone is not proof of current catalogue inclusion. Release source snapshots retain their build-time status.

## Submission requirements and verification

- All five applications identify the public repository, MIT license, npm `0.2.1`, the `web` install command, and the actual tested boundary: stock DSH `0.2.2-rc.2`, Windows x64 and Node.js `>=24.9.0`. Public screenshots contain demonstration data.
- The manifests and published package include `dsh.bundle.patch`, `cordis.patch.yml`, and prebuilt Host/Client entries. Documentation explains Remote authorization, local metadata, the shared SQLite content index, and retained data after uninstall. No host patch or Git-source runtime build is advertised.
- Workshop: one sorted `community.json` entry in `ui` / `panel`. Its locked dependency installation, index gate, 10 script tests, 3 unit tests, typecheck, build and `git diff --check` passed. Its current `AGENTS.md` and validator order entries by `id`; the older template's `rank` field was not added.
- Radar: its own classifier selected Web UI enhancement. The change is exactly one added row and passes `git diff --check`. The PR explicitly leaves the `@dsh-external/*` namespace checkbox unchecked because the existing package is unscoped, consistent with previously accepted third-party entries; it does not claim that namespace or a Radar runtime certification. Maintainers can edit both PR branches.
- Main community index: `readEntries()` and `validateEntries()` accepted all 10,975 entries including exactly one BetterClassifier entry, with zero errors. The prepared file contains only supported fields and a pinned prebuilt tarball URL; npm mapping and screenshots are discovered from the product repository. The age gate has not been bypassed, and no generated README was edited.

## Deferred channels

Earlier withdrawal requests remain unchanged. No restoration email or reopening of the old PR was sent during this round; a withdrawal request does not establish that an operator completed removal. Automatic collection requirements will be met through normal maintenance, without artificial commits.

| Channel | Status |
| --- | --- |
| [DSHX](https://dshx.io/en/plugins) | Withdrawal requested on 2026-11-13, operator completion unconfirmed; manual relisting deferred. |
| [DSH Plugin Registry](https://dshplugin.app/submit) | Withdrawal requested on 2026-11-13, operator completion unconfirmed; manual relisting deferred. |
| [DSH Marketplace](https://dshmarketplace.dev/submit) | Withdrawal requested on 2026-11-13, operator completion unconfirmed; manual relisting and its automatic commit-count gate deferred. |
| [ydhrdh/dsh-marketplace](https://github.com/ydhrdh/dsh-marketplace) | [PR #24](https://github.com/ydhrdh/dsh-marketplace/pull/24) closed, not merged; reconfirmed on 2026-11-13 |
| [dsh.pub](https://dsh.pub/en/submit/) | Its Git-source validator requires committed runtime entries; this repository distributes compiled entries through release archives instead |

## 0.2.1 release verification

- Release source commit: `4c84a943effb802e5edd192dcb65c1a60ed51ce8`, referenced by `v0.2.1`.
- Windows CI and the tagged publish workflow passed build, production/test typechecking, packaging, and all 108 tests. Two publication-path regression tests were added after npm interpreted an unprefixed archive path as a Git shorthand; the successful release uses an explicit local file spec.
- The workflow artifact, npm download, and GitHub Release tarball have the same SHA-256: `cd903239606e6aa2dc87ce6247c6387ce7cf91e56e6bf5bd8699d3ec98b4e169`. All five Release assets were downloaded and compared with the workflow artifact.
- Installing `dsh-better-classifier@0.2.1` from npm through the formal stock DSH 0.2.2-rc.2 CLI passed Host start, restart, uninstall/reinstall, candidate-filtered SQLite search, and metadata-persistence checks in an isolated Windows profile.
- GitHub Release publication completed at `2026-11-13T16:19:12Z` (2026-11-14 in Asia/Kuala_Lumpur). This status update does not move the published release tag or replace its assets.
