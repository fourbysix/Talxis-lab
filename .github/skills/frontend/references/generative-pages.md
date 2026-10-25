> **Needed because:** the page + sitemap wiring sequence is not surfaced by txc help.
> **Remove when:** txc surfaces sequences in help/docs (T12), and the build SDK packs
> generative pages (TALXIS/tools-devkit-build#131) and the scaffold builds as generated
> (TALXIS/tools-devkit-templates#188).

# Create a generative page

**Contract:** when this task ends, the `<page project>` exists,
it is referenced from `<ui solution>`, a sitemap subarea points at it, and
`dotnet build` passes at the repository root. Nothing is deployed — local only.

**Known limitation (build SDK 1.9.1, tested):** the build compiles the page, but the
solution project does not pack it — the solution zip and the package have no page,
while the sitemap subarea references it, so a deployed app would have a dangling
navigation entry (TALXIS/tools-devkit-build#131). Tell the user this in the summary;
do not claim the page ships.

A generative page is a single-file React page rendered inside a model-driven app.
It is **React 17 + Fluent UI v9** — do not import React 18 APIs or Fluent UI v8.
All Dataverse access goes through `props.dataApi` (query tables, then render —
summary cards, tables, whatever the page needs); there is no direct WebApi client.

## Step 1 — Gather inputs (once)

1. **Project folder** — per the repository's convention (default `src/GenPages.<Name>`)
2. **Name** — lowercase page name, e.g. `<pagename>` (becomes the csproj name)
3. **DisplayName** — human-readable, e.g. `<Display Name>`
4. **Sitemap placement** — Title, GroupTitle, AreaTitle, the model-driven app's name
   (`<prefix>_<appname>`), and an anchor entity (`<prefix>_<entity>`).

## Step 2 — Scaffold

Scaffold `pp-page-generative` into `<page project>` (`txc workspace component
parameter list pp-page-generative` has the inputs; `Name` is the lowercase page name).

The template names the `.csproj` after the `Name` param, not the folder — locate it
with a glob rather than assuming (`<page project>/*.csproj`), and read the
generated **GenPageId** from its `<PropertyGroup>`; Step 5 needs both.

## Step 3 — Implement the page

Edit `<page project>/page.tsx`. Query data via `props.dataApi`, render with
Fluent UI v9 components. Keep it a single self-contained page file.

The scaffold does not build as generated (TALXIS/tools-devkit-templates#188): it has
no `package.json`, so `react` and `@fluentui/react-components` do not resolve and the
build fails on `error TS…`. What made it build in a test run: a `package.json` in the
page folder (react and react-dom 17, `@types/react` 17, `@fluentui/react-components` 9,
typescript) plus `npm install`; a one-line `declare module '@fluentui/react-components';`
in a `.d.ts` file (the SDK's `tsc` resolves modules the classic way and cannot find
Fluent); `import * as React from 'react'`; and nothing newer than ES2015 (no
`Promise.finally`).

## Step 4 — Add a `ProjectReference` from `<ui solution>`

```
dotnet add "<ui solution>" reference "<page project>/<pagename>.csproj"
```

Use the actual csproj file name found in Step 2. Expected outcome: the page project is
in the solution file (`dotnet sln list` — `pp-page-generative` registers it itself when run
from the folder with the solution file) and `<ui solution>` references it; with SDK 1.9.1
the reference does not make the solution pack the page (limitation above).

## Step 5 — Sitemap subarea

```
txc workspace component create pp-sitemap-subarea --output "<ui solution>" --param "PageType=genpage" --param "Title=<Title>" --param "EntityLogicalName=<prefix>_<entity>" --param "GenPageId=<genpage-id>" --param "GroupTitle=<GroupTitle>" --param "AreaTitle=<AreaTitle>" --param "AppName=<prefix>_<appname>"
```

`GenPageId` is the GUID read from the csproj in Step 2; `AppName` is the model-driven
app whose sitemap gains the subarea. `EntityLogicalName` is accepted but not written to the
sitemap XML (TALXIS/tools-devkit-templates#188).

## Step 6 — Validate

```
dotnet build
```

Must pass before you finish — it builds the page bundle and validates the sitemap XML.

## Step 7 — Summary

Report: the project path and csproj name, the GenPageId, where the subarea landed
(Area → Group → Title), that `dotnet build` passed, and that nothing was deployed.
