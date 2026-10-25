> **Needed because:** the BDD scaffold/run sequence and binding scope are not surfaced by txc help.
> **Remove when:** txc surfaces sequences in help/docs (T12), and the UI test templates are fixed
> (TALXIS/tools-devkit-templates#182, TALXIS/tools-cli#207).

# UI testing with Playwright + Reqnroll

**Contract:** when this task ends, `<ui test project>` exists with at least one feature
file, and `dotnet build "<ui test project>"` passes. Where the machine allows it,
Playwright browsers are installed too. Scaffolding and building are local; `dotnet test` runs against the
live environment configured in `appsettings.json`.

**What the template covers.** `pp-test-ui` ships frozen step bindings (under
`Support/Bindings/`) for model-driven app surfaces: forms, views, the command bar,
and navigation. They navigate via the model-driven URL shape
(`main.aspx?appname=...`), so they only work for model-driven apps. Custom apps
(code apps — standalone SPAs) need hand-authored step definitions; put those in
`StepDefinitions/` to signal "ours, not template-shipped".

## Step 1 — Scaffold the test project

Resolve `<ui test project>` per the `init` skill's `workspace-layout` reference file
(default `src/Tests.UI`; an existing repository's names win). Scaffold `pp-test-ui`
into it and `dotnet sln add` it (the template does not add itself).
No `Features/` folder exists yet.

## Step 2 — Add a feature file

One `.feature` file per product feature under test, PascalCase name — scaffold `pp-test-ui-feature` into
`<ui test project>` with `--param "name=<FeatureName>"` (`parameter list` shows no
parameters for this template). It creates an empty `Feature: <FeatureName>` stub in
`<ui test project>/Features/` — write the real scenarios into it. The same command also
drops a `Calculator.feature` sample there (and its `.feature.cs`); delete it, its steps
are unbound. Reqnroll generates the `.feature.cs` designer
file from it at build time; nothing else to create.

## Step 3 — Write scenarios (BDD discipline)

Scenarios speak business language so domain experts can read and challenge them:

- **Given** sets context, **When** is one action, **Then** is an observable outcome.
- 3–5 steps per scenario, total.
- Selectors and waits live in step definitions, never in feature files.
- Prefer `data-*` / test-id selectors over display text — display text breaks with
  localization.
- Never hard-sleep — wait for a specific element instead.

For model-driven surfaces, phrase steps to match the frozen bindings (open app,
open view, open record, fill field, press command, assert value). For code apps,
write the steps you need as C# classes in `<ui test project>/StepDefinitions/` following
the same rules.

## Step 4 — Configure

`<ui test project>/appsettings.json` holds the Dataverse environment URL, app name, and Playwright
options. Every setting can be overridden per run with a `TXC_`-prefixed operating-system
environment variable (the keys are in the file; the `TXC_` variables are read in
`Support/TestConfiguration.cs`).

`StorageStatePath` must be an **absolute** path — relative paths resolve from the
test binary output directory (`bin/Debug/<tfm>/`) and are silently ignored by
Playwright. Set `TXC_STORAGE_STATE_PATH` at run time for a portable override.

Headless runs need a captured auth state (on a machine with a display):

```
playwright-cli open --browser=msedge --headed <env-url>
playwright-cli state-save <ui test project>/auth-state.json
playwright-cli close
```

Never commit `auth-state.json` — it holds live session cookies. The template's
`.gitignore` only covers `playwright-auth-state.encrypted`, so add this file to it.

## Step 5 — Build and install browsers

```
dotnet build "<ui test project>"
pwsh "<ui test project>/bin/Debug/<tfm>/playwright.ps1" install chromium
```

The build emits `playwright.ps1`; `<tfm>` is the target framework directory the
build created under `bin/Debug/` (e.g. `net8.0`). The build must pass before you
finish.

## Step 6 — Run

```
dotnet test "<ui test project>" --configuration Release
```

Headless (CI, Codespaces): set `TXC_HEADLESS=true` in the environment.

## Step 7 — CI workflow (optional)

Live runs need the captured auth state, so keep the workflow manual
(`workflow_dispatch`) until state handling in CI is decided. `.github/workflows/test.yml`
(substitute `<ui test project>` with its real folder, see Step 1):

```yaml
name: test
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.x'
      - run: dotnet test <ui test project> --configuration Release
        env:
          TXC_HEADLESS: 'true'
```

## Pyramid note

UI tests are the top of the test pyramid, not the whole pyramid: keep fast unit
layers underneath (FakeXrmEasy plugin tests, Jest script tests) as required PR
checks, and keep the UI suite thin — key user journeys, not field-by-field coverage.
