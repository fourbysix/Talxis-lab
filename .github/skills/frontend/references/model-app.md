> **Needed because:** the app/sitemap composition sequence is not surfaced by txc help.
> **Remove when:** txc surfaces sequences in help/docs (T12), and `pp-app-model` /
> `pp-sitemap-area` emit the display name and the area title (TALXIS/tools-devkit-templates#181),
> and `pp-app-model` / `pp-app-security-role` no longer write or break the role map (templates#78,
> #152, #184; the appliers keep existing roles and drop the `<Everyone />` default,
> platform-metadata#135) — then the role-id hand edit below goes away.

# Implement a model-driven app

**Contract:** when this task ends, `<ui solution>` contains the app, its entity
components, and sitemap navigation, is referenced by `<package project>`, and
`dotnet build` passes at the repository root. Local only — no cloud environment is
touched.

In the default split the UI solution only layers UI on top of tables it references
(`Behavior=Existing` entity references) from `<data-model solution>`; if both slots are the same
project the table is already defined there: skip the entity references in Step 3. Tables must
already exist (see the `data-model` skill). Slots and defaults:
[workspace-layout](../../init/references/workspace-layout.md); the repository's layout and naming win.

## Step 1 — Gather inputs (once)

`<PublisherName>`, `<PublisherPrefix>` from the workspace (an existing solution
project's csproj has them). App logical name (lowercase, no prefix — `pp-app-model` adds it, so `evapp` under prefix `ev` becomes `ev_evapp`). Which entities the app shows, and
the navigation layout: areas → groups → subareas (one subarea per entity).

## Step 2 — Create the Dataverse solution (first time only)

Skip if the workspace already has a Dataverse solution for UI (in a single-solution
repository, its one solution). Otherwise create it like any solution project
(default `<ui solution>`) — `pp-solution` and a `ProjectReference` from
`<package project>`; the `data-model` skill's `scaffolding` reference file shows the commands and the outcome to check
(project listed by `dotnet sln list`, shipped in the Package Deployer package).

## Step 3 — Create the app and add the entities to it (entity references for other projects' tables first)

In this order (`txc workspace component parameter list <type>` for each):

1. Only for a table defined in another solution project: `pp-entity` with
   `Behavior=Existing`, once per such entity — an entity reference, not a table (`DisplayName` is
   still required). Not for a table in `<ui solution>` itself: a reference there
   fails the build with a duplicate root component (TXM004,
   TALXIS/tools-devkit-templates#185).

   ```
   txc workspace component create pp-entity --output "<ui solution>" --param "Behavior=Existing" --param "PublisherPrefix=<PublisherPrefix>" --param "LogicalName=<entity>" --param "DisplayName=<Display Name>"
   ```
2. `pp-app-model` — the app. Its full name is `<PublisherPrefix>_<app>`, and every
   later command takes it as `AppName`. It has no display-name parameter: the label is
   the logical name, so set `LocalizedName` by hand in `AppModule.xml` and
   `AppModuleSiteMap.xml` if the app needs a readable name.
3. `pp-app-model-component`, once per entity, to add it to the app (works for a table
   defined in the same project and for a referenced one).

The scaffolded `AppModule.xml` has a hard-coded role id in `<AppModuleRoleMaps>` that
does not exist in the solution (TALXIS/tools-devkit-templates#78). To make the app
visible to a security role, replace it by hand with the role's id from the role file
`Roles/<name>.xml` in the solution that holds roles (`id="{...}"`).
`pp-app-security-role` is the intended template but currently fails and breaks the
next build (TALXIS/tools-devkit-templates#184), so do not use it.

## Step 4 — Build the sitemap

Area first, then its groups, then subareas — `pp-sitemap-area`, `pp-sitemap-group`,
`pp-sitemap-subarea`. Each child references its parent **by title**, and every command
takes `AppName`; repeat `pp-sitemap-subarea` per entity in the group:

```
txc workspace component create pp-sitemap-area --output "<ui solution>" --param "AreaTitle=<Area>" --param "AppName=<PublisherPrefix>_<app>"
txc workspace component create pp-sitemap-group --output "<ui solution>" --param "GroupTitle=<Group>" --param "GroupDisplayName=<Group>" --param "AreaTitle=<Area>" --param "AppName=<PublisherPrefix>_<app>"
txc workspace component create pp-sitemap-subarea --output "<ui solution>" --param "Title=<Subarea Title>" --param "EntityLogicalName=<PublisherPrefix>_<entity>" --param "GroupTitle=<Group>" --param "AreaTitle=<Area>" --param "AppName=<PublisherPrefix>_<app>"
```

The generated area has no `<Titles>` element (groups and subareas do), so its title
does not show: add `<Titles><Title LCID="1033" Title="<Area>" /></Titles>` to the
`Area` in `AppModuleSiteMap.xml`.

## Step 5 — Validate

```
dotnet build
```

Must pass. `TALXISXSD001` = schema validation failed (fix the reported XML);
`TALXISGUID001` = duplicate GUID (regenerate the reported id). If the build keeps
reporting an error in a file you already fixed, it is validating a stale copy under
`obj/` — delete the solution project's `obj/` and `bin/` and build again.

## Step 6 — Summary

Report the app name, the entities (and which were referenced), and the sitemap tree, that
`<package project>` references the Dataverse solution, that `dotnet build` passed, and that nothing was deployed.
Suggest the next steps, one line each: forms and views for each entity (`forms` and
`views-subgrids` references), then deploy the package (`deploy` skill).
