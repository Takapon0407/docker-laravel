#!/usr/bin/env bash
# Drive the running site with a Playwright journey and keep the evidence.
#   bash .claude/skills/verify/scripts/drive.sh <journey.spec.ts> [desktop|mobile|all] [run-id]
# Evidence: <main checkout>/.verify/evidence/<run-id>/ (journey copy, drive.log, exit-code, playwright/ screenshots and traces,
# plus anything the journey writes under process.env.VERIFY_EVIDENCE). Nothing here deletes evidence.
set -euo pipefail

journey="${1:?usage: drive.sh <journey.spec.ts> [desktop|mobile|all] [run-id]}"
project="${2:-all}"
here="$(cd "$(dirname "$0")" && pwd)"
main="$(git -C "$here" worktree list --porcelain | sed -n '1s/^worktree //p')"
run_id="${3:-$(date +%Y%m%d-%H%M%S)-$(basename "$journey" .spec.ts)}"
evidence="$main/.verify/evidence/$run_id"
run="$main/.verify/run/$run_id"

[ -d "$main/laravel/node_modules/@playwright/test" ] || { echo "no Playwright in $main/laravel/node_modules (cd laravel && npm ci)" >&2; exit 1; }
mkdir -p "$evidence" "$run"
# The run dir sits outside laravel/, so link node_modules for the @playwright/test import.
ln -sfn "$main/laravel/node_modules" "$run/node_modules"
cp "$here/verify.config.ts" "$run/verify.config.ts"
cp "$journey" "$run/journey.spec.ts"
cp "$journey" "$evidence/journey.spec.ts"

args=(-c verify.config.ts)
[ "$project" = all ] || args+=(--project "$project")
set +e
(cd "$run" && VERIFY_EVIDENCE="$evidence" ./node_modules/.bin/playwright test "${args[@]}") 2>&1 | tee "$evidence/drive.log"
code=${PIPESTATUS[0]}
set -e
echo "$code" >"$evidence/exit-code"
rm -rf "$run"
echo "evidence: $evidence (exit $code)"
exit "$code"
