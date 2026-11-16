#!/usr/bin/env bash
# Deploy the MemBrain API + web app to Azure App Service in UAE North (Dubai).
# Run from the repository root in Git Bash after `az login`.
# The Speech key is typed at a hidden prompt and stored only as an App Service setting.
set -euo pipefail

APP="${APP:-membrain-cerebrospark}"        # must be globally unique -> https://$APP.azurewebsites.net
RG="${RG:-membrain-rg}"
LOC="${LOC:-uaenorth}"
SKU="${SKU:-B1}"                           # B1 is the smallest always-on Linux plan; F1 (free) if your subscription allows it in UAE North

# Build the front end first: the API serves site/out at "/" (with the earlier prototype at /prototype/).
echo "Building the site (site/out)…"
(cd site && npm ci --no-audit --no-fund && NEXT_PUBLIC_SITE_URL="https://$APP.azurewebsites.net" npm run build)

echo "Deploying $APP to $LOC (resource group $RG, plan $SKU)…"
az group create --name "$RG" --location "$LOC" --output none
az webapp up --name "$APP" --resource-group "$RG" --location "$LOC" --sku "$SKU" --runtime "PYTHON:3.12" --output none
az webapp config set --name "$APP" --resource-group "$RG" \
  --startup-file "python -m uvicorn api.main:app --host 0.0.0.0 --port 8000" --output none

read -r -s -p "Paste the Azure Speech key (input hidden): " KEY; echo
az webapp config appsettings set --name "$APP" --resource-group "$RG" --output none --settings \
  AZURE_SPEECH_KEY="$KEY" AZURE_SPEECH_REGION="uaenorth" \
  ALLOWED_ORIGINS="https://oluwapelumi-solagbade.github.io,https://$APP.azurewebsites.net" \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true
unset KEY
az webapp restart --name "$APP" --resource-group "$RG" --output none

echo "Waiting for the app to start…"; sleep 40
curl -s "https://$APP.azurewebsites.net/health"; echo
curl -s "https://$APP.azurewebsites.net/api/speech/config" | head -c 120; echo
echo "Open: https://$APP.azurewebsites.net/"
