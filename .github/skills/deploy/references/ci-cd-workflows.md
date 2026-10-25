> **Needed because:** workflow YAML, ruleset JSON, and the OIDC application-user sequence have no txc equivalent.
> **Remove when:** txc scaffolds pipelines/rulesets or surfaces them in docs (T12).

# GitHub Actions workflows

Copy each block into the named file under `.github/workflows/` and substitute the
placeholders: `<solution file>` (the solution file at the repository root, `.slnx` or
`.sln`) and `<package project>` (the folder of the project with `ProjectType`
PDPackage; resolve it per the `init` skill's `workspace-layout` reference file). `main`
stands for the default branch. The `build` job and `drop` artifact names are defaults
that other files depend on — the branch ruleset's required status check matches the
`build` job name, and `deploy.yml` downloads the artifact by name from the triggering
build run — so rename them everywhere or nowhere.

## build.yml

```yaml
name: build
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.x'  # the SDK the repository builds with
      # Code app projects build with Vite, which needs Node 20.19+ / 22.12+
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Restore
        run: dotnet restore <solution file>
      - name: Build (validates Dataverse solutions)
        run: dotnet build <solution file> --configuration Release --no-restore
      - name: Publish package
        run: |
          # No -o: an explicit output folder leaks into nested plugin builds (tools-devkit-build#109)
          dotnet publish <package project> --configuration Release --no-build
          # The .pdpkg.zip is created next to the project, not in a publish folder; collect it for deploy
          mkdir -p ./drop && cp <package project>/bin/Release/*.pdpkg.zip ./drop/
      - uses: actions/upload-artifact@v4
        with:
          name: drop
          path: ./drop/*.pdpkg.zip
```

Notes:

- The `.pdpkg.zip` quirk is real: `dotnet publish --output` does not receive the
  package — it lands in `<package project>/bin/Release/`, hence the explicit `cp`.
- `dotnet build` runs TALXIS workspace validation (XSD schema, duplicate GUIDs), so
  a green `build` check means the Dataverse solutions are structurally valid.

## deploy.yml

```yaml
name: deploy
on:
  workflow_run:
    workflows: [build]
    types: [completed]
    branches: [main]
permissions:
  id-token: write
  contents: read
  actions: read
jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: drop
          path: ./drop
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Install txc (a .NET tool)
        run: dotnet tool install --global TALXIS.CLI

      - name: Configure txc WIF auth
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          DATAVERSE_TEST_URL: ${{ secrets.DATAVERSE_TEST_URL }}
        run: |
          txc config auth add-federated --alias ci --tenant $AZURE_TENANT_ID --application-id $AZURE_CLIENT_ID
          txc config connection create test --provider Dataverse --url $DATAVERSE_TEST_URL
          txc config profile create --name ci --auth ci --connection test

      - name: Import dependency package
        run: txc env pkg import <dependency package> --profile ci

      - name: Deploy package to Test environment
        run: txc env pkg import ./drop/*.pdpkg.zip --profile ci
```

Notes:

- `permissions: id-token: write` is what lets the job request an OIDC token from
  GitHub; without it `txc config auth add-federated` has nothing to exchange.
  `actions: read` is what lets `download-artifact` fetch the artifact of another
  workflow run (`run-id`). The workflows could not be run in the test environment
  (YAML and ruleset JSON parse; names, placeholders and `txc` flags were checked).
- The txc chain is auth → connection → profile: the `ci` profile binds the federated
  auth to the `test` connection, and every `txc env pkg import` runs `--profile ci`.
- `<dependency package>` is the NuGet package id of a package this repository does not
  build (e.g. a PCF control's) — one step per package, before the main import; drop the step
  when there are none.
