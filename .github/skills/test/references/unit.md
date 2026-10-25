> **Needed because:** the test scaffold requires a manual workaround and the wiring is not surfaced by txc help.
> **Remove when:** pp-plugin-test template Cleanup is fixed (T5) and sequences land in help/docs (T12).

# Unit tests for plugins and scripts

**Contract:** when this task ends, the requested test projects exist and
`dotnet test` passes on each. Everything runs in-process on the local machine —
FakeXrmEasy fakes the Dataverse pipeline in memory and Jest mocks `Xrm`; no
environment is contacted and nothing is deployed.

Two independent kinds — scaffold only the ones the repository needs:

- **Plugin tests** (`<plugin test project>`, default `src/Tests.Plugins`) — plugin logic tested as plain C# against FakeXrmEasy 3.x.
  Requires an existing plugin project (`plugin-development` reference).
- **Script tests** (`<script test project>`, default `src/Tests.Scripts`) — form/ribbon scripts tested as plain JavaScript; Jest loads the
  built web-resource bundle, and `dotnet test` drives Jest via the csproj's `RunJest`
  target. Requires an existing `<scripts project>`.

Resolve project slots per the `init` skill's `workspace-layout` reference file (an existing
repository's names win over the defaults).

## Plugin tests — Step 1: scaffold (first time only)

Skip if the workspace already has a plugin test project. From the repository root,
pre-create `.template.temp` first — the `pp-plugin-test` template's Cleanup
post-action fails and rolls the whole scaffold back when it is missing
(TOOLING-BACKLOG T5):

```
mkdir -p "<plugin test project>/.template.temp"
txc workspace component create pp-plugin-test --output "<plugin test project>"
dotnet sln add "<plugin test project>"
```

## Plugin tests — Step 2: reference the plugin project

The test project targets modern .NET while the plugin assembly stays on .NET Framework (the
Dataverse sandbox is .NET Framework — never retarget either side). `dotnet add
reference` refuses to link across that gap, so add the `ProjectReference` to
`<plugin test project>`'s csproj by editing the XML directly:

```xml
<ItemGroup>
  <ProjectReference Include="<relative path to the plugin project's csproj>" />
</ItemGroup>
```

The build itself resolves this fine via asset target fallback and prints **NU1702**
("resolved using .NETFramework... instead of...") — that warning is expected and
benign; do not "fix" it. The restore may also print NU1902/NU1903 advisories for
packages the test template pulls in transitively — not caused by your code.

## Plugin tests — Step 3: write tests

One `<PluginClassName>Tests.cs` per plugin class in `<plugin test project>`. Derive each
from the template's `FakeXrmEasyTestBase`: it builds `_context` (the `IXrmFakedContext`)
and `_service`, and sets the FakeXrmEasy license — `Commercial` by default (tests run without a key; whether your use needs a purchased
license is the user's call) — change it in the base class if that is not yours. Pattern: seed records with `_context.Initialize`,
execute the plugin with `ExecutePluginWithTarget`, assert on the faked data or on the
thrown `InvalidPluginExecutionException`. Attribute logical names carry the
`<PublisherPrefix>_` prefix.

## Plugin tests — Step 4: run

```
dotnet test "<plugin test project>" --nologo
```

Must pass. This is the edit-run loop: change plugin or test, re-run.

## Script tests — Step 1: scaffold (first time only)

Skip if the workspace already has a script test project. `ScriptLibraryPath` points
(relative to the test project) at the bundle `<scripts project>` builds — the same file that ships as the web resource is the file under
test:

```
txc workspace component create pp-test-script --output "<script test project>" --param "ScriptTestProjectName=<script test project name>" --param "ScriptLibraryPath=<relative path to the scripts project>/build/<PublisherPrefix>_main.js"
dotnet sln add "<script test project>"
```

## Script tests — Step 2: write tests

Test files go in `<script test project>/tests/*.test.js`. Nothing calls the template's
`setupXrm` for you (`jest.config.js` has no `setupFiles`): call it in `beforeAll`, and
assign the `Xrm` functions a test relies on as `jest.fn()` explicitly in `beforeEach` —
Jest 30 does not expose `global.jest` to `setupXrm`.

## Script tests — Step 3: run

The bundle must exist before the tests can load it:

```
dotnet build "<scripts project>" --nologo
dotnet test "<script test project>" --nologo
```

Must pass — `dotnet test` invokes Jest through the `RunJest` target, so one command
covers both C# and JS suites in CI and locally. A script-only test project also prints
"No test is available in …dll" and still exits 0; a failing Jest test is what fails the
run. The scaffolded csproj writes Windows-style backslash paths; they still worked on Linux (tools-devkit-templates#191).

## Summary

Report the test projects and test files created, that each `dotnet test` passed
(including the expected NU1702 warning if plugin tests were scaffolded), and that
everything ran locally with no environment touched.
