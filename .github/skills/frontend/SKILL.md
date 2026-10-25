---
name: frontend
description: Builds the user interface of a TALXIS / Power Platform / Dataverse app — screens, pages, forms, lists, navigation, custom UI controls, client-side scripts. Use when creating or changing anything the user sees or clicks.
---

# Frontend

**Contract:** UI components are scaffolded locally and `dotnet build` passes.
Local only — nothing deploys; code apps preview locally with `npm run dev`.

## Ask the CLI first

```
txc component type list --search <term>            # find the component type
txc workspace component create --help              # project templates (page, code app, script library)
txc workspace component parameter list <type>      # every parameter, typed
txc docs get form-xml-reference                    # form structure guide
```

## Intent → component type

| You want | Component type / command |
|---|---|
| an application shell users open | model-driven app — `--search app` |
| navigation (menu areas, groups, links) | sitemap types — `--search sitemap` |
| a detail/edit screen for a table | form — `--search form` |
| a list of records | view — `--search view` |
| a fully custom page (React) | generative page project template |
| a fully custom SPA (React + Vite) | code app project template |
| external API data in a code app | a custom connector (`backend` skill) bound with `pa` (code-apps reference) |
| a packaged PCF control on a form | `txc workspace control attach` |
| client-side logic on forms | script library project template + event handler types |
| a toolbar / command-bar button | ribbon types — `--search ribbon` |

## Sequence

1. UI components go in the Dataverse solution that holds the UI in this repository (the
   default split has its own, `src/Solutions.UI`; resolve the real project per the `init`
   skill's `workspace-layout` reference file, which also defines the terms). Exception: the default forms and views
   of a table are created with the table and sit in `<data-model solution>` — edit them there. Create a new solution
   only if the repository has none. A table defined in another solution project is
   referenced with a `Behavior=Existing` entity reference, not copied; a table in the same
   project needs none.
2. The table and all columns a form or view shows must already exist
   (`data-model` skill) before the form or view is created.
3. Compose top-down and register as you go: app → navigation → forms/views →
   scripts/PCF controls. `dotnet build` after each addition.

## Invariants

- Forms are an XML hierarchy — never skip a level, every field must exist as a
  column, every GUID unique. Generate a form's GUID up front and reuse it for
  subgrids, event handlers, and adding the form to the app (T4).
- Generated views contain only the primary column — columns must be patched into
  the view XML (T3).
- Code apps generate typed data access **offline from local metadata** —
  no live environment needed (a connector data source is the exception: bound live).
- Code app services return `{ success, error }` instead of throwing: check `success` on
  every call, or a save the server refused shows as done.

Details: [references/](references/) — forms, views-subgrids, model-app,
form-scripts, ribbon, pcf-controls, code-apps, generative-pages
