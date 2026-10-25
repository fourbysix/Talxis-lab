---
name: security
description: Defines who can do what in a TALXIS / Power Platform / Dataverse app — security roles, permissions, record access levels. Use when granting or restricting access to tables, records, or features.
---

# Security

**Contract:** roles and privileges are scaffolded locally and `dotnet build`
passes. Local only — nothing deploys; assigning roles to real users happens in a
live environment via the `deploy` skill's profile.

## Ask the CLI first

```
txc component type list --search role              # role + privilege types
txc workspace component parameter list <type>      # every parameter, typed
txc docs get security-roles                        # long-form guide
```

## Intent → component type

| You want | Component type |
|---|---|
| a named set of permissions | security role — `--search role` |
| what a role may do on a table | role privilege type |

## Sequence

1. Security roles go in the Dataverse solution that holds them in this repository (the default
   split has its own, `src/Solutions.Security`; resolve it per the `init` skill's
   `workspace-layout` reference file, which also defines the terms). Create one only if the
   repository has none.
2. Create the role, then one privilege entry per table it touches.
3. `dotnet build`.

## Invariants

- Privilege **depth**: Basic = own records · Local = business unit · Deep = unit
  + children · Global = whole organization. Grant the shallowest depth that works.
- Default: model roles for **personas, not people** (an existing role scheme wins);
  test users get least-privilege roles, never admin.

Details: [references/roles.md](references/roles.md)
