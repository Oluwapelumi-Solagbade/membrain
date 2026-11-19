# Deploy MemBrain API + Web App to Azure App Service in UAE North (Dubai) via PowerShell.
# Requires az login first.
param(
    [string]$App = "membrain-cerebrospark",
    [string]$Rg = "membrain-rg",
    [string]$Loc = "uaenorth",
    [string]$Sku = "B1",
    [string]$SpeechKey = ""
)

$ErrorActionPreference = "Stop"

# Locate az binary
$azCmd = "az"
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    $candidates = @(
        "C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd",
        "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $azCmd = $cand
            break
        }
    }
}

Write-Host "Using Azure CLI: $azCmd"

# Check authentication
try {
    & $azCmd account show --output table
} catch {
    Write-Error "Please run 'az login' before running this script."
    exit 1
}

# Resolve Speech Key
if (-not $SpeechKey) {
    if ($env:AZURE_SPEECH_KEY) {
        $SpeechKey = $env:AZURE_SPEECH_KEY
    } elseif (Test-Path ".env") {
        foreach ($line in (Get-Content ".env")) {
            if ($line -match "^AZURE_SPEECH_KEY=(.+)$") {
                $SpeechKey = $matches[1].Trim()
                break
            }
        }
    }
}

if (-not $SpeechKey) {
    $sec = Read-Host -Prompt "Paste the Azure Speech key" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $SpeechKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "==> Deploying $App to $Loc (resource group $Rg, plan $Sku)..."
& $azCmd group create --name $Rg --location $Loc --output none

Write-Host "==> Creating and uploading web app..."
& $azCmd webapp up --name $App --resource-group $Rg --location $Loc --sku $Sku --runtime "PYTHON:3.12" --output none

Write-Host "==> Configuring startup file..."
& $azCmd webapp config set --name $App --resource-group $Rg --startup-file "python -m uvicorn api.main:app --host 0.0.0.0 --port 8000" --output none

Write-Host "==> Configuring app settings (in-country speech + CORS)..."
& $azCmd webapp config appsettings set --name $App --resource-group $Rg --output none --settings `
    AZURE_SPEECH_KEY="$SpeechKey" `
    AZURE_SPEECH_REGION="$Loc" `
    ALLOWED_ORIGINS="https://teamcerebrospark.github.io,https://oluwapelumi-solagbade.github.io,https://$App.azurewebsites.net" `
    SCM_DO_BUILD_DURING_DEPLOYMENT=true

Write-Host "==> Restarting web app..."
& $azCmd webapp restart --name $App --resource-group $Rg --output none

Write-Host "==> Waiting for app startup (40s)..."
Start-Sleep -Seconds 40

Write-Host "==> Testing /health..."
try {
    $h = Invoke-RestMethod -Uri "https://$App.azurewebsites.net/health" -TimeoutSec 15
    Write-Host "Health status: $($h | ConvertTo-Json -Compress)"
} catch {
    Write-Warning "Health endpoint check: $_"
}

Write-Host "==> Testing /api/speech/config..."
try {
    $c = Invoke-RestMethod -Uri "https://$App.azurewebsites.net/api/speech/config" -TimeoutSec 15
    Write-Host "Speech config: $($c | ConvertTo-Json -Compress)"
} catch {
    Write-Warning "Speech config check: $_"
}

Write-Host "Deployed successfully: https://$App.azurewebsites.net/"
