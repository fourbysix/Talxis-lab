> **Needed because:** managed/unmanaged doctrine and destructive-vs-safe semantics are invisible in txc help.
> **Remove when:** destructive/read-only annotations reach --help (T13) and doctrine lands in help/docs (T12).

# Dataverse solution layers and routing

**Contract:** a decision reference — routing and triage rules only. Local inspection
is free; layer inspection needs a live environment and a valid profile.

## Managed vs unmanaged doctrine

- **Unmanaged** = the open, editable working state of a Dev environment. Debug
  builds pack unmanaged.
- **Managed** = sealed, layered artifacts for every downstream environment: they
  merge as diff layers, can be cleanly uninstalled, and managed properties can
  restrict edits. Release builds pack managed.
- **Production never contains unmanaged components.** Humans edit only in Dev
  (and those edits are pulled back to source with `txc env solution pull`);
  pipelines only ever ship built packages forward.
- Never move unmanaged solutions between environments — managed is the transport
  format.

| Target | Import |
|---|---|
| Dev | unmanaged (Debug build) |
| Test/UAT | managed (Release build) |
| Production | managed only — never unmanaged |
| Unsure | ask the user; default to managed for safety |

## Component-to-solution routing

Facts that hold with any split: a component belongs to the Dataverse solution project
that contains it; a form or view needs its table's definition in the same solution or a
`Behavior=Existing` reference to it; import order follows the package project's
`ProjectReference`s.

**Default** (new repository, nothing else said): one solution per concern. It keeps
schema, logic, UI and access changes out of each other's diffs and lets each be
deployed and owned on its own; one big solution holding everything trades that away
(larger diffs and merge conflicts, one unit of deployment and ownership). It is a
recommendation, not a requirement.

| Component | Solution (default name in a new repository) |
|---|---|
| Table, column, relationship, option set | `<data-model solution>` (`Solutions.DataModel`) |
| Plugin registration, Dataverse workflow, business rule | `<logic solution>` (`Solutions.Logic`) |
| Form, view, model-driven app, sitemap | `<ui solution>` (`Solutions.UI`) |
| Security role, field-level security | `<security solution>` (`Solutions.Security`) |
| Custom connector | `<connector solution>` (`Solutions.Connectors`) |
| Unsure | `txc workspace explain` — inspect the workspace and follow the repo's own convention |

**Other splits.** If the repository already uses different solution names or layering,
its convention wins; so does an explicit user choice (a single solution, a split by
domain or feature, tables and UI together). Put each component in the solution project
that holds that concern in that repository, resolved by what the projects contain;
several concerns may be the same project. Do not create a new solution project unless
asked or the repository has no home for the component (precedence and slot
resolution: the `init` skill's `workspace-layout` reference file).

## Layer conflict triage

When a deployed component behaves unexpectedly, list its solution layers in the
environment and read them top-down:

- **Multiple managed layers** → the topmost managed layer wins; fix by updating
  the solution that owns that layer, not the one underneath.
- **Unmanaged active layer on top** → it blocks managed updates from showing;
  remove the active customization, then re-verify.
- **Single layer but still wrong** → the import likely succeeded without a
  publish — publish customizations and re-check before touching layers.

Layer inspection is live-environment only — the local workspace has no layer
concept.

## Uninstall safety

Before uninstalling a Dataverse solution, check its dependencies first
(`txc env solution uninstall-check <name>` lists blocking dependencies); resolve them
before removing. If a data-loss warning appears, get explicit user confirmation.
Never uninstall in production without checking.

Uninstalling an **unmanaged** Dataverse solution (`env solution uninstall|delete`,
`env pkg uninstall`) removes only the solution container — tested: the tables, roles,
app, plugin assembly and steps and web resources stay in the environment, and each
needs its own delete (`txc env entity delete`, `txc env data record delete`). (Uninstalling
a managed solution removes its components — Dataverse behaviour, not tested here.)
