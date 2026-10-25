---
name: deploy
description: Ships a TALXIS / Power Platform / Dataverse app — connects environments, builds the deployable package, deploys it, pulls remote changes back, and sets up the release pipeline. Use when creating or connecting an environment, deploying, releasing, or automating CI/CD.
---

# Deploy

**Contract:** this is the one skill that touches the cloud — creating and
connecting environments, and importing the package. Deploy only when the user asked.
Everything else in this workspace stays local-first: build components locally and
deploy them; never edit a live environment as a substitute for local work.

## Ask the CLI first

```
txc config --help                # auth, connections, profiles
txc environment --help           # live-environment operations
txc docs get deployment-workflow # long-form guide
txc docs get solution-layering   # managed/unmanaged Dataverse solutions
```

## Connect an environment

Bootstrap order is fixed: **auth → connection → profile → select**
(`txc config auth login`, `txc config connection create`,
`txc config profile create`, `txc config profile select`). Verify with
`txc config profile validate [<name>]` (txc before 1.22 requires the name) before any environment operation. Default setup:
environments are cheap and ephemeral (source control is the source of truth) and each
developer has their own Dev environment; follow the team's existing setup if it
differs ([references/environments.md](references/environments.md)).

## Build the artifact

`dotnet build` validates; `dotnet publish` of the package project in
**Release** packs **managed** solutions (test/prod), **Debug** packs
**unmanaged** (dev). The Package Deployer package (`.pdpkg.zip`) is a single deployable
zip composing all Dataverse solutions the package project references, in dependency order.

## Deploy and round-trip

The everyday loop (change → push to Dev → verify it landed → pull back) is in
[references/inner-loop.md](references/inner-loop.md); the steps below are the details.

1. Import dependency packages first (e.g. the NuGet package of a PCF control the app
   uses), then the repository's own Package Deployer package:
   `txc environment package import`. A success exit code is not proof: Package Deployer
   skips a solution whose version is already installed, and local builds always produce
   the same version — verify the content landed, and push a local change to a Dev
   environment as a solution zip instead (`deployment` reference).
2. After edits made directly in a live dev environment, pull them back into
   source: `txc environment solution pull` — then commit. The pull overwrites source
   with the environment's state: push or commit your own changes first. CMT data packages
   (records, not components) round-trip the same way (`txc data package export` / `import`;
   [deployment](references/deployment.md); authoring them: `data-model` skill).
3. On failure: check the latest deployment record, then component layers, then
   missing dependencies — never retry more than twice without diagnosing.

## Invariants

- Production contains **managed** Dataverse solutions only; the unmanaged working state
  lives in dev and in source control.
- A managed (Release) package cannot overwrite an existing unmanaged Dataverse solution (or
  vice versa) — uninstall first.
- CI/CD uses OIDC federation — identifiers only, no stored secrets
  ([references/ci-cd.md](references/ci-cd.md); GitHub Actions is the default host, an
  existing pipeline or another host is kept).

Details: [references/](references/) — inner-loop, environments, build, deployment, layering,
ci-cd (+ workflow, ruleset and application-user files)
