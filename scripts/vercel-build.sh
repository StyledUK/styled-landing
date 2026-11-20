#!/bin/sh
set -eu

# Stop before building if this deployment's environment variables would wire
# styleduk.com to the wrong database or site (see scripts/deploy-env-guard.mjs).
node scripts/deploy-env-guard.mjs

# Exercise the same fixtures in previews and production, with provider
# credentials excluded from the test processes and bounded memory usage.
env -i PATH="$PATH" HOME=/tmp CI=true node --test --test-concurrency=2 tests/*.test.cjs
npm run build
