# Distribution status / 分发状态

Package: `dsh-better-classifier` · Published: `0.2.1` · Repository: [MakerFlyFly/DSH-better-classifier](https://github.com/MakerFlyFly/DSH-better-classifier)

0.2.1 is available on GitHub and npm. Publication, archive identity, and registry installation were verified on 2026-11-14 (Asia/Kuala_Lumpur). No new catalogue submission is included. Withdrawal requests for earlier submissions remain unchanged; those requests do not establish that a site's operator has completed removal.

| Channel | Status |
| --- | --- |
| GitHub source and Release | [v0.2.1 published](https://github.com/MakerFlyFly/DSH-better-classifier/releases/tag/v0.2.1); [Windows CI passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/43459769538) |
| npm | [0.2.1 published](https://www.npmjs.com/package/dsh-better-classifier/v/0.2.1), `latest` is `0.2.1`; [trusted-publishing workflow passed](https://github.com/MakerFlyFly/DSH-better-classifier/actions/runs/43460301031) with provenance |
| [DSHX](https://dshx.io/en/plugins) | Earlier submission received; withdrawal requested on 2026-11-13, operator completion unconfirmed |
| [DSH Plugin Registry](https://dshplugin.app/submit) | Earlier submission received; withdrawal requested on 2026-11-13, operator completion unconfirmed |
| [DSH Marketplace](https://dshmarketplace.dev/submit) | Earlier submission received; withdrawal requested on 2026-11-13, operator completion unconfirmed |
| [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) | Entry prepared; the repository-age requirement is met after 2026-11-14 11:18:21 UTC |
| [ydhrdh/dsh-marketplace](https://github.com/ydhrdh/dsh-marketplace) | [PR #24](https://github.com/ydhrdh/dsh-marketplace/pull/24) closed, not merged; reconfirmed on 2026-11-13 |
| [dsh.pub](https://dsh.pub/en/submit/) | Its Git-source validator requires committed runtime entries; this repository distributes compiled entries through release archives instead |

Submitted, awaiting review, and listed are distinct states. Release source snapshots retain their build-time status. A discovery topic or a submission receipt alone is not proof of current catalogue inclusion.

## 0.2.1 release verification

- Release source commit: `4c84a943effb802e5edd192dcb65c1a60ed51ce8`, referenced by `v0.2.1`.
- Windows CI and the tagged publish workflow passed build, production/test typechecking, packaging, and all 108 tests. Two publication-path regression tests were added after npm interpreted an unprefixed archive path as a Git shorthand; the successful release uses an explicit local file spec.
- The workflow artifact, npm download, and GitHub Release tarball have the same SHA-256: `cd903239606e6aa2dc87ce6247c6387ce7cf91e56e6bf5bd8699d3ec98b4e169`. All five Release assets were downloaded and compared with the workflow artifact.
- Installing `dsh-better-classifier@0.2.1` from npm through the formal stock DSH 0.2.2-rc.2 CLI passed Host start, restart, uninstall/reinstall, candidate-filtered SQLite search, and metadata-persistence checks in an isolated Windows profile.
- GitHub Release publication completed at `2026-11-13T16:19:12Z` (2026-11-14 in Asia/Kuala_Lumpur). This status update does not move the published release tag or replace its assets.
