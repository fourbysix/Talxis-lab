---
name: backend
description: Implements server-side logic in a TALXIS / Power Platform / Dataverse workspace — validation, automation, event handlers, business rules that run in the backend when records change. Use when adding or changing server-side behavior, plugins, or APIs behind the data.
---

# Backend logic

**Contract:** code and its registration are in place locally and
`dotnet build` passes. Local only — nothing deploys; to try the change in a Dev environment when the user asks, use the `deploy` skill (`inner-loop` reference).

## Ask the CLI first

```
txc component type list --search plugin            # registration types
txc workspace component create --help              # project templates (plugin project)
txc workspace component parameter list <type>      # every parameter, typed
```

## Intent → component type

| You want | Component type |
|---|---|
| a C# project for server-side logic | plugin project template (`create --help`) |
| register the compiled logic in the platform | none to scaffold — the build of the Dataverse solution that holds registrations registers the assembly |
| run it on a specific event (create/update/…) | a `[PluginStep]` attribute on the plugin class — the Dataverse solution's build generates the step; the plugin step type (a registration of a class on a message and stage) only for what attributes cannot express |
| call an external API from an app | a custom connector project — `Connector` (`--search connector`), shipped in its own Dataverse solution ([references/custom-connectors.md](references/custom-connectors.md)) |

## Sequence

1. Find the plugin project (`ProjectType` Plugin) or create one (default
   `src/Plugins.<Name>`), add it to the solution file, write the C# classes,
   `dotnet build`.
2. Registration lives in a Dataverse solution project that takes a `ProjectReference` to
   the plugin project: the one that holds registrations in this repository, or, in a new
   repository with the default split, a logic solution (`src/Solutions.Logic`). Resolve
   it per the `init` skill's `workspace-layout` reference file (also the terms); create one
   only if there is none. The `plugin-registration` reference file has the steps.
3. Don't scaffold the plugin assembly: the build of that solution registers it and
   generates one plugin step per `[PluginStep]` on the plugin classes. Scaffold a plugin
   step only for what an attribute cannot express, after that build.
4. `dotnet build`.

## Invariants

- The plugin assembly targets **.NET Framework**, as the template sets it (the platform sandbox is .NET
  Framework) — never "upgrade" the target framework.
- Reject invalid input in a **Pre-validation** plugin step (cheapest, runs before the
  database transaction); make related writes atomic in a **Post-operation** plugin step
  (inside the transaction).
- One registration per assembly, one id: the generated and the manual way
  (`GeneratePluginAssembly`) must never be mixed — see the registration reference,
  including how to add registration to an existing solution. `[PluginStep]` works only
  with the generated way.
- Declare *when a class runs* with `[PluginStep]` on the class; the generated step files
  live in the logic solution and are committed. A scaffolded step for the same class,
  message, entity and stage would run twice.
- Code lives in the plugin project; *when and where it runs* is platform
  configuration and lives in the Dataverse solution that holds registrations (the
  logic solution in the default split).

Details: [references/plugin-development.md](references/plugin-development.md) ·
[references/plugin-registration.md](references/plugin-registration.md) ·
[references/custom-connectors.md](references/custom-connectors.md)
