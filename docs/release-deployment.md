# Release and deployment

The manually dispatched **Release and Deploy** workflow (`.github/workflows/release.yml`)
controls releases and production deployment to Coolify. Merging to `main` does not
start this workflow. Run it from GitHub Actions and select at least one action:

| Create release | Create deploy | Result                                                          |
| -------------- | ------------- | --------------------------------------------------------------- |
| Yes            | No            | Run semantic-release on `main` (the default).                   |
| Yes            | Yes           | Release, then deploy the exact resulting commit.                |
| No             | Yes           | Deploy the latest `origin/main` resolved by the deployment job. |

Release requests must run from `main`. Preflight must succeed before deployment;
a failed or cancelled release also prevents deployment. Runs share the
`release-deploy-main` concurrency group with cancellation disabled.

## Releases

The release job uses Node.js 24 and the package manager pinned in `package.json`.
The shared setup action installs dependencies with the frozen lockfile and
initializes Nuxt, so it needs the existing build-time environment access.

`.releaserc.cjs` configures semantic-release for `main`. Conventional Commits
determine the version: fixes normally produce patch releases, features minor
releases, and breaking changes major releases. Commits without a release-triggering
change do not create a version.

### Experimental version baseline

The experimental release history starts at `0.1.0`. The former `1.0.0`,
`1.1.0`, `1.1.1` and `1.2.0` releases and tags were removed, and their changelog
entries consolidated under `0.1.0`. Git commit history is preserved.

After committing and merging the version reset to `main`, create the baseline
on that exact commit before dispatching another release:

```sh
git tag v0.1.0 <reset-commit-sha>
git push origin v0.1.0
```

The workflow requires this tag to be an ancestor of the release commit.
Without a baseline tag, semantic-release defaults to `1.0.0`, regardless of the
version in `package.json`. With the baseline, fixes produce `0.1.1` and features
produce `0.2.0`. Breaking changes still produce `1.0.0`; review those intentionally
before dispatching a release. This reset does not publish a replacement GitHub
release or deploy the application.

A release updates `CHANGELOG.md` and the version in `package.json`, commits them
with `chore(release): <version> [skip ci]`, creates a `v<version>` tag and publishes
a GitHub release. It does not publish an npm package. The workflow captures local
`HEAD` after semantic-release finishes and passes that SHA to deployment. This
includes the generated release commit and prevents later merges from changing the
deployed revision. If semantic-release finds no releasable changes, deployment
still proceeds when selected, using the commit analyzed by that run.

The release job does not rerun lint, type checks or tests. Verify the intended
changes before dispatch and configure branch protections to enforce required
checks. The pull-request workflow runs lint, type checks, and unit and HTTP e2e tests; see
[development](development.md) and the [testing guide](../tests/README.md) for local checks.

## Coolify deployment

`.github/workflows/deploy_coolify.yml` is reusable through `workflow_call`; it has
no standalone manual dispatch. The release workflow calls it with the GitHub
`production` environment, whose protection rules apply to the deployment job.
It requires access to the `blacksmith-2vcpu-ubuntu-2404` runner.

The reusable workflow accepts an `environment` and optional `commit_sha` or `tag`.
These revision inputs are mutually exclusive. A SHA must be a full 40-character
commit ID present in the fetched repository. A tag resolves to its commit; with
neither input, the workflow resolves the current `origin/main`. The manual release
workflow supplies the SHA when releasing; it does not expose tag selection.

Deployment authenticates to Proton Pass, reads the Coolify credentials, updates
`git_commit_sha` on the selected application, and calls Coolify's deployment API.
Coolify builds and runs the application; GitHub Actions does not upload a build
artifact. Configure the correct repository, Node.js version, pinned package manager,
production environment, service credentials and build/start commands in Coolify.
The Node server commands are `corepack pnpm build` and `corepack pnpm start`.
Module initialization requires secrets-provider and service access during the build;
see [development](development.md) for environment requirements.

A successful workflow means Coolify returned a deployment UUID. It does **not**
wait for build completion or application health. Check that UUID in Coolify and
verify the deployed application's health and `/mcp` endpoint before treating the
rollout as complete. Disable Coolify's automatic push deployments if this workflow
should be the sole deployment trigger.

## Required configuration

Configure these GitHub Actions secrets at repository or organization scope for the
release workflow (deployment secrets can also use the selected environment's scope):

| Secret                              | Purpose                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `RELEASE_APP_ID`                    | GitHub App ID for release authentication.                                  |
| `RELEASE_APP_PRIVATE_KEY`           | Private key for that GitHub App.                                           |
| `PROTON_PASS_PERSONAL_ACCESS_TOKEN` | Proton Pass access for dependency setup and Coolify credential resolution. |
| `PROTON_VAULT`                      | Vault containing the deployment credentials in its `ci` item.              |

Install the release GitHub App on this repository and grant the permissions needed
by semantic-release: contents, issues and pull requests write access. Allow its
release commits through the applicable branch rules.

The Proton Pass token must have access to the application's environment items and
to these fields in `pass://<PROTON_VAULT>/ci/<field>`:

| Field              | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| `COOLIFY_URL`      | Coolify base URL, without `/api/v1` or a trailing slash.               |
| `COOLIFY_APP_UUID` | This project's Coolify application UUID.                               |
| `COOLIFY_TOKEN`    | API token authorized to update the application and trigger deployment. |

The GitHub environment name does not select another Coolify application or Varlock
profile: the credentials and Coolify configuration determine the target. Confirm
the application UUID belongs to this project when copying workflows between projects.
