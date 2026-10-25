> **Needed because:** the button/command-parameter sequence is not surfaced by txc help.
> **Remove when:** txc surfaces sequences in help/docs (T12).

# Ribbon buttons

**Contract:** when this task ends, the ribbon customization exists under
`<ui solution>` and `dotnet build` passes at the repository root. Local only —
nothing is deployed.

Prerequisite: the script library (`<scripts project>`) exists and **builds** — the button
invokes a function in the deployed bundle, so create the function (see the `form-scripts`
reference) and run
`dotnet build "<scripts project>"` successfully before scaffolding the button.

## Create the button

```
txc workspace component create pp-ribbon-button --output "<ui solution>" \
  --param "Location=Form" \
  --param "EntityLogicalName=<prefix>_<entity>" \
  --param "ButtonLabel=<Button Label>" \
  --param "PublisherPrefix=<prefix>" \
  --param "LibraryLogicalName=<prefix>_main.js" \
  --param "FunctionName=MyScripts.RibbonActions.<functionName>" \
  --param "Sequence=31" \
  --param "TemplateAlias=o1"
```

- `Location=Form` puts the button on the record form's command bar.
- `LibraryLogicalName` is the web resource name **with** the `.js` extension
  (unlike `LibraryName` on event handlers).
- `FunctionName` is the fully qualified path from the script bundle's UMD global.
- `Sequence` orders the button among existing ones (out-of-box buttons use
  multiples of 10; 31 lands after the third slot).
- `TemplateAlias=o1` renders it as a standard overflow-capable button.

## Pass the form context

Without a command parameter the function is called with no arguments. Add
`CrmPrimaryControl` so it receives the form context as its first parameter:

```
txc workspace component create pp-ribbon-command-parameter --output "<ui solution>" \
  --param "EntityLogicalName=<prefix>_<entity>" \
  --param "PublisherPrefix=<prefix>" \
  --param "ParameterType=CrmPrimaryControl" \
  --param "FunctionName=MyScripts.RibbonActions.<functionName>" \
  --param "ButtonLogicalName=<buttonlabel>"
```

`ButtonLogicalName` is the button's label lowercased with spaces removed (e.g.
"Open Summary" → `opensummary`); `FunctionName` must match the button's
`FunctionName` exactly so the parameter attaches to the right command.

## Validate

```
dotnet build
```

Must pass at the repository root — it schema-validates the RibbonDiff XML and
rebuilds the script bundle the button depends on.
