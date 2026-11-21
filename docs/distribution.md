# Distribution status / 分发状态

Package: `dsh-better-classifier` · Published: `0.2.2` · Repository: [MakerFlyFly/DSH-better-classifier](https://github.com/MakerFlyFly/DSH-better-classifier)

0.2.2 is published on GitHub and npm, verified on 2026-11-22 (Asia/Kuala_Lumpur). It synchronizes the bilingual README layout, English imagery and release metadata without changing runtime behavior, dependencies, APIs, storage format or stock DSH 0.2.2-rc.2 compatibility.

## 0.2.2 release verification

| Channel | Status |
| --- | --- |
| GitHub source and Release | [v0.2.2 published](https://github.com/MakerFlyFly/DSH-better-classifier/releases/tag/v0.2.2); [Windows preflight CI passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/44927430435) and [main CI passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/44927730034) for the release commit. |
| npm | [0.2.2 published](https://www.npmjs.com/package/dsh-better-classifier/v/0.2.2), `latest` is `0.2.2`; [trusted-publishing workflow passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/44927732148) with provenance. |

- Release source commit: `5f7eec154940cec83b5621b212683e932cfa75c2`, referenced by `v0.2.2`. The user's latest English and Chinese README deletions were preserved before tagging.
- Local verification and both release CI paths passed build, production/test typechecking, packaging, and the existing 108 tests. Runtime source, tests, dependencies, bundle configuration and build/publish scripts are unchanged from `v0.2.1`.
- The publish workflow artifact, npm download and public GitHub installation archive share SHA-256 `58e077cbeb5db0700327d876881dc3d11a351457f1c09b78b36a42ae0547c769`. All five uploaded Release assets were downloaded and compared byte for byte with the workflow artifact before publication; the public installation URL was downloaded and checked again afterward.
- Installing `dsh-better-classifier@0.2.2` from npm through the formal stock DSH 0.2.2-rc.2 CLI passed Host startup, removal/reinstallation, restart, metadata retention, revision-conflict and candidate-filtered SQLite search checks in an isolated Windows profile. Installed Client bytes matched the workflow tarball.
- npm's registered README matches the release source. Its 0.2.2 page renders the English screenshot at the intended width and links to the Chinese README at the same tag; the package includes both language images and the updated English detail page. The npm summary is English. Default npm pages may briefly cache the preceding version after publication; the fixed version URL identifies this release.
- GitHub Release publication completed at `2026-11-21T17:09:13Z` (2026-11-22 01:09:13 Asia/Kuala_Lumpur). The existing `v0.2.1` tag object and installation archive digest remain unchanged. Published tag snapshots retain their build-time status; this document on `main` records subsequent verification.

Public downloads use GitHub Release assets or npm. Actions archives retain the existing 14-day policy and are only build-transfer artifacts; their expiry does not remove the published Release attachments. The 0.2.2 download and image links contain no temporary signed CDN URLs.

## Historical 0.2.1 catalogue submissions

This round updated GitHub and npm only. The following table retains the submission snapshot checked on 2026-11-14; it was not refreshed for this release and does not establish current catalogue status or review of 0.2.2. No new catalogue application or review request was sent.

On 2026-11-14, five catalogue applications had been submitted, the main community index entry was prepared while waiting for the repository-age requirement, and the `dsh-plugin` discovery topic had been restored. Submission alone did not establish acceptance or installation certification.

| Channel | Status |
| --- | --- |
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
