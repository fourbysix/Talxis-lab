> **Needed because:** txc has no command that lists a repository's projects by slot, and `txc workspace explain` / `project explain` print a fixed string instead of inspecting the repository.
> **Remove when:** those commands inspect the workspace and carry this default (TOOLING-BACKLOG T14; TALXIS/tools-cli#204, #210). The Terms table below is a glossary, not a txc gap: it stays.

# Layout, naming and project slots

## Terms

The skills sit on .NET/MSBuild, NuGet, Dataverse, `txc` and GitHub, which reuse the same
words. Here, unless a sentence says otherwise:

| Word | Means | Not |
|---|---|---|
| repository (txc: "workspace") | the git checkout, the whole codebase | one project |
| project | one `.csproj`/`.cdsproj` built by MSBuild, with a `ProjectType` | the repository |
| solution file | the `.slnx` (or `.sln`) at the repository root listing the projects for `dotnet build`; not deployed | a Dataverse solution |
| Dataverse solution (also "solution project"; a bare "solution" and every `<... solution>`) | a project with `ProjectType=Solution` (`pp-solution`): owns the components in its folders, packed into a solution zip imported into Dataverse; by default `Solutions.*` | the solution file |
| slot | what a project is for in this layout: the placeholders `<data-model solution>`, `<plugin project>`, ... | a security role |
| security role | a Dataverse permission set (`pp-security-role`) | a slot |
| component | txc's word for anything scaffolded from a `pp-*` template or held in a Dataverse solution (table, form, plugin step, ...); "component type" is its txc type name | a PCF control |
| Package Deployer package (a bare "package"; "package project" builds it) | the `.pdpkg.zip` that `dotnet publish` builds from the package project (`ProjectType` PDPackage, `pp-package`), imported with `txc env pkg import` | a NuGet or data package |
| NuGet package | a `.nupkg`: a dependency (`PackageReference`, e.g. FakeXrmEasy), a .NET tool (`TALXIS.CLI`), or a PCF control's package (`TALXIS.Controls.Grid.Package`), which `txc env pkg import` also takes by NuGet name (a "dependency package": not built here, imported first) | the `.pdpkg.zip` you build |
| CMT data package | records exported/imported with the Configuration Migration Tool (`txc data package`) | a deployable package |
| PCF control | a packaged custom control, attached with `txc workspace control attach` | a form control |
| form control | a field or subgrid on a form (`pp-form-control`) | a PCF control |
| app | a model-driven app (`pp-app-model`) unless qualified; code app = the SPA project (`pp-app-code`, registered as a CanvasApp component) | an Entra app registration (the CI identity) |
| application user | the Dataverse user for that app registration's service principal | a person |
| environment | a live Dataverse environment (Dev, Test, ...) | an operating-system environment variable |
| profile, connection | txc config objects: a connection is an environment URL, a profile binds an auth to a connection | a `pac` auth profile |
| plugin, assembly, step | the C# class/project (`pp-plugin`); its compiled DLL, registered in a Dataverse solution; one registration of a class on a message and stage (a `[PluginStep]` attribute on the class, or a scaffolded `pp-plugin-assembly-step`) | a "Step N" heading, a BDD step |
| script library, web resource | the scripts project (`pp-script-library`); its bundle as shipped in Dataverse (`<prefix>_main.js`) | an npm library |
| reference | a `ProjectReference` between projects; a `Behavior=Existing` entity reference (a table defined in another solution project); a skill's reference file (`references/*.md`) | each other |
| publish | `dotnet publish`; Dataverse "publish customizations" is always spelled out | each other |
| workflow | a GitHub Actions workflow (`build.yml`); a Dataverse workflow is always called that | each other |
| logical name | the name you pass to a template (`LogicalName`): lowercase, **without** the publisher prefix; the template adds it, so the result (schema or unique name) is `<prefix>_<name>` | a name that already carries the prefix |
| table, column | the same as txc's `Entity` (alias `Table`) and `Attribute` (alias `Column`) types | |
| feature | a Reqnroll `.feature` file | a product feature |
| skill | one of the skills of this plugin (`init`, `backend`, ...); a reference is a file inside one | an entry of `txc docs` (`txc docs list` calls them skills) |

`txc` command, template and parameter names (`txc env solution pull`, `pp-solution`,
`ProjectType`) are fixed; the words above are the skills' own.

Every skill speaks in **slots** (`<data-model solution>`, `<plugin project>`, ...).
Resolve each slot to a real project folder before running a command that names one.
**Several slots may resolve to the same project** (one Dataverse solution holding
tables, UI and logic); then there is nothing to create, reference or cross-link between
those slots. A repository with no package project keeps none unless asked; skip the
steps that reference one.

## Precedence

1. The repository's existing convention — folders, project names, how components are
   split across Dataverse solutions. Route new work into the existing structure; never
   rename, move, split or merge projects to match the default below.
2. Otherwise, an explicit instruction from the user (a single Dataverse solution, a
   split by domain or feature, tables and UI together, ...).
3. Otherwise, the default below — meant for a repository with no convention yet.

## Default layout

Everything under `src/`, one Dataverse solution per concern. This is a recommendation,
not a platform rule: schema, logic, UI and access changes stay out of each other's
diffs, and each can be deployed and owned independently. Platform and tooling facts that
hold with any split: a component belongs to the solution that contains it; a form or
view needs its table's definition in the same solution, or a `Behavior=Existing` entity
reference to a table in another solution project; the package project references the
solutions, and that order drives import order. Solution projects are the hub: they
`ProjectReference` the plugin, script, code app and page projects they ship (the build
SDK recognises the referenced type).

| Slot (placeholder) | Default folder | Recognise it by |
|---|---|---|
| `<package project>` | `src/Packages.Main` | `ProjectType` PDPackage; references the solutions |
| `<data-model solution>` | `src/Solutions.DataModel` | Solution; tables, columns, relationships, option sets |
| `<logic solution>` | `src/Solutions.Logic` | Solution; `PluginAssemblies/`, `SdkMessageProcessingSteps/` |
| `<ui solution>` | `src/Solutions.UI` | Solution; `AppModules/`, forms and views under `Entities/` |
| `<security solution>` | `src/Solutions.Security` | Solution; `Roles/` |
| `<plugin project>` | `src/Plugins.<Name>` | Plugin |
| `<scripts project>` | `src/Scripts.UI` | ScriptLibrary |
| `<code app project>` | `src/Apps.<Name>` | CodeApp |
| `<connector project>` | `src/Connectors.<Name>` | Connector |
| `<connector solution>` | `src/Solutions.Connectors` | Solution; references the connector projects; deployed on its own, not by the package |
| `<page project>` | `src/GenPages.<Name>` | GenPage |
| `<plugin test project>`, `<script test project>`, `<ui test project>` | `src/Tests.Plugins`, `src/Tests.Scripts`, `src/Tests.UI` | no `ProjectType`; test frameworks (FakeXrmEasy, Jest, Reqnroll + Playwright) |

A solution project keeps its component folders (`Other/`, `Entities/`, ...) in its
`SolutionRootPath` (default: the project folder). Paths like `<ui solution>/Entities/...`
are relative to that root. If the project's csproj sets a `SolutionRootPath` other than
the project folder, pass `--param "SolutionRootPath=<value>"` to **every** `txc workspace
component create` for that project: the templates do not read it from the csproj, and
without it the files land at the project folder, the registration step fails, and the
rollback leaves the files behind (tested; tools-cli#93; templates PR #127 detects the
root and makes this unnecessary once released). A repository may split a concern across several solutions or
combine concerns in one; route a component to the solution that holds that concern in
that repository, by what the solutions contain ([layering](../../deploy/references/layering.md)).
Create a new solution project only when asked or when the repository has no home for
the component.

## Resolve the slots in an existing repository

Read the workspace; a name such as `Solutions.UI` is a hint, not proof.

```
dotnet sln list                                                   # all projects (.slnx or .sln)
dotnet sln list | tail -n +3 | xargs grep -iH '<ProjectType>'     # slot by project type
dotnet list <package project> reference                           # solutions the package ships
```

Test projects have no `ProjectType`; tell them apart by their `PackageReference`s and
folder contents. Run these from the solution file's folder. Record the resolved folders
once and reuse them.

## Naming defaults

Defaults for a new repository; an existing repository's convention or an explicit
instruction wins (a publisher prefix already in use is never changed).

- Logical names lowercase, passed to txc without the publisher prefix (the result carries it: `<prefix>_<name>`); display names Proper Case.
- Publisher prefix: lowercase alphanumeric, 5 characters or fewer (the template's guidance).
- Trunk-based topic branches `users/<name>/<topic>` (`deploy` skill, CI/CD reference).
- CI definitions live where the host requires them (GitHub Actions: `.github/workflows/`).

## Working with txc in a repository

- Piped txc output is JSON. Usage errors ("Required option …", "Unrecognized argument …") go to
  stderr only, so with `2>/dev/null` a wrong call looks like empty output — read stderr when a
  command prints nothing.
- Local `txc workspace …` commands log `Resolved target environment … using profile …` when the
  machine has a txc profile; they still only touch files — that line does not mean an environment
  was contacted (tools-cli#229).
- Undoing a scaffold: deleting a scaffolded component's file leaves its entry in the solution's
  `Other/Solution.xml` (root components) and the build fails (TXM001) until you remove the entry
  and any other reference to the component (grep the repository for its id and name, e.g. an app's
  role map). The build also keeps reporting the old ids until the solution project's `obj/` and
  `bin/` are deleted.
