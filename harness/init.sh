#!/usr/bin/env bash
# 実装ループの最初に実行する：ローカルのサイトを起動し、開けることを確かめる
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose up -d
docker compose exec -T -w /var/www/laravel app composer install --no-interaction --quiet
(cd laravel && npm install --no-audit --no-fund --silent && npx playwright install chromium >/dev/null && npm run build >/dev/null)

for _ in $(seq 1 30); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)" = "200" ]; then
        echo "サイトが起動しています：http://localhost/"
        exit 0
    fi
    sleep 2
done
echo "http://localhost/ が 200 を返しません（docker compose logs を確認）" >&2
exit 1
