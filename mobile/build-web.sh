#!/usr/bin/env bash
# Builds the site as the app (the home screen is the app; NEXT_PUBLIC_MOBILE=1) into mobile/www.
# It talks to the live MemBrain server when it answers, and runs on the phone (the browser-only engine) when not.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
api="${MEMBRAIN_API_URL:-https://vulcan-spark-membrain.hf.space}"
cd "$here/../site"
[ -d node_modules ] || npm ci --no-audit --no-fund
NEXT_PUBLIC_MOBILE=1 NEXT_PUBLIC_API_URL="$api" NEXT_PUBLIC_SITE_URL="https://localhost" npm run build
rm -rf "$here/www"
cp -R out "$here/www"
rm -rf "$here/www/demo"   # the landing page's demo videos (14 MB); the app never shows them
echo "web build for the app -> mobile/www (API: $api)"
