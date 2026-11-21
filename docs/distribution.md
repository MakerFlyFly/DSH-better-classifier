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

## Catalogue status checked on 2026-11-22

This round adds one application to the main community index. Existing listings keep their normal update process: no duplicate submission, version reminder, or new review request was sent to the other markets. No plugin/package changes or new release were made for this submission.

| Channel | Observed state and action |
| --- | --- |
| Main community index / awesome-dsh-plugin.com / dshmarket.com | [PR #17641](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/17641) submitted for 0.2.2. The [complete PR check](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/actions/runs/44931830909) and [Submission gate](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/runs/136941531591) passed. Maintainer review, merge and public inclusion are pending. |
| Workshop / dsh-market.com | [PR #108](https://github.com/zhu1090093659/dsh-community-plugins/pull/108) was merged on 2026-11-15. The entry is present in the [production manifest](https://dsh-market.com/manifest/plugins.json), referring to the unpinned npm package name. No new application needed. |
| DSH Plugin Hub / dsh-plugin.org | [Issue #773](https://github.com/dshplugin/dsh-plugin-hub/issues/773) was accepted. The entry is present in the [live English catalogue](https://api.dsh-plugin.org/plugins.en.json); its displayed release was v0.2.1 at this check, with an unpinned npm install command. Leave normal synchronization in place. |
| Open Plugin Market / dshopen.org | [Issue #486](https://github.com/polang233/dsh-plugin-index/issues/486) was completed. The [public index](https://dshopen.org/index.json) contains the reviewed 0.2.1 entry. This does not establish review of 0.2.2; no new review request was sent. |
| DSH Market / dsh.market | [Issue #382](https://github.com/2BingLing/dsh-market/issues/382) was completed with a listing confirmation. The entry is present in the [published data](https://dsh.market/plugins.json); the captured install command still names 0.2.1. Leave the periodic refresh in place. |

The existing Radar PR and the deferred channels below were not changed. Submission, CI success, maintainer approval, merge, and appearance in a public catalogue remain separate states.

### Main-index submission preflight

Rules were checked against upstream commit `953a390d942709fb42f827a4f9cbf817f1a3640e`: the full [contribution guide](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/953a390d942709fb42f827a4f9cbf817f1a3640e/contributing.md), [PR template](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/953a390d942709fb42f827a4f9cbf817f1a3640e/.github/pull_request_template.md), and relevant CI/gate requirements. No AGENTS.md files were present in that tree. No exception was inferred from another submission's acceptance.

| Requirement | Evidence and result |
| --- | --- |
| Public, active repository; minimum age; discovery topic | GitHub confirms a public, non-archived repository created 2026-11-13T11:18:21Z with `dsh-plugin`. The one-day age requirement is met; the guide has no commit-count floor. |
| Real, installable DSH bundle | Root `dsh.bundle.patch` and the included `cordis.patch.yml`, prebuilt Host/Client entries, MIT license, matching npm repository identity, and the verified 0.2.2 installation above. Official runtime packages are peers. |
| Valid, nonduplicate entry | Exactly one `data/plugins/MakerFlyFly__DSH-better-classifier.yml` file added; `session` category, factual English/Chinese descriptions, no existing entry/issue/PR for the same repository. No generated README or other plugin entry changed. |
| Download and imagery | Fixed 0.2.2 GitHub Release tarball and declared JPEG return HTTP 200. Root `screenshots.json` meets the documented image rules. No unsupported SVG tile, manual npm mapping, or legacy screenshot entry was added. |
| Local schema and metadata gate | `readEntries`/`validateEntries`: 12,498 entries, zero errors. `check-submission`: one checked entry, zero failures and zero incomplete checks. |
| Related checks | 30 upstream regression tests and `git diff --check` passed locally. Upstream CI also passed README regeneration, awesome-lint, regression tests and the full site build. Its separate Submission gate passed for PR head `60d289473766e0850b301cec018018576cd0e7c4`. |

## Historical 0.2.1 catalogue submissions

The 0.2.2 package-release round updated GitHub and npm only, before the later main-index application recorded above. The following table preserves the 2026-11-14 submission snapshot; it does not establish current catalogue status or review of 0.2.2. No catalogue application or review request was sent as part of that package-release round.

On 2026-11-14, five catalogue applications had been submitted, the main community index entry was prepared while waiting for the repository-age requirement, and the `dsh-plugin` discovery topic had been restored. Submission alone did not establish acceptance or installation certification.

| Channel | Status |
| --- | --- |
| [Main community index](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) | At the 2026-11-14 check, one `session` entry was prepared with the pinned 0.2.1 tarball but had not been submitted. The repository-age gate became satisfied at 2026-11-14 11:18:21 UTC. See the later 0.2.2 submission above for the current application. |
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
