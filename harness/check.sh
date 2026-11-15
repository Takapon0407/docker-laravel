#!/usr/bin/env bash
# 検証コマンド：これが exit 0 なら「完了」。実装ループの完了判定と Stop hook で使う
# 使い方：bash harness/check.sh [--quick]（--quick は E2E を飛ばす。途中の確認用で、完了判定には使わない）
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$(mktemp -d)"
QUICK="${1:-}"
failed=()

step() {
    local name="$1"
    shift
    printf '%-28s' "$name"
    if (cd "$ROOT" && "$@") >"$LOG_DIR/$name.log" 2>&1; then
        echo "ok"
    else
        echo "NG"
        failed+=("$name")
        tail -n 30 "$LOG_DIR/$name.log" | sed 's/^/    /'
    fi
}

app() {
    docker compose exec -T -w /var/www/laravel \
        -e AWS_ACCESS_KEY_ID= -e AWS_SECRET_ACCESS_KEY= -e AWS_EC2_METADATA_DISABLED=true \
        app "$@"
}

step features node harness/features.mjs check
step pint app php vendor/bin/pint --test
step phpstan app php vendor/bin/phpstan analyse --memory-limit=1G --no-progress
step phpunit app php artisan test
# artisan test が root でビューを作ると、php-fpm（www-data）が書けずローカルが 500 になる（CLAUDE.md のハマりどころ）
docker compose exec -T app sh -c 'chown -R www-data:www-data /tmp/views' >/dev/null 2>&1 || true
step ts-test sh -c 'cd laravel && npm test'
step build sh -c 'cd laravel && npm run build'
if [ "$QUICK" != "--quick" ]; then
    step e2e sh -c 'cd laravel && npm run e2e'
fi

rm -rf "$LOG_DIR"
if [ ${#failed[@]} -gt 0 ]; then
    echo "失敗：${failed[*]}"
    exit 1
fi
echo "すべて通りました"
