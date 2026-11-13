# 0.2.1 validation / 验证记录

Version 0.2.1, verified on 2026-11-13 with Windows x64, Node.js 24.14.0, pnpm 11.28.5, and the published, unmodified `@deepseek-ai/dsh@0.2.2-rc.2`. Confirmed release links and registry-install results are recorded in [distribution status](distribution.md).

## Automated verification

- Production Host/Client builds and separate Host/Client test typechecks pass.
- 106 tests in 15 files cover deterministic blank/pinned/mixed ordering, dissolving folders with missing parent ranks, duplicate siblings, Unicode names, unloaded identities, atomic CAS, unchanged transactions, failed writes, and tag drafts.
- Lifecycle regressions cover simultaneous retries, disposal, late snapshots and write replies after a stream failure, search reveal through the real native row, and folded Ungrouped navigation.
- Real SlotRegistry tests cover initial startup ownership, nested contributions before/after activation, partial-install rollback, owner replacement, automatic recovery, and queued work during unload.
- Actual RemoteAccessService decisions reject ungranted classification actions and allow owner access. Generated strict codecs reject malformed search arguments. These are authorization/codec boundary tests, not a full HTTP Gateway penetration test.
- Stock body-search tests retain candidate/access filtering before the result limit, the outside-top-20 regression, cancellation, deduplication, forged hits, and cursor protection.
- Real configuration parsing/patch composition confirms the bundle's first-search index default and later user overrides, including an in-memory index and disabled indexing.
- Archive tests cover root/nested ignore rules without Git, case-insensitive private paths, the environment-example exception, lockfiles/test configs, and required npm runtime files.
- The formal DSH CLI installs the tarball, starts the Host, removes/reinstalls the plugin, and starts it again with persisted metadata intact. Fixture modules now have a separate private package boundary and cannot contribute this repository's Client.
- A source ZIP was extracted outside any Git worktree, installed with the frozen lockfile, and built/tested without a DSH checkout or source symlink. GitHub and npm use the same verified tarball from the tagged publish workflow; archive identity is checked again after publication.

## Browser replay

Only synthetic projects, conversations, folders and tags were used. After seeding, the review was restarted with the installed package and no fixture overlay for lifecycle checks.

- Chinese body search displays the expected snippet and ancestor path; opening the result clears search, opens the conversation, and reveals its classification.
- Same-page tag selection, new tag definitions, custom blue/purple/light colors and a long label were exercised in the live UI.
- Wide rows displayed all four tags without +N; narrow rows displayed one tag plus +3 without overlap. Measured tag-to-time separation was 8px and the long sidebar tag was capped at 88px.
- Light/dark themes and a 390 CSS px navigation drawer were inspected. The narrow page had no horizontal overflow.
- Empty-area right-click created a root folder and focused it; the real Menu key opened the same action. Object rows retained their own menus.
- Browser pointer actions moved a conversation into its project folder and a project into an outer folder; both changes were independently confirmed in persisted metadata.
- Plugin disable restores the native list. Re-enable restores classifications and tags. An initial asynchronous registration window exposed a hot-enable scope error during review; initial registration now completes inside plugin startup. The corrected installed build's subsequent enable checks restored the tree with no new scope errors.

Human verification completed the two checks the driver could not reliably perform: dragging the test folder into its intended parent and opening “New folder” with Shift+F10 from list whitespace. The user confirmed both passed; persisted metadata independently confirms the nested parent relationship and revision 8 → 9. These are recorded as human checks, not successful driver actions. No pending acceptance checks remain from this review.

## Upgrade and performance

A copy of existing version-1 metadata loaded in a fresh stock profile without changing its bytes or revision. Folders, direct tags, placements, ordering and unloaded IDs were retained; the original data file was independently checked unchanged.

An illustrative same-machine 10,000-session probe improved tree construction from about 97ms to 24.1ms and a bulk tag-association operation from about 499ms to 28ms. These single-run measurements are not cross-machine performance guarantees.

## Compatibility and remaining boundaries

Compatibility remains limited to stock DSH 0.2.2-rc.2 on the platform above. Unsupported nested mirrored contributions now cause a safe fallback rather than interrupting another plugin's registration; this does not claim full feature coexistence with every replacement sidebar.

No migration, automatic pruning of unloaded identities, new DSH patch, or multi-instance cloud sync was introduced. Full-text indexing and user configuration precedence are documented in both READMEs. Local profiles, credentials, logs, authentication URLs and review work records are excluded from distributable archives.
