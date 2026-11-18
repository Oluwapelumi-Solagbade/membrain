#!/usr/bin/env bash
# Deploy the MemBrain API + web app to Azure App Service in UAE North (Dubai).
# Run from the repository root (macOS/Linux terminal or Git Bash) after `az login`.
# The Speech key is typed at a hidden prompt and stored only as an App Service setting.
set -euo pipefail

APP="${APP:-membrain-cerebrospark}"        # must be globally unique -> https://$APP.azurewebsites.net
RG="${RG:-membrain-rg}"
LOC="${LOC:-uaenorth}"
SKU="${SKU:-B1}"                           # B1 is the smallest always-on Linux plan; F1 (free) if your subscription allows it in UAE North

# Build the front end first: the API serves site/out at "/".
echo "Building the site (site/out)…"
(cd site && npm ci --no-audit --no-fund && NEXT_PUBLIC_SITE_URL="https://$APP.azurewebsites.net" npm run build)

echo "Deploying $APP to $LOC (resource group $RG, plan $SKU)…"
az group create --name "$RG" --location "$LOC" --output none
az webapp up --name "$APP" --resource-group "$RG" --location "$LOC" --sku "$SKU" --runtime "PYTHON:3.12" --output none
az webapp config set --name "$APP" --resource-group "$RG" \
  --startup-file "python -m uvicorn api.main:app --host 0.0.0.0 --port 8000" --output none

read -r -s -p "Paste the Azure Speech key (input hidden): " KEY; echo
# Optional: the Telegram bot (docs/TELEGRAM_BOT.md). Leave empty to skip; an earlier token stays set.
read -r -s -p "Paste the Telegram bot token from @BotFather (input hidden, Enter to skip): " TG; echo
TG_SETTINGS=()
if [ -n "$TG" ]; then
  TG_SETTINGS=(TELEGRAM_BOT_TOKEN="$TG" TELEGRAM_WEBHOOK_URL="https://$APP.azurewebsites.net/telegram/webhook")
fi
az webapp config appsettings set --name "$APP" --resource-group "$RG" --output none --settings \
  AZURE_SPEECH_KEY="$KEY" AZURE_SPEECH_REGION="uaenorth" \
  ALLOWED_ORIGINS="https://oluwapelumi-solagbade.github.io,https://$APP.azurewebsites.net" \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true ${TG_SETTINGS[@]+"${TG_SETTINGS[@]}"}
unset KEY TG TG_SETTINGS
az webapp restart --name "$APP" --resource-group "$RG" --output none

echo "Waiting for the app to start…"; sleep 40
curl -s "https://$APP.azurewebsites.net/health"; echo
curl -s "https://$APP.azurewebsites.net/api/speech/config" | head -c 120; echo
curl -s "https://$APP.azurewebsites.net/telegram/status"; echo
echo "Open: https://$APP.azurewebsites.net/"
