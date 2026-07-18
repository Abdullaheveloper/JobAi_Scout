$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$certificateDirectory = Join-Path $workspaceRoot '.certs'
$pfxPath = Join-Path $certificateDirectory 'jobai-local.pfx'
$publicCertificatePath = Join-Path $certificateDirectory 'jobai-local.cer'

$lanAddress = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.AddressState -eq 'Preferred' -and
    $_.PrefixOrigin -in @('Dhcp', 'Manual') -and
    $_.InterfaceAlias -notmatch 'vEthernet|WSL|Hyper-V|VirtualBox|Loopback' -and
    $_.IPAddress -match '^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)'
  } |
  Sort-Object @{ Expression = { if ($_.IPAddress -like '192.168.*') { 0 } else { 1 } } }, InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $lanAddress) {
  throw 'No LAN IPv4 address was found. Connect to your local network and run this command again.'
}

New-Item -ItemType Directory -Force -Path $certificateDirectory | Out-Null
Remove-Item -LiteralPath $pfxPath, $publicCertificatePath -Force -ErrorAction SilentlyContinue
$password = 'jobai-local-dev'
$securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force

$certificate = New-SelfSignedCertificate `
  -Type SSLServerAuthentication `
  -Subject "CN=$lanAddress" `
  -TextExtension @("2.5.29.17={critical}{text}dns=localhost&ipaddress=$lanAddress") `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(2)

Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $securePassword | Out-Null
Export-Certificate -Cert $certificate -FilePath $publicCertificatePath | Out-Null
Import-Certificate -FilePath $publicCertificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null

Write-Host ''
Write-Host 'Local HTTPS is ready.' -ForegroundColor Green
Write-Host "Start the app with: npm run dev:https"
Write-Host "Open: https://$lanAddress`:5181/dashboard/assistant"
Write-Host "For another laptop, import this public certificate into Trusted Root Certification Authorities: $publicCertificatePath"
