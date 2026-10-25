> **Needed because:** the build-registers-the-assembly sequence and the `[PluginStep]` attribute
> surface are not surfaced by txc help (the attributes are described only in the Plugin build
> package README), and `txc docs get plugin-development` still lists `pp-plugin-assembly` as a
> registration step — which is why the backend skill does not point at it.
> **Remove when:** txc surfaces sequences in help/docs (T12), the `plugin-development` doc
> describes build-generated registration (tools-cli#205), the attribute reference is reachable
> through `txc docs get` (T24), and the `pp-solution` template describes its
> `GeneratePluginAssembly` parameter (tools-devkit-templates#106).

# Register plugin assemblies and steps

**Contract:** when this task ends, `<logic solution>` contains the assembly
registration and the plugin steps of every plugin class (generated from its
`[PluginStep]` attributes, or scaffolded), and `dotnet build` passes at the repository
root. Local only — nothing is deployed and no cloud environment is touched.

The plugin project holds the code, a Dataverse solution holds the registration. The
assembly is a build artifact; when and where it runs is Dataverse configuration — each
belongs to its own project. `<logic solution>` is the solution that holds registrations
in this repository: the default split has its own (`src/Solutions.Logic`); a repository
split differently, or with a single solution, uses the project that already holds (or
should hold) them, possibly the same one as the tables and UI. Terms and slots:
[workspace-layout](../../init/references/workspace-layout.md). The plugin project must
already exist and build (see the `plugin-development` reference).

## How registration works

A registration is two files in `<logic solution>` that share one id:
`PluginAssemblies/<AssemblyName>.dll.data.xml` and a type-91 `RootComponent` in
`Other/Solution.xml`. The `GeneratePluginAssembly` property in that solution project's csproj
(template default `true`) decides who writes them:

- **Generated** (`true`): every build writes them for each referenced plugin project.
  It finds an existing `<AssemblyName>.dll.data.xml` by name and reuses its id (it adds
  new classes, never removes any); otherwise it mints a new id. It needs a signed
  assembly with at least one public, non-abstract `IPlugin` class.
- **Manual** (`false`): you scaffold `pp-plugin-assembly` (fresh lowercase GUID as
  `AssemblyId`) after building the plugin project; that solution project's build leaves both files
  alone. Use it only when you need a fixed id. With generation left on, running it
  before the first build of the solution project (plugin project already built) also works: the build
  reuses that id. Never after a generated build has registered the assembly.

**Registering in the wrong order can create duplicates.** Running `pp-plugin-assembly`
after a generated build, renaming the assembly, or editing the id in only one of the two
files leaves two roots, and the next build fails with "root components are not defined
in customizations". Nothing guards against this yet, so after every build that touches
registration, check there is exactly one registration and the ids match:

```
grep -o 'RootComponent type="91" id="[^"]*"' <logic solution>/Other/Solution.xml
grep -o 'PluginAssemblyId="[^"]*"' <logic solution>/PluginAssemblies/*.data.xml
```

**Order:** steps declared with `[PluginStep]` need no ordering: the same build writes them
right after the assembly registration. Scaffolded steps (`pp-plugin-assembly-step`)
reference the assembly, so scaffold them only after the registration exists (after the
first build in generated mode).

**Retrofitting an existing Dataverse solution:** if it already holds the registration, leave
generation on — the build reuses the existing id by file name. If the assembly already
lives in an environment under another id, set that id in both files before the first
build. Run the checks above before and after.

## Step 1 — Gather inputs (once)

From the existing workspace: `<PublisherName>`, `<PublisherPrefix>`, the
`<plugin project>` and its project name (`<plugin project name>`). For each plugin step: the
plugin class name, the target entity's logical name (with the publisher prefix; the schema name as it is in the environment), the SDK message
(Create/Update/Delete), and the stage (Pre-validation / Post-operation).

## Step 2 — Create the logic Dataverse solution (first time only)

Skip if the workspace already has a Dataverse solution that holds registrations (in a
single-solution repository, its one solution); only otherwise create one like any solution
project (default `src/Solutions.Logic`) — `pp-solution` and a `ProjectReference` from
`<package project>`; the `data-model` skill's `scaffolding` reference file shows the commands and the outcome to
check (project listed by `dotnet sln list`, shipped in the Package Deployer package).

## Step 3 — Reference the plugin project and build

The solution project packages the assembly it registers, so it needs a `ProjectReference`
to the plugin project. The build then generates the registration (see "How
registration works"):

```
dotnet add "<logic solution>" reference "<plugin project>"
dotnet build "<logic solution>"
```

## Step 4 — Declare the plugin steps on the classes

One `[PluginStep]` per message a class handles, written on the class in `<plugin project>`
(`using TALXIS.DevKit.Build.Dataverse.Plugin;` — the build SDK compiles the attribute
sources into the plugin project, there is nothing to reference). It needs the generated
registration (`GeneratePluginAssembly` on, the default). The solution build writes
`SdkMessageProcessingSteps/{id}.xml` and the type-92 root components into `<logic solution>`;
commit them like the assembly's `.data.xml`.

```csharp
[PluginStep("Update", "<PublisherPrefix>_<entity>", PluginStage.PostOperation,
    FilteringAttributes = new[] { "<PublisherPrefix>_name" })]
[PluginStepImage(PluginImageType.PreImage, "PreImage", "<PublisherPrefix>_name")]
public class <PluginClassName> : PluginBase
```

- Message and stage are `PluginStage.PreValidation` / `PreOperation` / `PostOperation`. A
  message without a primary entity (Associate, Disassociate, an unbound custom action) uses
  `[PluginStep("Associate", PluginStage.PreOperation)]`.
- Built-in message ids: Create, Update, Delete, SetState, SetStateDynamicEntity, Assign,
  Retrieve, RetrieveMultiple, Associate, Disassociate, RetrieveExchangeRate. Any other message
  (a custom action) needs `MessageId = "<guid>"`; that message must exist in the target or
  travel in the same solution. A Custom API's message id is generated when the Custom API is created
  (recreating it gives a new one), so it cannot be hard-coded.
- Optional: `Name`, `Description`, `FilteringAttributes` (Update only), `Mode =
  PluginMode.Asynchronous` (PostOperation only; `AsyncAutoDelete`), `Rank`, `Configuration`
  (unsecure), `RunAsSystem`. `InvocationSource` is set from the message, as Dataverse stores
  it; set it only to deviate.
- `PluginStepImage` takes the image type, the name and the columns (none = all). With more
  than one `[PluginStep]` on the class, `StepName` binds it to a step by that step's `Name`.
- **Adopting an existing step:** set `Id` to its id (the file name in `SdkMessageProcessingSteps/`)
  and `Id` on its images, otherwise the build warns that the old and the generated step would
  both run. The file is then rewritten from the attribute, so anything the attribute cannot
  express is dropped.
- Removing a `[PluginStep]` removes its generated file and root component; hand-written steps
  are never touched.
- The build fails, naming the class, on a pre-image on Create, a post-image outside
  PostOperation, an asynchronous step outside PostOperation, an ambiguous image binding, an
  unknown message without `MessageId`, or two steps with the same id.

**Manual steps** — for what attributes cannot express (Power Fx step types, impersonating a
specific user, secure configuration), or when `PluginStep` does not compile because the
project's build SDK predates attribute registration. One `pp-plugin-assembly-step` per
plugin class — `PluginName` is the class name; `Stage` and `SdkMessage` take the choices
`parameter list` shows:

```
txc workspace component create pp-plugin-assembly-step --output "<logic solution>" --param "PrimaryEntity=<PublisherPrefix>_<entity>" --param "PluginProjectName=<plugin project name>" --param "PluginName=<PluginClassName>" --param "Stage=Pre-validation" --param "SdkMessage=Create"
```

Stage choice: **Pre-validation** runs before the database transaction starts — the
cheapest place to reject bad input with `InvalidPluginExecutionException`.
**Pre-operation** (the third stage) runs inside the transaction before the write.
**Post-operation** runs after the record is written but still inside the transaction,
so the plugin's related writes commit or roll back together with the triggering
record. Match the stage each class was written for.

## Step 5 — Validate

```
dotnet build
```

Must pass at the repository root, and a second `dotnet build` must change no file
(`git status`). Check that `SdkMessageProcessingSteps/` holds one file per declared step.
`TALXISXSD001` = schema validation failed (fix the reported XML); `TALXISGUID001` =
duplicate GUID (regenerate the reported id).

## Step 6 — Summary

Report the assembly and plugin steps registered (entity, message, stage per plugin step,
and whether each came from an attribute or a scaffold), that `<package project>`
references `<logic solution>`, that `dotnet build` passed, and that nothing was deployed. Next step in one line: cover the plugin logic with local unit
tests (`test` skill).
