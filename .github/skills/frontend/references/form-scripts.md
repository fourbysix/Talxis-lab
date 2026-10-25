> **Needed because:** the library/handler wiring sequence is not surfaced by txc help.
> **Remove when:** txc surfaces sequences in help/docs (T12).

# Form scripts

**Contract:** when this task ends, `<scripts project>` builds a JS bundle, the event
handlers are registered in the form XML, and `dotnet build` passes at the repository
root. Local only — nothing is deployed.

Prerequisite: the target form exists and you have its GUID (see the `forms` reference).

## Create the script library (once per repository)

Scaffold `pp-script-library` (`LibraryName=main`, plus the publisher prefix) into
`<scripts project>` (default `src/Scripts.UI`) and `dotnet sln add` it.

This scaffolds a TypeScript project compiled by `dotnet build` (rollup under the
hood). The bundle output is `<scripts project>/build/<prefix>_main.js`, deployed as the
web resource `<prefix>_main.js`.

Add a `ProjectReference` to it from `<ui solution>` so the web resource ships with it:

```
dotnet add "<ui solution>" reference "<scripts project>"
```

(Both paths relative to the repository root; `dotnet` stores the correct relative
`ProjectReference` in the csproj.)

## Write the handlers

The rollup entry point is `<scripts project>/src/index.ts` (replace the scaffold's
sample `Main` class). The bundle is UMD: what `index.ts` exports becomes the properties
of one global, so exporting `EntityForm` with an `onLoad` function is reached as
`<global>.EntityForm.onLoad(executionContext)`. The global's `name` in
`<scripts project>/rollup.config.mjs` defaults to `<prefix>_main` — it must equal the
first segment of every `FunctionName` you register below, so either set it to your
namespace (e.g. `MyScripts`) or name your functions `<prefix>_main.<...>`.

Build the library — this is also the validation loop for the TypeScript:

```
dotnet build "<scripts project>"
```

A successful build can print `where: not found` (a Windows-only command in the build)
and `CS2008: No source files specified`; both are harmless (tools-devkit-build#135). `npm` leaves a
`package-lock.json` — commit it.

## Register event handlers

**onLoad** (form-level):

```
txc workspace component create pp-form-event-handler --output "<ui solution>" \
  --param "FormType=main" \
  --param "FormId=<form-guid>" \
  --param "EntityLogicalName=<prefix>_<entity>" \
  --param "LibraryName=<prefix>_main" \
  --param "FunctionName=MyScripts.EntityForm.onLoad" \
  --param "EventType=onload"
```

**onChange** (field-level — adds `AttributeName`):

```
txc workspace component create pp-form-event-handler --output "<ui solution>" \
  --param "FormType=main" \
  --param "FormId=<form-guid>" \
  --param "EntityLogicalName=<prefix>_<entity>" \
  --param "LibraryName=<prefix>_main" \
  --param "FunctionName=MyScripts.EntityForm.onFieldChange" \
  --param "EventType=onchange" \
  --param "AttributeName=<prefix>_<attribute>"
```

`FunctionName` is the fully qualified path from the UMD global
(`<Namespace>.<Object>.<function>`); `LibraryName` is the web resource name without
the `.js` extension.

## Validate

```
dotnet build
```

Must pass at the repository root: compiles the TypeScript, bundles the web resource,
and schema-validates the form XML with the new handlers.
