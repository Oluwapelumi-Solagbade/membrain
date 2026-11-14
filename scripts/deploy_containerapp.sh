#!/usr/bin/env bash
# Deploy MemBrain (API + web app) to Azure Container Apps in UAE North.
# Works on Free Trial subscriptions where App Service quota in uaenorth is 0.
# Run from the repository root in Git Bash after `az login`.
set -euo pipefail
APP="${APP:-membrain}"; RG="${RG:-membrain-rg}"; LOC="${LOC:-uaenorth}"

az extension add --name containerapp --upgrade --only-show-errors
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry; do
  az provider register --namespace "$ns" --wait --only-show-errors
done
az group create --name "$RG" --location "$LOC" --output none

echo "Building the container in Azure and creating the app (5-10 minutes)…"
az containerapp up --name "$APP" --resource-group "$RG" --location "$LOC" \
  --source . --ingress external --target-port 8000 --only-show-errors

FQDN=$(az containerapp show --name "$APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)
read -r -s -p "Paste the Azure Speech key (input hidden): " KEY; echo
az containerapp secret set --name "$APP" --resource-group "$RG" --secrets speech-key="$KEY" --output none
unset KEY
az containerapp update --name "$APP" --resource-group "$RG" --output none --set-env-vars \
  AZURE_SPEECH_KEY=secretref:speech-key AZURE_SPEECH_REGION=uaenorth \
  ALLOWED_ORIGINS="https://oluwapelumi-solagbade.github.io,https://$FQDN"

echo "https://$FQDN" > web/api_url.txt
python scripts/build_web.py
sleep 20
curl -s "https://$FQDN/health"; echo
curl -s "https://$FQDN/api/speech/config" | head -c 120; echo
echo
echo "Live app: https://$FQDN/"
echo "Now commit and push so the GitHub Pages copy uses this API:"
echo "  git add web/api_url.txt web/dist/index.html && git commit -m 'Point Pages at Container App' && git push"
