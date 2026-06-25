param(
  [string]$Owner = "trust-standard-protocol",
  [string]$Repo = "",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not $Repo) {
  $topLevel = git rev-parse --show-toplevel
  $Repo = Split-Path -Leaf $topLevel
}

$payload = @{
  required_status_checks = @{
    strict = $true
    contexts = @("claim-lint")
  }
  enforce_admins = $true
  required_pull_request_reviews = @{
    dismiss_stale_reviews = $true
    require_code_owner_reviews = $false
    required_approving_review_count = 1
  }
  restrictions = $null
  required_linear_history = $true
  allow_force_pushes = $false
  allow_deletions = $false
  required_conversation_resolution = $true
} | ConvertTo-Json -Depth 10

$tmp = New-TemporaryFile
try {
  Set-Content -LiteralPath $tmp -Value $payload -Encoding utf8NoBOM
  gh api `
    --method PUT `
    -H "Accept: application/vnd.github+json" `
    -H "X-GitHub-Api-Version: 2022-11-28" `
    "/repos/$Owner/$Repo/branches/$Branch/protection" `
    --input $tmp

  Write-Host "Branch protection applied to $Owner/$Repo@$Branch"
}
finally {
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}
