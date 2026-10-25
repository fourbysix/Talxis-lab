> **Needed because:** pp-entity-view generates only a minimal lookup view, so columns must be patched by hand.
> **Remove when:** pp-entity-view emits complete layoutxml and fetchxml (T3).

# Views and subgrids

**Contract:** when this task ends, the view (and any subgrid) XML exists under
`<ui solution>` and `dotnet build` passes at the repository root. Local only —
nothing is deployed.

Prerequisites: the entity and its attributes exist in `<data-model solution>`; for a
subgrid, the parent form exists and you have its GUID (see the `forms` reference).

## Create a view

Scaffold `pp-entity-view` (entity schema name, display name, publisher prefix) into
`<ui solution>`. The view file lands at
`<ui solution>/Entities/<prefix>_<entity>/SavedQueries/{<view-guid>}.xml` —
the filename (braces stripped) **is** the view GUID; record it for subgrids.

## Patch the generated file (required — tooling backlog T3)

`pp-entity-view` generates a minimal **lookup** view, not a grid view. A view for a
list or a subgrid needs these hand edits in the generated file:

- `querytype="64"` → `querytype="0"` (public view); a subgrid needs a
  `querytype` 0 view (a new one, or the table's existing associated/"Active" view);
- the label: the scaffold ignores `DisplayName` and appends " Lookup View" — set the
  `name` to the intended label;
- `jump="name"` → `jump="<prefix>_name"` (the primary name column; `name` is not an
  attribute of the table);
- every extra column goes into **both** the `layoutxml` and the `fetchxml`. For each
  column `<prefix>_<column>`:
  - in `layoutxml`, append to the existing `<row>`:
    `<cell name="<prefix>_<column>" width="125" />`
  - in `fetchxml`, append to the existing `<entity>`:
    `<attribute name="<prefix>_<column>" />`

A column present in only one of the two renders empty or is dropped. Every `name`
must exist as an attribute of the entity in `<data-model solution>`.

## Add a subgrid to a parent form

A subgrid needs three identifiers gathered up front:

- the **parent form's GUID** (`FormId`) — generated when the form was scaffolded,
- the **view GUID** (`ViewId`) — the SavedQueries filename above, for the target entity,
- the **relationship name** (e.g. `ev_ev_supplier_ev_product_supplier` — read, do not
  compose) — without it the subgrid shows ALL records of the target
  entity, not just the parent's related rows. Read it from
  `<data-model solution>/Other/Relationships/<prefix>_<parententity>.xml`: the
  `Name` of the `EntityRelationship` whose `ReferencingAttributeName` is the lookup
  column on the target entity.

```
txc workspace component create pp-form-subgrid --output "<ui solution>" \
  --param "SubgridLabel=<Related Records>" \
  --param "FormType=main" \
  --param "FormId=<parent-form-guid>" \
  --param "TargetEntityLogicalName=<prefix>_<childentity>" \
  --param "EntityLogicalName=<prefix>_<parententity>" \
  --param "ViewId=<view-guid>" \
  --param "RelationshipName=<relationship name>"
```

`EntityLogicalName` is the entity whose form hosts the subgrid;
`TargetEntityLogicalName` is the entity whose records it lists.

## Validate

```
dotnet build
```

Must pass at the repository root. `TALXISXSD001` = malformed view/form XML (check the
patched `layoutxml`/`fetchxml` is well-formed); `TALXISGUID001` = duplicate GUID.
