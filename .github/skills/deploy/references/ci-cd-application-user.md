> **Needed because:** workflow YAML, ruleset JSON, and the OIDC application-user sequence have no txc equivalent.
> **Remove when:** txc scaffolds pipelines/rulesets or surfaces them in docs (T12).

# Add the service principal as a Dataverse application user

Why the OData API and not `pac admin assign-user`: pac requires an interactive pac
auth profile which is not available in CI or headless shells (e.g. Codespaces),
while `az` is already authenticated and can mint a Dataverse-scoped token directly.

Run in PowerShell (`pwsh`). Inputs: `$appId` (the client id of the deploy app registration) and
`$testUrl` (the test environment URL, e.g. `https://yourenv.crm4.dynamics.com`).

```powershell
$dvToken = (az account get-access-token --resource $testUrl --query accessToken -o tsv)
$dvHeaders = @{ Authorization="Bearer $dvToken"; 'Content-Type'='application/json'; 'OData-Version'='4.0' }
$dvBase   = $testUrl.TrimEnd('/')

# Check if the application user is already registered
$existing = (Invoke-RestMethod "$dvBase/api/data/v9.2/systemusers?`$filter=applicationid eq $appId&`$select=systemuserid" -Headers $dvHeaders).value
if (-not $existing) {
    # Get root business unit
    $buId = (Invoke-RestMethod "$dvBase/api/data/v9.2/businessunits?`$filter=parentbusinessunitid eq null&`$select=businessunitid" -Headers $dvHeaders).value[0].businessunitid
    # Create application user
    $body = @{ applicationid=$appId; 'businessunitid@odata.bind'="/businessunits($buId)" } | ConvertTo-Json
    Invoke-RestMethod "$dvBase/api/data/v9.2/systemusers" -Method Post -Headers $dvHeaders -Body $body | Out-Null
    $existing = (Invoke-RestMethod "$dvBase/api/data/v9.2/systemusers?`$filter=applicationid eq $appId&`$select=systemuserid" -Headers $dvHeaders).value
}
$userId = $existing[0].systemuserid

# Assign the System Administrator role (root BU scope only)
$roleId = (Invoke-RestMethod "$dvBase/api/data/v9.2/roles?`$filter=name eq 'System Administrator' and _parentroleid_value eq null&`$select=roleid" -Headers $dvHeaders).value[0].roleid
$alreadyAssigned = (Invoke-RestMethod "$dvBase/api/data/v9.2/systemusers($userId)/systemuserroles_association?`$filter=roleid eq $roleId&`$select=roleid" -Headers $dvHeaders).value
if (-not $alreadyAssigned) {
    $ref = @{ '@odata.id'="$dvBase/api/data/v9.2/roles($roleId)" } | ConvertTo-Json
    Invoke-RestMethod "$dvBase/api/data/v9.2/systemusers($userId)/systemuserroles_association/`$ref" -Method Post -Headers $dvHeaders -Body $ref | Out-Null
}
```

Verify: the first `systemusers?$filter=applicationid eq $appId` query now returns
one record, and the role association query returns the System Administrator role.

System Administrator keeps setup simple but breaks least-privilege. In production,
give the deploy principal a custom security role scoped to what package imports actually
need, and never a tenant-level Power Platform admin role.
