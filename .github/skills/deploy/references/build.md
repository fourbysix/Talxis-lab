> **Needed because:** the package artifact lands outside the publish output and validation coverage is partial.
> **Remove when:** publish emits the package artifact to --output (T6) and workspace validate covers composition (T7).

# Build and validate locally

**Contract:** local only — no cloud environment is touched. When this task ends,
`dotnet build` passes at the repository root, and if a package was requested, the
`.pdpkg.zip` path is reported.

## Local-first routing

Creating or changing components (tables, columns, forms, plugins, security roles) is
**always** local: scaffold in the workspace, validate with `dotnet build`. Never
edit the live environment for development — those changes are not in source
control, and local is instant while environment operations take 30s–5min. The
only exception: the user explicitly says "on the live environment" (or a
troubleshooting quick fix in dev). Deploying and data operations are inherently
live — see the `deploy` skill.

## The validation loop

```
dotnet build
```

This is the universal check after every change. It compiles the workspace and
runs TALXIS validation (XSD schema conformance, GUID uniqueness). Known errors:

| Code | Meaning | Fix |
|---|---|---|
| `TALXISXSD001` | Schema validation failed | Fix the reported XML file at the reported line |
| `TALXISGUID001` | Duplicate GUID | Regenerate the reported id so it is unique |

Never deploy a broken build — import-time errors are the slow way to find what
`dotnet build` reports in seconds.

## Debug vs Release

- **Debug** packs solutions **unmanaged** — for Dev environments (editable,
  iterative working state).
- **Release** packs solutions **managed** — for Test/UAT/production (sealed,
  layered, cleanly uninstallable).

Never import a Release (managed) package over an existing unmanaged solution or
vice versa — Dataverse rejects it; uninstall first or rebuild with the matching
configuration.

## Producing the deployable package (`.pdpkg.zip`)

```
dotnet publish <package project> -c Release
```

`<package project>` is the project with `ProjectType` PDPackage (the `init` skill's
`workspace-layout` reference file shows how to resolve it; default `src/Packages.Main`).

Do not pass `-o`: an explicit output dir sets a global `PublishDir` that leaks
into nested plugin project builds and breaks their auto-publish step
(tools-devkit-build#109).

Current quirk (tooling-backlog T6): the `.pdpkg.zip` lands next to the project,
not in the publish output, and is named after the project — find it at:

```
<package project>/bin/<Configuration>/*.pdpkg.zip
```

(In CI the same applies — publish, then copy from `<package project>/bin/Release/`
into the artifact drop.) Every build of the package project prints a warning that the
PDPackage targets are "not verified" with the installed .NET SDK; it is harmless
(tools-devkit-build#128).

## Summary

Report: build result, any error codes fixed, and — if packaged — the absolute
`.pdpkg.zip` path and whether it is managed (Release) or unmanaged (Debug).
