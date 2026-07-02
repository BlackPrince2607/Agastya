# Create a git commit without prepare-commit-msg hooks (avoids Cursor co-author trailer).
param(
  [Parameter(Mandatory = $true)][string]$Subject,
  [string]$Body = ""
)

$ErrorActionPreference = "Stop"
Set-Location (git rev-parse --show-toplevel)

git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $tree = git write-tree
  $parent = git rev-parse HEAD
  $args = @("commit-tree", $tree, "-p", $parent, "-m", $Subject)
  if ($Body) { $args += @("-m", $Body) }
  $new = & git @args
  if (-not $new) { throw "git commit-tree failed" }
  git reset --hard $new
  Write-Host "Created commit $new"
  git log -1 --format="%h %an - %s"
} else {
  Write-Host "Nothing staged."
}
