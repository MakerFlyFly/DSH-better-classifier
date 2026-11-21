# Release process

The package version in `package.json` determines tarball, source ZIP, validation, compatibility, and checksum filenames. The GitHub tag must be `v` followed by that exact version.

1. Update the version and changelog, then run the locked install, build, typecheck, package, and test commands documented in the README.
2. Validate changed behavior and documentation in the browser, using the pinned stock DSH version and synthetic data where applicable, and update `docs/validation.md`. For documentation-only releases, record the unchanged-runtime comparison and new packaging/install/display checks separately from historical functional tests.
3. Push the reviewed commit to `main` and wait for Windows CI to pass, then tag that exact commit as `v<version>`.
4. Dispatch `publish.yml` from that tag with `dry_run: false`. After its build, typecheck, package, and tests pass, it uploads `npm-release-<commit>` before publishing the same tarball through npm trusted publishing.
5. Download that workflow artifact and create a GitHub Release draft with the files listed in `release-manifest.json`. Do not substitute a separate local or Windows rebuild: CSS export ordering and build paths can change archive bytes.
6. Verify registry installation in stock DSH and compare the npm tarball and Release draft asset SHA-256 with the workflow checksum. Publish the Release only after those checks pass, then record confirmed links in `docs/distribution.md` without moving the release tag.

## Download links and artifact retention

GitHub Releases and npm are the public download channels. Link to the versioned `releases/download/v<version>/<asset>` URL or the release page, not to a workflow artifact or the signed CDN URL returned by a download redirect. Release assets do not use the Actions artifact-retention policy.

Both workflows retain Actions artifacts for 14 days. These archives transfer the verified build into the release process; their expiry does not delete files already attached to a GitHub Release. Keep the 14-day policy and copy the tagged publish workflow's exact verified files into the Release before the temporary artifact expires.

Use fixed-tag raw GitHub URLs for README images and explicit GitHub URLs for language/document links so the same README renders on GitHub and npm. npm updates its README when a new package version is published; changing the GitHub default branch alone does not update npm's stored README. Never overwrite a previously published version or replace its release assets to update documentation.

## npm authentication

The initial publisher completes account registration, email verification, and authentication directly with npm. Do not commit passwords, tokens, OTPs, or `.npmrc` credentials.

After the package exists, configure an npm trusted publisher for GitHub user `MakerFlyFly`, repository `DSH-better-classifier`, workflow `publish.yml`. The workflow needs no `NPM_TOKEN` secret. Check npm's current activation/expiry rules when configuring it: https://docs.npmjs.com/trusted-publishers/.

The npm workflow is manual and defaults to a dry run. A real run requires a matching release tag and explicitly setting `dry_run` to false. Existing npm versions are immutable: do not try to republish one. The first local publish can use the already verified tarball after the publisher signs in; later releases can use trusted publishing.

## Catalogue submissions

Submit only channels whose current rules the package satisfies. Topic discovery, a submitted PR, a merged PR, and an active listing are recorded separately. Do not publish local review notes or test-home logs as release attachments.
