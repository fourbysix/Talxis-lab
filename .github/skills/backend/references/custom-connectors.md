> **Needed because:** txc help does not say how a connector project ships (its own Dataverse solution, deployed on its
> own) or which name apps bind it by, `--search` finds the type only by the word "connector", and the connector solution's
> build prints schema warnings for valid connector metadata.
> **Remove when:** txc surfaces the connector sequence in help/docs (T12) and finds the type by intent (T11), the build
> validates connector metadata without warnings (T25), and txc binds a deployed connector to a code app (T28).

# Wrap an external API as a custom connector

**Contract:** when this task ends, `<connector project>` and the Dataverse solution that ships it exist, and
`dotnet build` passes. Local only; Step 3 touches the cloud and runs only when the user asked to deploy.

A custom connector is an OpenAPI (swagger) definition of an external API, with optional C# custom code that changes
requests and responses; apps and flows call the API through it. Component type `Connector` (template `pp-connector`;
`txc component type explain Connector`).

## Step 1 — Scaffold the connector project

`txc workspace component parameter list pp-connector` lists the inputs (`Host`, `DisplayName`, `Description`,
`AuthType`, `TransformScript`). Default folder `src/Connectors.<Name>`:

```
txc workspace component create pp-connector --output "<connector project>" --param "Host=<api host>" --param "DisplayName=<Display Name>" --param "Description=<what it does>" --param "AuthType=NoAuth" --param "TransformScript=true"
dotnet sln add "<connector project>"
```

Expected outcome: a project with `ProjectType` Connector, `apiDefinition.swagger.json`, `apiProperties.json` and,
with `TransformScript=true`, a starter `script.csx` (custom code; the build picks it up). Replace the placeholder
operations in the swagger with the API's real ones: each `operationId` becomes a method name in the app.

## Step 2 — Ship it in its own Dataverse solution

By default a connector gets its own solution (default `src/Solutions.Connectors`), so it is deployed and can be tried
before any app binds to it:

```
txc workspace component create pp-solution --output "<connector solution>" --param "PublisherName=<PublisherName>" --param "PublisherPrefix=<PublisherPrefix>" --param "GeneratePluginAssembly=false"
dotnet add "<connector solution>" reference "<connector project>"
dotnet build "<connector solution>"
```

Expected outcome: the solution is in `dotnet sln list`, and its built zip (`<connector solution>/bin/Debug/<target
framework>/`) holds `Connector/<prefix>_<name>_openapidefinition.json`, with a root component of type 372 in
`solution.xml`. `<prefix>_<name>` is the connector's Dataverse schema name: the project name in lowercase without dots
(e.g. `Connectors.Weather` → `<prefix>_connectorsweather`). The build prints about 11 warnings, TXVAL002 "Could not find
schema information for the element 'connectorid'" (one per connector element) and "Following root components are not
defined in customizations: Type='ECConnector'": harmless, the zip still contains the connector (T25).

## Step 3 — Deploy (only when the user asked)

```
txc env sln import "<connector solution>" --wait --profile <profile>
```

Deploy it to every environment where an app uses it, before binding the app (an app imported without it still imports,
but its connector data source does not work there). Not tested: shipping it inside the Package Deployer package through a
`ProjectReference` from `<package project>`.

## Step 4 — Call it from a code app

The `frontend` skill's code-apps reference ("Connector data sources") binds the deployed connector with `pa`.

## Summary

Report the connector and solution projects, the operations defined, that `dotnet build` passed, and whether it was
deployed (profile) or not.
