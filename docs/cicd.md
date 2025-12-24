## CI/CD

This repository uses GitHub Actions for CI/CD. All workflows live in `.github/workflows`.

### Workflows

1. `ci.yml`
   - Triggers: push to `main`, all PRs.
   - Jobs: auth to GCP (gh-actions/auth + setup-gcloud), set `NODE_AUTH_TOKEN` via `gcloud auth print-access-token`, install (`npm ci`), lint, format check, build, test, coverage, upload coverage (artifact + Codecov if token), npm audit (prod deps, high+). Dependency review runs on PRs.

2. `release.yml`
   - Trigger: pushing a semver tag `v*.*.*`.
   - Steps: auth to GCP (gh-actions/auth + setup-gcloud), set `NODE_AUTH_TOKEN` via `gcloud auth print-access-token`, install, lint, format check, build, test, coverage, upload coverage (artifact + Codecov if token), `npm pack`, publish to Artifact Registry, auto-generate release notes, create GitHub release and attach the tarball.

3. `security.yml`
   - Triggers: scheduled daily at 06:00 UTC, manual dispatch.
   - Jobs: npm audit (prod deps, high+), lint, format check, CodeQL JS/TS scan.

### Required secrets / config

- `GCP_CREDENTIALS`: JSON key for service account `success-admin-service-account@customer-support-success.iam.gserviceaccount.com` (must have artifactregistry.writer, and secretAccessor if secrets are used).
- Ensure repository Actions permissions allow `contents: write`, `packages: write`, `id-token: write` for releases.
- (Optional) `CODECOV_TOKEN` if Codecov is used; CI uploads coverage when present.

### Release process

1. Merge changes to `main`.
2. Tag with semantic version: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The `release` workflow will build, test, publish the npm package, and create a GitHub release with generated notes and the `.tgz` artifact.
