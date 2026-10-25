> **Needed because:** the push → verify → pull loop, its traps and the per-component checks are not
> surfaced by txc help; success exit codes do not prove a change landed.
> **Remove when:** `env pkg import` reports what it installed or skipped (TALXIS/tools-cli#213), the
> build outputs sit in the standard locations (TALXIS/tools-devkit-build#129), `env solution import`
> publishes (tools-cli PR #139), pull is normalized (#54, PR #174) and `env component delete` exists
> (tools-cli#72, PR #151), `env solution clone` adds the package reference (#240).

# Inner loop — change, push to Dev, verify, pull back

**Contract:** run this only against the user's own Dev environment and only when the user asked to
deploy or sync (profile first: [environments](environments.md)). A loop ends when the change is
**seen in the environment** — never on an exit code alone.

## 1. Change and build

Change the source with the component skills, then `dotnet build` at the repository root (and
`dotnet test` if the repository has tests). Fix errors before pushing.

## 2. Push

First see what is installed: `txc env solution get <name> --profile <profile>` per Dataverse solution — `<name>` is the
`UniqueName` in the project's `Other/Solution.xml` (no dots; the dotted form is the friendly name and finds nothing) (`env solution list`
returns every solution of the environment, 500+ in a shared one) — a Dataverse
solution of the repository that is already there means "iterating"; earlier deployment runs in
`env deployment list` do not mean it is still installed.

| Situation | Command |
|---|---|
| First install, or several Dataverse solutions changed | `dotnet publish <package project> -c Debug`, then `txc env pkg import <package project>/bin/Debug/<project file name>.pdpkg.zip --profile <profile>` |
| Iterating on a solution that is already installed (the usual case) | `dotnet build <solution project> -c Debug`, then `txc env solution import <zip> --wait --profile <profile>` |

The zip is `<project file name>.zip` in the project's output folder, `<solution project>/bin/Debug/<target framework>/`
(`dotnet msbuild <solution project> -p:Configuration=Debug -getProperty:OutDir` prints the folder; `TargetPath` names a
`.dll` that does not exist; from txc 1.22.1 `txc env solution import <solution project>` does this lookup itself, tools-cli#234).
Why the second row: Package Deployer skips every solution whose version is already
installed, and local builds always have the same version, so a changed package imports "successfully" and changes
nothing; `env pkg import` prints nothing on stdout (the log on stderr only says it completed); `solution export|unpack|pack|pull|clone`
print packager progress text before the JSON, so do not parse their stdout as one JSON document (tools-cli#217). Debug packs
unmanaged — right for Dev.

**Publish after a solution zip import.** The import stores forms, views, ribbon and app changes but does not make them
live (tested: the form XML in the environment kept the old label until published). Publish just what you changed —
`txc env solution publish --entities <table>[,<table>] --profile <profile>` for forms, views, ribbon and columns of those
tables; plain `txc env solution publish` publishes **all** pending customizations of the environment, other people's
included, and is for apps, sitemaps and web resources that belong to no table. `env pkg import` already publishes
(`env solution import --publish` is in review: tools-cli PR #139).

## 3. Verify it landed

| Changed | Check |
|---|---|
| a column | `txc env entity describe <entity>` lists it with the type (right after an import, once re-check after a few seconds) |
| a table | `txc env entity list --search <prefix>_` |
| a form | `txc env data query odata systemforms --filter "formid eq <form guid>" --select formxml` and look for the field (the `systemform` table through `sql` fails with BadRequest, and `systemforms(<guid>)` returns nothing); if the field is missing, publish (above) |
| model-driven app, role, plugin assembly, plugin step, web resource | `txc env data query sql "SELECT name FROM <appmodule\|role\|pluginassembly\|sdkmessageprocessingstep\|webresource> WHERE name LIKE '<name>%'"` (a step's name ends with `Create of <table>` etc.; filtering `sdkmessagefilter` by table fails with BadRequest) |
| plugin code | the assembly keeps its version, so a name check proves nothing. Test the behaviour: `txc env data record create --entity <table> --data '{…}' --apply` with a value the new code accepts and one it rejects (the rejection message appears in the result), then delete the test record with `env data record delete`. A zip import replaces the DLL at an unchanged version and needs no publish |
| that the import ran at all | `txc env deployment list --since 1h` (package runs are named after the package's last solution), `txc env deployment get --solution-run-id <id>` for findings |

A plugin step belongs to the table you registered it on when its filter does: read `_sdkmessagefilterid_value` on the step
(`env data query odata sdkmessageprocessingsteps --filter "name eq '<step name>'" --select "name,stage,mode,_sdkmessagefilterid_value"`),
then `env data query odata sdkmessagefilters --filter "sdkmessagefilterid eq <that id>" --select primaryobjecttypecode`.
Filtering `sdkmessagefilters` by the table alone returns about 30 system rows and proves nothing.

SQL pitfalls in these checks: `LIKE 'skt_%'` treats `_` as a wildcard and ignores case (escape it as `[_]`), a `JOIN` returns
`[]` instead of an error, and some tables (`systemform`, `sdkmessagefilter`, `sitemap`) answer BadRequest — use `odata` for those.

A check that finds nothing means the change did not land: go to the failure table in
[deployment](deployment.md) — do not push again unchanged.

## 4. Pull what was changed in the environment

To find out what was changed or added in the environment (by you or someone else), pull every Dataverse solution of the
repository into a clean tree and read `git diff` / `git status`: a new table arrives as a new folder under `Entities/`, a
root-component line in `Other/Solution.xml` and its lookups in `Other/Relationships/*.xml`; a changed column as an edited
`<attribute>` block (tested: new table, new column and a renamed column were all found and `dotnet build` passed).

Push or commit your own changes first: `txc env solution pull <solution project folder> --profile <profile>`
overwrites source with the environment's state, so an unpushed source change is deleted. Then `git diff`: after one
environment-side edit expect that edit; review, then commit. Tested: a pull deletes a column that exists only in source,
and the files of other projects (plugin code, scripts) are not touched. With other uncommitted work in the tree, commit only the
pulled paths (`git add -- <paths>`, check `git diff --cached --stat`). A pull does not bring back **web resource script content** or **plugin assembly binaries**: its JSON result lists them as
`excludedWebResources` / `excludedBinaries`, so JavaScript or plugin code edited in the environment is lost unless you copy it
by hand into the script library or plugin project that builds it. Serialization-only changes (for example
`<AutoNumberFormat />` rewritten as an empty element pair; a web resource's `.data.xml` `FileName` losing the dot of `skt_main.js<GUID>`;
an empty `<WebResources />` added to `Other/Customizations.xml`) can show up next to the real edit: revert those lines so the commit
holds only the change (tools-cli#54, PR #174).

### A solution that exists only in the environment

Bring it into the repository from the repository root, with the output folder **inside** the repository (a `.sln`/`.slnx`
above it; outside it the command fails and leaves a half-written project, tools-cli#216):
`txc env solution clone <unique name> --output src/<Project name> --profile <profile>`. This scaffolds a project like the
repository's other solution projects, adds it to the `.slnx` and pulls the solution (tested). It does **not** add it to
the package: add `<ProjectReference Include="..\<Project name>\<Project name>.csproj" />` to the package project right after the
solution it depends on (a lookup target, a table it references): the package imports in declaration order (tools-cli#240); name the
project like the repository's others (`<prefix of the others>.<Name>`, `init` skill, `workspace-layout`), then `dotnet build` and `dotnet publish` the
package project and check that the `.pdpkg.zip` contains `<Project name>.zip`. `pull <folder>` needs an existing
`Other/Solution.xml`; for a new folder use `pull <unique name> --output <folder>`. After hand-editing project files check
`git diff --stat`: an editor that normalises line endings turns a one-line change into a whole-file diff.

Look at what the pulled solution contains (`Other/Solution.xml` root components). A table that another solution project of
the repository already owns comes with a full copy: keep a reference instead — delete its folder under `Entities/`, delete
its `behavior="0"` root-component line, scaffold `pp-entity` with `Behavior=Existing` (see the `data-model` skill), delete
`obj/` of the project (a stale copy there repeats the build error) and build. Also remove what the table brought with it: its
relationships in `Other/Relationships/*.xml` and `Other/Relationships.xml` that the other project owns (ownership `lk_`/`owner_`/`team_`/`user_`,
currency, the other tables' lookups; the result's `excludedRelationships` lists them although the files still hold them, tools-cli#241), and a
`MissingDependencies` entry that only described one of them (the empty `<MissingDependencies />` of the other projects is the
model); keep only the relationships of the new table. The pulled `Other/Solution.xml` loses its byte-order mark, harmless. Not tested: the first import of such a
solution when the environment holds it at another version than the build's `0.0.20000.0`.

## 5. Remove or rename a component

Delete it in source (its files and its root-component entry in `Other/Solution.xml`), rebuild, **and** delete it in the
environment — importing a solution never deletes components, and a changed column type or schema name is rejected
until the old column is gone: `txc env entity attribute delete <entity> --name <attr> --apply --yes`,
`txc env entity delete --entity <entity> --apply --yes`, `txc env data record delete <id> --entity <table> --apply --yes`
(roles, apps, plugin assemblies and steps, web resources; `env role` has no delete). Count rows first
(`env data query sql "SELECT COUNT(*) FROM <table>"`): deleting a column or table deletes its data. Check dependencies first
(`txc env component dependency list --entity <table> [--attribute <column>]`, `env solution uninstall-check <name>`).

A column that a form or view uses cannot be deleted (`attribute delete` fails with "referenced by N other components";
`dependency list` names them; `dependency delete-check` exits 1 while something blocks). Tested route for a type change:
(1) in source remove the column from the form/views and keep the old column definition, build, import the zip, publish
`--entities <table>`; (2) delete the column in the environment; (3) in source add the column with the new type and put
it back on the form/views, build, import, publish. Check with `entity attribute get <table> --name <column>` (a column that is gone exits 1 with a long "Could not find an attribute ()"
message, tools-cli#238) and the form check above. Publish the form change before you delete the column.

A **role** that an app uses cannot be deleted (`record delete` fails with "referenced by 1 other components"): in source
also remove its id from the app's `AppModules/<app>/AppModule.xml` (`AppModuleRoleMaps`) and any `MissingDependencies` entry for
it in the UI project's `Other/Solution.xml` (grep the repository for the role id and name), import and publish, then unlink
it in the environment — `txc env data record disassociate <app id> --entity appmodule --target <role id> --target-entity role
--relationship appmoduleroles_association --apply --yes` (the app keeps its other roles; find the id with `env data query odata
appmodules --filter "uniquename eq '<app>'"`) — and delete the role.

When the removal empties a Dataverse solution (a role was its only component), the solution stays installed as an empty container in the
environment and its project in the repository: remove the project and its package reference only if the user wants the
solution gone, then `env solution delete <name> --yes`; delete the folder the removed file leaves empty. `env role get` takes the
role as `--role <name|guid>`, not as an argument.

## 6. Reset your Dev objects

`txc env pkg uninstall <package> --yes` (or `env solution delete <name> --yes`) removes only the solution containers of
unmanaged solutions — tables, roles, apps, plugin registrations and web resources stay until deleted as in step 5.
Delete only what you created; never touch solutions you do not own. Find what the repository left behind by
reading it (tables = `Entities/`, app = `AppModules/`, plugin = `PluginAssemblies/` + `SdkMessageProcessingSteps/`, web
resources, roles) and delete in this order: plugin step, plugin assembly, app, **its sitemap** (a separate record: deleting
the app leaves it; `env data query odata sitemaps --filter "sitemapnameunique eq '<app unique name>'"` then
`env data record delete <id> --entity sitemap`), web resources, tables (their forms, views and relationships go with them),
the solution containers, and last the publisher (`txc env publisher delete <name> --yes`, only after no solution or
component uses it). Forms and views need no separate check (`odata systemforms|savedqueries --filter "…id eq <guid>"`
returns nothing once the table is gone). Confirm with the counts: `env solution list` back to the earlier number — note the count (and `env publisher list`) before the
first deployment, there is no way to recover it afterwards. Tested: the plugin type goes with its assembly; `solution delete` and
`publisher delete` take no `--apply` (`record delete` and `entity delete` do); the web resource table is `webresource` in SQL and
`webresourceset` in `odata`; the deployment history of
earlier runs stays (`env deployment list`; there is no delete, tools-cli#239).
