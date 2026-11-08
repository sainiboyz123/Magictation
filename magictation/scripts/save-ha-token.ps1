# Saves a Home Assistant long-lived access token for deploy-ha.mjs (input is hidden).
$dir = Join-Path $env:USERPROFILE '.magictation'
New-Item -ItemType Directory -Force $dir | Out-Null
$secure = Read-Host 'Paste your Home Assistant token (hidden) and press Enter' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if (-not $plain.Trim()) { Write-Host 'Nothing pasted; token not saved.'; exit 1 }
[IO.File]::WriteAllText((Join-Path $dir 'ha_token'), $plain.Trim())
Write-Host "Token saved to $dir\ha_token ($($plain.Trim().Length) characters)."
