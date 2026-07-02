# Allow inbound TCP 8000 for Agastya dev API (physical phones on same Wi-Fi).
# Run in an elevated PowerShell:  npm run api:firewall

$ruleName = 'Agastya API Dev (TCP 8000)'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule already exists: $ruleName"
} else {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 8000 `
    -Profile Private, Domain | Out-Null
  Write-Host "Created firewall rule: $ruleName"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -match '^192\.168\.' -or $_.IPAddress -match '^10\.' -or $_.IPAddress -match '^172\.(1[6-9]|2\d|3[01])\.'
} | Select-Object -First 1).IPAddress

Write-Host ''
Write-Host "API should be reachable at: http://${ip}:8000/v1/health"
Write-Host 'Add to .env if auto-detect picks the wrong NIC:'
Write-Host "  EXPO_PUBLIC_AGASTYA_API_LAN_URL=http://${ip}:8000"
Write-Host ''
Write-Host 'If the phone still cannot connect, your router may use client isolation. Use ngrok:'
Write-Host '  npx ngrok http 8000'
Write-Host '  EXPO_PUBLIC_AGASTYA_API_LAN_URL=https://YOUR_NGROK_URL'
