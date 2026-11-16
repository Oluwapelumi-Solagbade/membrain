# Deploy MemBrain to Azure (UAE North): step by step

This puts the API and the demo on one in-country address, `https://membrain-cerebrospark.azurewebsites.net`. Live Arabic speech recognition then works through Azure Speech. The GitHub Pages link keeps working too, and calls this API for speech.

## Once: install and sign in
1. Install the Azure CLI. Windows: https://aka.ms/installazurecliwindows, then reopen Git Bash. Mac: `brew install azure-cli`.
2. Run `az login`. A browser opens; sign in with the team's Azure account.
3. Run `az account show --output table` and check it shows the right subscription.

## Protect the key first
In the Azure portal, open the Speech resource → **Keys and Endpoint**. Copy **Key 2**, then click **Regenerate Key 1**. Key 1 has been shared in chat, so it should no longer work.

## Deploy
From the `membrain` folder in Git Bash:
```bash
git pull
bash scripts/deploy_azure.sh
```
- When it asks, paste **Key 2**. The input is hidden.
- Next it asks for the Telegram bot token from @BotFather (hidden too). Press Enter to skip. See [docs/TELEGRAM_BOT.md](docs/TELEGRAM_BOT.md).
- It takes 5–10 minutes.
- At the end it prints `{"status":"ok"...}` and `{"enabled":true...}`.

If the name is taken, choose another:
```bash
APP=membrain-cerebrospark2 bash scripts/deploy_azure.sh
```
Then tell Claude the new name so the GitHub Pages default (`DEFAULT_API` in `web/app.js`) can be updated.

## Test
- Open `https://membrain-cerebrospark.azurewebsites.net/` in Chrome.
- Go to Participant app, pick Fatima (Arabic), allow the microphone, and speak the words.
- The side panel should read "Speech recognition: Azure AI Speech, uaenorth".

## Update after code changes
```bash
git pull
az webapp up --name membrain-cerebrospark --resource-group membrain-rg
```

## Cost and clean-up
- B1 is a small paid plan, covered by Azure credits. Stop it after judging with `az webapp stop --name membrain-cerebrospark --resource-group membrain-rg`, or delete everything with `az group delete --name membrain-rg`.
- The Speech free tier (F0) has a monthly audio limit. Check it on the Azure pricing page.
- Data in the demo API is held in memory and resets when the app restarts. It is synthetic only; **no real participant data**.
