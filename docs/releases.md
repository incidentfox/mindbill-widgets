# Releases

Packages are published only from GitHub Actions with npm trusted publishing and provenance. Workstation tokens are not supported.

## Maintainer setup (one time)

1. Verify the `mindbill` npm organization is controlled by IncidentFox and requires 2FA.
2. Create each package on npm or perform the first publish through an authenticated, 2FA-protected maintainer session.
3. Configure npm trusted publishers for repository `incidentfox/mindbill-widgets`, workflow `release.yml`, and GitHub environment `npm`.
4. Protect the `npm` environment with required reviewers.
5. Confirm package access is public and provenance is visible.

## Release

Update package versions and changelogs in a pull request. After merge, create a GitHub release tagged `sdk-vYYYY.MM.DD` (append `.2`, `.3`, and so on for multiple release trains on one day). The workflow runs all checks, compares local versions with npm, and publishes only versions not already present. It uses GitHub OIDC (`id-token: write`) and does not require a long-lived `NPM_TOKEN`.

The three packages may have independent versions; the GitHub tag is a release-train label rather than the source of package versions.
