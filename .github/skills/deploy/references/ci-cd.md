> **Needed because:** workflow YAML, ruleset JSON, and the OIDC sequence have no txc equivalent.
> **Remove when:** txc scaffolds pipelines/rulesets or surfaces them in docs (T12).

# CI/CD with GitHub Actions and OIDC

**Contract:** when this task ends, `.github/workflows/build.yml` and `deploy.yml`
are committed, `main` accepts changes only through pull requests that pass the
`build` check, and every push to `main` deploys the package to the test environment
via workload identity federation. No secret material is stored — only identifiers
(client id, tenant id, environment URL). This reference talks to GitHub and Entra ID;
run it only when the user asked for CI/CD.

**Defaults, not requirements:** GitHub Actions as the host, `main` as the default branch
(read it from the repository) and the branching model below. If the repository already
has another CI host, branch name or branching convention, keep it and apply these steps
(build, publish the package, import with a federated identity) in its terms.

**Branching model (default) — trunk-based.** Everyone integrates into the default
branch through short-lived topic branches (a day or two, named `users/<name>/<topic>`
unless the repository has its own branch convention) and pull requests. Long-lived
feature branches drift away from it and end in merge hell: the longer a branch lives,
the bigger and riskier the merge.

## Step 1 — Prerequisites and inputs (once)

Verify sign-ins, then gather everything up front and do not re-prompt:

```
gh auth status
az account show --query tenantId -o tsv
gh repo view --json nameWithOwner -q .nameWithOwner
```

1. **GitHub repository** `<owner>/<repo>` — from `gh repo view` above (the origin remote,
   not an upstream parent).
2. **Tenant id** — from `az account show` above.
3. **Test environment URL** — e.g. `https://yourenv.crm4.dynamics.com`, no trailing slash.
4. **Deploy app name** — display name of the Entra app registration CI signs in as (not
   the app being built), e.g. `<repo>-deploy`.
5. **Required PR approvals** — 0 suits a solo repository; a real team requires >= 1.

Pushing files under `.github/workflows` needs the `workflow` scope; if
`gh auth status` does not list it:

```
gh auth refresh -h github.com -s workflow
```

## Step 2 — Protect main

Create a branch ruleset on the default branch: no direct pushes (PRs only), no
deletion, no force pushes. Exact JSON payload and `gh api` commands:
[ci-cd-branch-ruleset.md](ci-cd-branch-ruleset.md). Keep the ruleset `id`
from the response — the build-check update below needs it.

## Step 3 — Federated deploy identity (Entra)

App registration + service principal, then a federated credential trusting this
repository's `main` branch:

```
appId=$(az ad app create --display-name <deploy-app-name> --query appId -o tsv)
az ad sp create --id $appId
```

Write `fed.json` (the `subject` must match owner/repo exactly):

```json
{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<owner>/<repo>:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}
```

```
az ad app federated-credential create --id $appId --parameters @fed.json
```

## Step 4 — Application user in the test environment

The service principal must exist as an application user in the Dataverse test
environment. Do it via the Dataverse OData API — `pac admin assign-user` requires an
interactive pac auth profile that is not available in CI or headless shells, while
`az` is already authenticated. Exact call sequence:
[ci-cd-application-user.md](ci-cd-application-user.md).

Least-privilege note: System Administrator is the simple default; in production give
the deploy principal a custom security role scoped to what package imports actually need, and
never a tenant-level Power Platform admin role.

## Step 5 — Secrets and workflows

Store the three identifiers as repository secrets (identifiers, not credentials —
with OIDC there is nothing here to leak and replay):

```
gh secret set AZURE_CLIENT_ID    --repo <owner>/<repo> --body $appId
gh secret set AZURE_TENANT_ID    --repo <owner>/<repo> --body <tenant-id>
gh secret set DATAVERSE_TEST_URL --repo <owner>/<repo> --body <test-env-url>
```

On a fork, GitHub Actions is disabled by default:

```
gh api -X PUT "repos/<owner>/<repo>/actions/permissions" -F enabled=true -f allowed_actions=all
```

Copy `build.yml` and `deploy.yml` from
[ci-cd-workflows.md](ci-cd-workflows.md) into `.github/workflows/`,
substituting its placeholders (solution file, package project). `build` compiles
Release on every PR and push to main and publishes the `.pdpkg.zip` as the `drop`
artifact; `deploy` triggers via `workflow_run` when build succeeds on main, requests
an OIDC token (`permissions: id-token: write`), and imports the package through a
txc federated profile. Land them through a topic branch and PR — main is protected
now, and the PR exercises the loop you just built.

## Step 6 — Require the build check

After the `build` workflow has reported at least once, update the ruleset so PRs
cannot merge unless `build` passes and the branch is up to date with main. The PUT
replaces the whole `rules` array — send every rule, not just the addition; payload
in [ci-cd-branch-ruleset.md](ci-cd-branch-ruleset.md). Broken builds
can no longer reach main.

## Step 7 — Validate and summarize

```
gh pr checks <pr-number> --watch
gh run list --workflow deploy --limit 1
```

A PR must show `build` as a required check; after it merges, the deploy run must
finish successfully against the test environment. Report exactly: the ruleset name
and rules, the app registration (client id) and its federated credential subject,
the three secrets set, and both workflow files committed.
