#!/bin/bash
# 指定したリリース（コミットの SHA をタグにしたイメージ）でコンテナを入れ替え、設定キャッシュを作って動作を確認する
# デプロイ（remote-deploy.sh）とロールバック（GitHub Actions の Rollback ワークフロー）で共通に使う
# 使い方: switch-release.sh <コミットの SHA | previous>
#   previous を指定すると、1つ前に動いていたリリース（.previous-release）に切り替える
#   （続けて previous を指定すると、元のリリースに戻る）
set -euo pipefail
export HOME="${HOME:-/root}"

BASE=/home/ec2-user/tektektech
CURRENT_FILE="$BASE/.current-release"
PREVIOUS_FILE="$BASE/.previous-release"

RELEASE_SHA="$1"
if [[ "$RELEASE_SHA" == previous ]]; then
    RELEASE_SHA="$(cat "$PREVIOUS_FILE" 2>/dev/null || true)"
    if [[ -z "$RELEASE_SHA" ]]; then
        echo "No previous release recorded ($PREVIOUS_FILE)" >&2
        exit 1
    fi
fi

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid commit SHA: $RELEASE_SHA" >&2
    exit 1
fi
export IMAGE_TAG="$RELEASE_SHA"
# compose ファイルは絶対パスで指定し、ローカル開発用の docker-compose.override.yml は読み込まない
export COMPOSE_FILE="$BASE/docker-compose.yml"
export COMPOSE_PROJECT_NAME=tektektech
cd "$BASE"

for repo in tektektech-app tektektech-nginx; do
    if ! docker image inspect "$repo:$RELEASE_SHA" >/dev/null 2>&1; then
        echo "Image not found: $repo:$RELEASE_SHA" >&2
        echo "Available releases:" >&2
        docker image ls tektektech-app --format '  {{.Tag}}  ({{.CreatedSince}})' >&2
        exit 1
    fi
done

echo "Switching to release $RELEASE_SHA"
docker compose up -d --no-build --remove-orphans
# artisan は www-data で実行し、生成されるキャッシュの所有者を php-fpm と揃える
docker compose exec -T -u www-data app php laravel/artisan config:cache
# 実際に動いている PHP のバージョンをログに残す
docker compose exec -T app php -r 'echo "PHP ", PHP_VERSION, PHP_EOL;'

# 動作確認：トップページが 200 を返さなければ失敗として扱う
for i in 1 2 3 4 5; do
    if curl -fsS -o /dev/null http://localhost/; then
        echo "Smoke test passed"
        # 切り替える前に動いていたリリースを「1つ前」として記録する
        CURRENT_SHA="$(cat "$CURRENT_FILE" 2>/dev/null || true)"
        if [[ -n "$CURRENT_SHA" && "$CURRENT_SHA" != "$RELEASE_SHA" ]]; then
            echo "$CURRENT_SHA" > "$PREVIOUS_FILE"
        fi
        echo "$RELEASE_SHA" > "$CURRENT_FILE"
        exit 0
    fi
    sleep 3
done
echo "Smoke test failed: http://localhost/ did not return 2xx" >&2
exit 1
