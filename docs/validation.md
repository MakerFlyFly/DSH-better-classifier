# 0.2.0 validation / 验证记录

Validated on 2026-11-13 using Windows x64, Node.js 24.14.0, pnpm 11.28.5, and the published, unmodified `@deepseek-ai/dsh@0.2.2-rc.2` CLI.

## Automated checks

- Host and Client build, TypeScript checks, and 58 tests covering classification rules, tag drafts, search, lifecycle, persistence, conflicts, failed writes, and immutable publish-tag guards.
- The real CLI/Loader installs the packed archive, starts the Host twice, and uninstalls/reinstalls the plugin between starts while retaining metadata.
- The archive downloaded from GitHub Release has the same SHA-256 as the successful CI artifact. Its installed Client is checked against the archive itself, and clean install/uninstall/reinstall passed. Local rebuilds may differ in build-path comments and CSS-map property order, so they are not used as a byte-equality reference for an external CI artifact.
- Stock SQLite body search respects candidate IDs and permissions before the result limit. Cases cover a matching session beyond 25 excluded matches, duplicate/forged hits, cancellation, and repeated cursor rejection.
- Real SlotRegistry tests check native callback/store sharing, late contributions, unloading, re-enabling, and native-owner replacement.
- A fresh source-archive extraction installs locked npm dependencies and builds without a DSH checkout or development symlinks.

## Real browser checks

- Native project rename dialogs, session menus, pin/unpin, archive/unarchive, archive filters, and the search shortcut.
- Tree-shaped body search with a Chinese query and snippet; direct-tag container matches start collapsed.
- Empty-space right-click and Shift+F10; cancel preserves search, successful root-folder creation clears search and focuses the new folder; project-menu creation keeps project scope.
- Same-page tag selection/removal and separate creation/editing drafts, light/dark themes, width-dependent tag visibility, and an 8 px gap before the time.
- A 390 CSS px sidebar drawer keeps the empty-space menu in view without horizontal overflow.
- Disabling removes the classification view and restores the native list; enabling restores classification data.

## Drag-and-drop release gate

On 2026-11-13 a human-operated pointer completed the following actions in a separate instance containing only synthetic fixtures. The saved metadata and the refreshed page were checked independently:

| Action | Persisted result |
| --- | --- |
| Move a global folder into another global folder | Parent changed to the intended folder; revision 4 → 5 |
| Move a project into the nested global folder | Project placement points to that folder |
| Move a conversation into its project's folder | Conversation placement points to the project-scoped folder |
| Move that conversation before its sibling | Both IDs are stored in the requested manual order; final revision 8 |

Cycle rejection and cross-project restrictions are covered by domain tests; the drag start/drop/single-target/manual-order path is covered by component interaction tests. Earlier automation-driver attempts that did not complete HTML5 drop were not counted as successful browser tests. The later manual-pointer checks close that release gap.

## Upgrade and limits

An old version-1 metadata copy was loaded in a fresh stock profile. Its bytes, revision, folders, direct tags, placements, and manual-order records remained unchanged. Unloaded project/session IDs were retained. The original profile was not modified.

Compatibility is pinned to the host/platform above. Other plugins that replace the left list, or contribute nested child-slot declarations to mirrored seats, need separate compatibility work. A subscription may report its end while disabling the Host before the client unloads; normal view restoration and re-enable were verified. These checks do not claim exhaustive long-duration connection stability.

All fixture and documentation imagery is synthetic. Test homes, authentication URLs, local logs, and personal data are excluded from public artifacts.
