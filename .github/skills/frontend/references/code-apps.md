> **Needed because:** the offline data-source generation sequence, the live connector binding and what `npm run dev`
> needs to run inside Power Apps are not surfaced by txc help.
> **Remove when:** txc surfaces sequences in help/docs (T12), re-running `pp-app-code-data` replaces a data source
> cleanly (TALXIS/tools-devkit-templates#169), and txc binds the code app to an environment and its connectors (T28).

# Create a code app

**Contract:** when this task ends, the `<code app project>` exists, its
data sources are generated from local metadata, and `dotnet build` passes at the
repository root. Nothing is deployed and no cloud environment is touched — local only (binding a
connector data source is the exception: live, and only when the user asked).

A code app is a fully custom SPA hosted by Power Apps — Vite, React, TypeScript —
instead of a metadata-driven UI. Reach for it for narrow, fast, task-focused screens;
keep general-purpose CRUD in the model-driven app.

## Step 1 — Gather inputs (once)

1. **Project folder** — per the repository's convention (default
   `src/Apps.<Name>`, PascalCase `<Name>`)
2. **DisplayName** — human-readable, e.g. `<Display Name>`
3. **AppName** — lowercase schema name, e.g. `<appname>`. Pin it explicitly so the
   CanvasApp schema name (`<prefix>_<appname>`) doesn't depend on the folder name.
4. **Tables** — logical names of every table the app reads or writes, e.g.
   `<prefix>_<entity>`. Each must already exist in `<data-model solution>`.

## Step 2 — Scaffold and wire into the build

Scaffold `pp-app-code` into `<code app project>` with `DisplayName` and `AppName`, then
`dotnet sln add` it and add a `ProjectReference` to it from `<ui solution>`.

A plain `ProjectReference` is all the wiring: the TALXIS build discovers any
`ProjectType=CodeApp` reference regardless of which Dataverse solution carries it — no dedicated
solution project. During that solution project's build it runs `npm install` / `npm run build`,
registers the app as a CanvasApp root component, and packs `dist/` into the solution.

The template scaffolds a working starter: router, layout, a demo home page, providers.
Replace the demo pages with the real screens once data sources exist.

## Step 3 — Data sources from local metadata (the differentiator)

A code app talks to Dataverse through declared data sources, and `txc` generates them
**offline** from the table metadata already sitting in `<data-model solution>` — no
live environment, no auth, no txc connection. One invocation per table:

```
txc workspace component create pp-app-code-data --output "<code app project>" --param "EntityLogicalName=<prefix>_<entity>" --param "ModelSolutionPath=<relative path to the data-model solution>"
```

`ModelSolutionPath` is resolved relative to `--output` (the template runs its
post-actions there). Each run produces:

- typed models and services under `<code app project>/src/generated`
- schema files under `<code app project>/.power`
- the data source registration in `power.config.json`, which the solution project's build packs
  with the app

Generated identifiers title-case the first character of the publisher prefix
(e.g. `<Prefix>_<entity>sService`) — match that casing in imports.

Re-running it for a table that already has a data source (e.g. after adding a column) logs a red `Rename-Item: …
<Prefix>_<entity>sService.ts already exists` as a warning and still reports success, but leaves a stray
`src/generated/services/capitalizedentitylogicalnameexamplesService.ts` and duplicate export lines in
`src/generated/index.ts` (DevKit templates 1.26.0, TALXIS/tools-devkit-templates#169). Delete the stray file and the
duplicate lines, or delete the table's generated model and service before re-running.

**Check every result.** The generated services (`create`, `update`, `get`, `getAll`; `delete` returns nothing) resolve
to `IOperationResult<T>` from `@microsoft/power-apps/data` — `{ success, data, error? }` — and do **not** throw when the
server refuses the operation (e.g. a plugin's `InvalidPluginExecutionException`). Check `success` and show
`error.message`; otherwise the UI reports success for a save that was refused:

```ts
const result = await <Prefix>_<entity>sService.create(record);
if (!result.success) throw new Error(result.error?.message ?? "The operation failed");
```

## Connector data sources (live, only when asked)

Data from an external API comes through a custom connector (`backend` skill, custom-connectors reference). Unlike a
table, it has no offline generator: the Power Apps CLI `pa` binds it against a live environment where the connector is
already deployed — this touches the cloud, so run it only when the user asked. Run from `<code app project>`; while
`power.config.json` has `"environmentId": null`, every `pa` command needs `--environment-id <environment id>` (`-e`),
the environment's `environmentId` from `txc env list --format json` (not its `organizationId`).

```
pa connector list --search "<connector display name>" --json -e <environment id>
pa connection create --connector <connector API name> --display-name "<connector display name>" --json -e <environment id>
pa app add data-source --connector <connector API name> --connection-id <connection id> -e <environment id>
```

- The connector API name is the `name` that `pa connector list` returns (e.g. `shared_<prefix>-5f<escaped display
  name>-5f<generated suffix>`), not the Dataverse schema name `<prefix>_<name>`: `pa` rejects that with "did not match
  validation regex ^[a-zA-Z0-9\-\.]{1,64}$". The suffix cannot be derived locally — look it up.
- `--json` output can carry status lines around the JSON; read from the first `{` to the last `}`. The connection id
  is `connectionId` in the result. Bind one connection per app: `pa connection list --search "<connector display
  name>" --json -e <environment id>` shows an existing one to reuse instead of creating another.
- For a no-auth connector the connection is created without a browser; a connector with sign-in opens the browser
  (`pa connection create --help`) — the user completes it.
- `pa app add data-source` writes the connection reference into `power.config.json` and generates a typed
  `<ConnectorName>Service` (one method per swagger `operationId`, returning `IOperationResult` as above) under
  `src/generated/services`; the data source key it writes is derived from the connector API name, not the display name.

The connector API name in `power.config.json` belongs to that environment: importing the app's solution elsewhere still
succeeds (tested into Test), but the connector data source works there only after the connector solution is deployed
and a connection exists there.

## Step 4 — Local dev loop

```
cd <code app project>
npm run dev
```

Vite serves the app locally for iterating on pages against the typed services.

Running it inside Power Apps needs the target environment's id in `power.config.json` (`environmentId`, from
`txc env list --format json`). The `pp-app-code` starter leaves it `null`, and then `npm run dev` prints `[powerApps]
Error loading power.config.json: Invalid power.config.json structure. Missing environmentId.` and no Local Play link.
With the id set it prints `Local Play: https://apps.powerapps.com/play/e/<environment id>/a/local?_localAppUrl=…` —
give the user that link (tested: it signs in and reads and writes real data), not the plain `http://localhost:5173/`,
which runs the app outside Power Apps (no sign-in, no data). The Local Play page loads the dev server from the user's
own browser, so it works only where that browser reaches the dev server's localhost: the same machine, or VS Code
desktop's port forwarding; browser-based Codespaces do not map localhost. The starter's `localAppUrl`
(`http://localhost:3000`) differs from Vite's port; the link uses Vite's actual URL, so leave it.

Running against a live environment needs code apps enabled there (`deploy` skill, environments).

## Step 5 — Validate

```
dotnet build
```

The build of the solution project must pass — it exercises the npm install/build and the CanvasApp
packing end to end. When the solution file lists the code app project too, one `dotnet build` at the root runs the app's
`tsc -b && vite build` twice (once per path) — expected, not an error.

## Step 6 — Summary

Report: the project path, the CanvasApp schema name `<prefix>_<appname>`, the tables
with generated data sources, that `dotnet build` passed, and that nothing was deployed.
