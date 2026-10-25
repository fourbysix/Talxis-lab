> **Needed because:** no template scaffolds a CMT data package (`txc component type list --search` finds nothing for
> cmt, configuration, migration or seed), and `txc docs get data-migration` covers export and import, not the files.
> **Remove when:** txc scaffolds a CMT data package from the tables in source (T26) and `dotnet build` of the package
> project refreshes the `.pdpkg.zip` (T27).

# Reference and seed data as source

**Contract:** when this task ends, `<package project>/Data/` holds a CMT data package with the requested records and
`dotnet build` passes. Local only — importing it is the `deploy` skill (deployment reference).

Records the app needs in every environment (locations, categories, configuration rows) live in source as a
Configuration Migration (CMT) data package: written by hand, reviewed in pull requests, imported the same way
everywhere. Its tables and columns must exist in `<data-model solution>` first.

## The files

A folder with three files:

- `data_schema.xml` — which tables and columns the package carries: `<entities>` holding, per table,
  `<entity name="<prefix>_<entity>" displayname="…" primaryidfield="<prefix>_<entity>id" primarynamefield="<prefix>_name" disableplugins="true">`
  with `<fields>`, one `<field displayname="…" name="<column>" type="<type>" />` per column (`customfield="true"` on
  custom columns). The primary key is `type="guid" primaryKey="true"`; a lookup is
  `type="entityreference" lookupType="<target table>"`. Types used so far: `guid`, `string`, `number` (whole number),
  `bool`, `optionsetvalue`, `money`, `datetime`, `entityreference`.
- `data.xml` — the records: `<entities>` holding, per table, `<entity name="…" displayname="…"><records>` with one
  `<record id="<guid>">` per record, one `<field name="<column>" value="…" />` per value, then `</records><m2mrelationships /></entity>`.
- `[Content_Types].xml` — fixed content:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/octet-stream" />
</Types>
```

Rules:

- Tables in the same order in both files, parents before children (a lookup's target table first).
- `disableplugins="true"` on every `<entity>` of the schema, so the import does not run the app's plugins on the rows.
- Every record gets a fixed GUID: the record's `id`, and the primary-key field carries the same value. Fixed GUIDs make a
  re-import update the records instead of duplicating them — generate them once, never change them.
- Values: a lookup is the target record's GUID plus `lookupentity="<target table>" lookupentityname="<target's name>"`;
  a choice is its integer option value (e.g. `100000000`, from the column's options in `Entity.xml`); a boolean is
  `True` / `False`; money is a plain number (`19.99`); a date and time is ISO 8601 UTC (`2026-01-15T00:00:00Z`).

Instead of writing `data.xml` by hand, records created in a Dev environment can be exported into it
(`txc data pkg export`, deployment reference).

## Where it goes and how it ships

Put the folder at `<package project>/Data/`. The package project's build finds it by itself through its
`[Content_Types].xml` (log: "Detected Cmt packages: …"; tested with TALXIS.DevKit.Build.Sdk 1.11.1; without that file
the folder is skipped silently) and fails with "data.xml not found for Cmt package" when a data file is missing. `dotnet publish` packs it into the `.pdpkg.zip` as
`PkgAssets/MainCmtPackage.zip`, named by `crmmigdataimportfile` in its `ImportConfig.xml`, so the package imports the
records. Only `dotnet publish` refreshes the `.pdpkg.zip`: `dotnet build` logs "Zipping Cmt packages" but leaves the old
one in place (T27). Check: `unzip -l <package project>/bin/<Configuration>/<project name>.pdpkg.zip` lists
`PkgAssets/MainCmtPackage.zip`.

## Summary

Report the tables and record counts in the package, that `dotnet build` passed, and that nothing was imported.
