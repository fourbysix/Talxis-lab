> **Needed because:** privilege depth semantics and the role/privilege sequence are not surfaced by txc help.
> **Remove when:** txc surfaces sequences and privilege semantics in help/docs (T12), and the
> docs and the scaffold agree on the valid depths (TALXIS/tools-cli#208).

# Implement security roles

**Contract:** when this task ends, `<security solution>` contains the requested
roles and privileges, is referenced by `<package project>`, and `dotnet build` passes at
the repository root. Local only — no cloud environment is touched.

Default approach (an existing role scheme or an explicit instruction wins): model roles
for **personas** (e.g. "Sales rep", "Sales manager") rather than individual people.
Least-privilege by design — grant each persona only what its workflow needs, and give
automated test users a least-privileged role too, never an admin account. By default security
config lives in its own Dataverse solution; `<security solution>` is whichever project holds
roles in the repository at hand (slots:
[workspace-layout](../../init/references/workspace-layout.md)).

## Step 1 — Gather inputs (once)

`<PublisherName>`, `<PublisherPrefix>` from the workspace (an existing solution
project's csproj has them). For each role: a persona name. For each role × entity: the privilege matrix
(types + depth). The entities must already exist in the workspace (see the
`data-model` skill).

## Step 2 — Create the Dataverse solution (first time only)

Skip if the workspace already has a Dataverse solution that holds roles (in a
single-solution repository, its one solution). Otherwise create it like any solution
project (default `src/Solutions.Security`) — `pp-solution` and a `ProjectReference` from
`<package project>`; the `data-model` skill's `scaffolding` reference file shows the commands and the outcome to
check (project listed by `dotnet sln list`, shipped in the Package Deployer package).

## Step 3 — Create roles

One `pp-security-role` per persona; the privilege commands below must repeat the same `RoleName`
exactly:

```
txc workspace component create pp-security-role --output "<security solution>" --param "RoleName=<Persona name>"
```

## Step 4 — Grant privileges

One command per role × entity. `PrivilegeTypeAndLevel` is a single-line array of
`{ PrivilegeType: <type>, Level: <depth> }` pairs — copy the syntax exactly:

```
txc workspace component create pp-security-role-privilege --output "<security solution>" --param "RoleName=<Persona name>" --param "PrivilegeTypeAndLevel=[{ PrivilegeType: Read, Level: Global }, { PrivilegeType: Write, Level: Basic }, { PrivilegeType: Create, Level: Basic }]" --param "EntityLogicalName=<PublisherPrefix>_<entity>"
```

- `PrivilegeType`: `Read`, `Write`, `Create`, `Delete`, `Append`, `AppendTo`.
- `Level` (depth — how far the privilege reaches): `Basic` = own records, `Local` =
  own business unit, `Deep` = BU plus child BUs, `Global` = whole organization. These
  four are the only valid names: the scaffold writes any string, but the build rejects
  others — including `User`, `BusinessUnit`, `ParentChild` and `None` as listed in
  `txc docs get security-roles`. Leave a privilege out instead of granting `None`.
- `RoleName` must match the role's name exactly in the role and privilege commands.
- Grant `Append`/`AppendTo` wherever the persona sets lookups between the tables.
- Privileges on a table owned by another solution project need no `Behavior=Existing`
  entity reference in `<security solution>` (a role scaffolded with no entity references
  built fine). A `Behavior=Existing` reference for a table defined in the same solution
  project fails the build with TXM004 (TALXIS/tools-devkit-templates#185).
- When a table is added later, extend the existing roles with it — a new table has no
  privileges in any role until you grant them, so personas silently can't use it.
- A deliberate matrix beats uniform grants: e.g. a worker reads everything (`Read`
  Global) but edits only records they own (`Write` Basic).

## Step 5 — Validate

```
dotnet build
```

Must pass. `TALXISXSD001` = schema validation failed (fix the reported XML);
`TALXISGUID001` = duplicate GUID (regenerate the reported id).

## Step 6 — Summary

Report the roles and the privilege matrix per entity, that `<package project>` references
the Dataverse solution, that `dotnet build` passed, and that nothing was deployed. Suggest the
next step in one line: build the app and navigation (`model-app` reference of the `frontend` skill), or deploy
the package (`deploy` skill).
