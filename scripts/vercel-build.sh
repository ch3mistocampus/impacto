#!/usr/bin/env bash
# Vercel build: production deploys Convex functions to the prod deployment and
# injects NEXT_PUBLIC_CONVEX_URL; previews (no deploy key) build against dev.
set -euo pipefail
if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
  npx convex deploy --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
else
  export NEXT_PUBLIC_CONVEX_URL="${NEXT_PUBLIC_CONVEX_URL:-https://precise-camel-918.convex.cloud}"
  pnpm build
fi
