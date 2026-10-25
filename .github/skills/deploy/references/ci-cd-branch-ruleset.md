> **Needed because:** workflow YAML, ruleset JSON, and the OIDC application-user sequence have no txc equivalent.
> **Remove when:** txc scaffolds pipelines/rulesets or surfaces them in docs (T12).

# Branch ruleset for main

Both calls take JSON via `--input` — write the payload to a file first. Rulesets are
idempotent by name: before creating, check whether one already exists:

```
gh api "repos/<owner>/<repo>/rulesets" -q '.[] | select(.name=="<repo>-main-protection") | .id'
```

## Create the ruleset (PRs only, no deletion, no force pushes)

`ruleset.json` — set `required_approving_review_count` to the number gathered from
the user (0 solo, >= 1 for a team):

```json
{
  "name": "<repo>-main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
    }}
  ]
}
```

```
gh api -X POST "repos/<owner>/<repo>/rulesets" --input ruleset.json
```

The response body contains the ruleset `id` — keep it for the update below.

## Add the required build check

Only meaningful after the `build` workflow has reported at least once (the status
check context must exist). The PUT **replaces the entire `rules` array** — send
every rule, not just the new one. `rules-update.json`:

```json
{
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
    }},
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "build" } ]
    }}
  ]
}
```

```
gh api -X PUT "repos/<owner>/<repo>/rulesets/<id>" --input rules-update.json
```

`strict_required_status_checks_policy: true` additionally requires the PR branch to
be up to date with main before merging — every integration is tested against the
actual trunk, not a stale base.
