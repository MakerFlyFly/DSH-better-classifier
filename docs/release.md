# Release process

The package version in `package.json` determines tarball, source ZIP, validation, compatibility, and checksum filenames. The GitHub tag must be `v` followed by that exact version.

1. Update the version and changelog, then run the locked install, build, typecheck, package, and test commands documented in the README.
2. Complete real browser validation against the pinned stock DSH version, using synthetic data, and update `docs/validation.md`.
3. Push the reviewed commit to `main` and wait for Windows CI to pass, then tag that exact commit as `v<version>`.
4. Dispatch `publish.yml` from that tag with `dry_run: false`. After its build, typecheck, package, and tests pass, it uploads `npm-release-<commit>` before publishing the same tarball through npm trusted publishing.
5. Download that workflow artifact and create a GitHub Release draft with the files listed in `release-manifest.json`. Do not substitute a separate local or Windows rebuild: CSS export ordering and build paths can change archive bytes.
6. Verify registry installation in stock DSH and compare the npm tarball and Release draft asset SHA-256 with the workflow checksum. Publish the Release only after those checks pass, then record confirmed links in `docs/distribution.md` without moving the release tag.

## npm authentication

The initial publisher completes account registration, email verification, and authentication directly with npm. Do not commit passwords, tokens, OTPs, or `.npmrc` credentials.

After the package exists, configure an npm trusted publisher for GitHub user `MakerFlyFly`, repository `DSH-better-classifier`, workflow `publish.yml`. The workflow needs no `NPM_TOKEN` secret. Check npm's current activation/expiry rules when configuring it: https://docs.npmjs.com/trusted-publishers/.

The npm workflow is manual and defaults to a dry run. A real run requires a matching release tag and explicitly setting `dry_run` to false. Existing npm versions are immutable: do not try to republish one. The first local publish can use the already verified tarball after the publisher signs in; later releases can use trusted publishing.

## Catalogue submissions

Submit only channels whose current rules the package satisfies. Topic discovery, a submitted PR, a merged PR, and an active listing are recorded separately. Do not publish local review notes or test-home logs as release attachments.
