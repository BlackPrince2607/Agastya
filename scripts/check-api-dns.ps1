# Verify Agastya API DNS + HTTPS reachability (run from repo root).
# Usage: npm run api:check-dns

$ErrorActionPreference = 'Continue'
$apiHost = 'agastya-production-b395.up.railway.app'
$apiUrl = "https://$apiHost/v1/health"
$systemDns = (Get-DnsClientServerAddress -AddressFamily IPv4 |
  Where-Object { $_.ServerAddresses.Count -gt 0 } |
  Select-Object -First 1).ServerAddresses[0]

Write-Host ''
Write-Host 'Agastya API connectivity check'
Write-Host "  API: $apiUrl"
Write-Host "  System DNS: $(if ($systemDns) { $systemDns } else { 'unknown' })"
Write-Host ''

function Test-DnsResolve([string]$Name, [string]$Server) {
  $lookupArgs = @($Name)
  if ($Server) { $lookupArgs += $Server }
  $out = & nslookup @lookupArgs 2>&1 | Out-String
  if ($out -match 'query refused|can''t find|Non-existent domain|NXDOMAIN') {
    return $null
  }
  $escaped = [regex]::Escape($Name)
  if ($out -match "Name:\s+$escaped\s+Address:\s+(\d+\.\d+\.\d+\.\d+)") {
    return $Matches[1]
  }
  return $null
}

$systemIp = Test-DnsResolve $apiHost $systemDns
$googleIp = Test-DnsResolve $apiHost '8.8.8.8'

if ($systemIp) {
  Write-Host "OK   System DNS resolves $apiHost -> $systemIp"
} else {
  Write-Host "FAIL System DNS cannot resolve $apiHost"
  if ($googleIp) {
    Write-Host "     Public DNS 8.8.8.8 resolves -> $googleIp"
    Write-Host ''
    Write-Host 'Fix: network DNS blocks *.up.railway.app (common on phone hotspots).'
    Write-Host '  Windows: adapter IPv4 DNS -> 8.8.8.8 and 1.1.1.1'
    Write-Host '  Android: Settings -> Network -> Private DNS -> dns.google'
    Write-Host '  iPhone: Wi-Fi -> Configure DNS -> Manual -> 8.8.8.8'
    Write-Host '  Dev fallback: npm run api and localhost:8000 in .env'
  } else {
    Write-Host '     Public DNS also failed - check Railway domain in dashboard.'
  }
}

Write-Host ''
try {
  $res = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 20
  Write-Host "OK   HTTPS health $($res.StatusCode) $($res.Content)"
  exit 0
} catch {
  if ($googleIp -and -not $systemIp) {
    Write-Host 'FAIL HTTPS health blocked by DNS issue above'
    Write-Host "     $($_.Exception.Message)"
    exit 1
  }
  Write-Host "FAIL HTTPS health $($_.Exception.Message)"
  exit 1
}
