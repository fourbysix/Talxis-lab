> **Needed because:** the auth -> connection -> profile bootstrap order is not surfaced by txc help.
> **Remove when:** txc surfaces the bootstrap sequence in help/docs (T12).

# Set up runtime environments

**Contract:** this reference touches the cloud — it creates or connects
environments and binds txc profiles to them. Every other skill in this plugin is local;
importing the package is the `deployment` reference.

Default model (an existing team setup wins; a user may ask for another): source
control is the single source of truth, so environments are cheap and ephemeral —
prefer recreating one to repairing it. Dev is a personal build-and-break space; Test
is the stable target the CD pipeline deploys to. Give each developer their own Dev
environment: with a shared one, parallel unmanaged edits overwrite each other and
ownership of changes gets lost.

## Step 1 — Check what already exists

```
txc config auth list --format json
txc config connection list --format json
txc config profile list --format json
```

- A profile whose connection points at the desired environment URL → nothing to
  create; `txc config profile select <profile>` and report. Done.
- Auth exists but no connection/profile → skip to Step 4.
- No auth → Step 2.

## Step 2 — Sign in (only if no auth exists)

```
txc config auth login --device-code
```

Device-code flow: a code is shown, the user opens https://aka.ms/devicelogin and
pastes it. Start it only while the user is present and give them the code at once: it expires after about
5 minutes (start again with a new code). In a session without a terminal the command refuses
(stdin/stdout redirected); a pseudo-terminal works (`script -qec "txc config auth login --device-code" /dev/null`,
tools-cli#224; sign-in is always a deliberate human action, PR #173). Note the auth id from `txc config auth list --format json` — Step 4
binds it to the connection.

## Step 3 — Create the environment (only if none exists)

Ask once for: environment type (`Sandbox` for Dev/Test), display name, and a
domain unique in the tenant (e.g. suffix with initials or a random id).

`txc env create --help` lists the flags (type, name, domain, region, currency,
language); pass `--wait` so it blocks until the environment is ready.

The environment URL is `https://<domain>.crm4.dynamics.com` (region-dependent
suffix). Creation takes minutes.

## Step 4 — Bind connection and profile (no extra sign-in)

```
txc config connection create <name> --provider Dataverse --url <environment-url>
txc config profile create --name <name> --auth <auth-id> --connection <name>
```

Default naming: the same short name for connection and profile (`dev`, `test`),
one profile per environment (keep existing names if the machine has them). Verify with `txc config profile list --format json`.

## Step 5 — Enable code apps (only if the project has a code app)

Off by default on a new environment; a code app won't run there until it's on.
For each environment (Dev and Test):

```
txc env setting set PowerApps_AllowCodeApps true --profile <name>
```

Idempotent.
If `set` fails: admin center → Settings → Product → Features → Enable code apps.

## Step 6 — Select the default profile

```
txc config profile select dev
```

Pin the Dev profile as the default local deploy target. The Test profile exists
for the CD pipeline; local work should never deploy there by hand unless asked.

## Summary

Report: which environments/profiles were created vs already present, their URLs,
and which profile is now selected. Next step in one line: deploy the package with
the `deploy` skill (`txc env pkg import`).
