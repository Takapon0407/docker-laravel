#!/bin/bash
# EC2 上で実行するデプロイスクリプト（GitHub Actions から SSM Run Command 経由で root 権限で実行される）
# 使い方: remote-deploy.sh <展開済みリリースのディレクトリ> <コミットの SHA>
#
# コードを含むイメージ（tektektech-app / tektektech-nginx）を SHA のタグで作り、コンテナごと入れ替える。
# 実行中のコンテナが読むファイルは上書きしないため、デプロイ中に新旧のコードが混ざらない。
# 動作確認に失敗したときは直前のリリースに自動で戻す。手動で戻すときは GitHub Actions の Rollback ワークフロー
# （直近のイメージを KEEP_IMAGES 世代残している）
set -euo pipefail
# SSM Run Command では HOME が未設定の場合があるため補う（aws / docker CLI が参照する）
export HOME="${HOME:-/root}"

RELEASE_DIR="$1"
RELEASE_SHA="$2"
BASE=/home/ec2-user/tektektech
AWS_REGION=ap-northeast-1
# 本番の .env の中身（SecureString。EC2 の IAM ロールで読み取る）
ENV_PARAM=/tektektech/prod/env
KEEP_IMAGES=3

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid commit SHA: $RELEASE_SHA" >&2
    exit 1
fi
export IMAGE_TAG="$RELEASE_SHA"
# イメージ・コンテナの名前空間（compose のプロジェクト名）を、ビルド時と起動時で揃える
export COMPOSE_PROJECT_NAME=tektektech

# 1. イメージを作る（実行中のコンテナには影響しない）
# compose ファイルは絶対パスで指定する（SSM はコマンドを /usr/bin などで実行するため、相対パスだと見つからない）
# ローカル開発用の docker-compose.override.yml は読み込まない
# ベースイメージ（php / nginx）は毎回最新のパッチ版を取得する
docker compose -f "$RELEASE_DIR/docker-compose.yml" build --pull

# 2. 実行時に使うファイル（compose の設定・デプロイ用スクリプト）を配置する
mkdir -p "$BASE/laravel/storage"
cp "$RELEASE_DIR/docker-compose.yml" "$BASE/docker-compose.yml"
rm -f "$BASE/docker-compose.override.yml"
rm -rf "$BASE/deploy"
cp -a "$RELEASE_DIR/deploy" "$BASE/deploy"

cd "$BASE/laravel"
# storage は php-fpm（www-data, uid/gid 33）だけが書き込めるようにする（777 にしない）
chown -R 33:33 storage
chmod -R u=rwX,g=rX,o= storage

# 3. .env を Parameter Store（SecureString）から取得する。EC2 の IAM ロールで読み取り、値はログやコマンド引数に出さない
# 一時ファイル（umask 077 で本人以外読めない）に書き出し、所有者と権限を整えてから置き換える
# （取得に失敗しても既存の .env を壊さない／作成直後に他ユーザーから読める瞬間を作らない）
ENV_TMP="$(umask 077 && mktemp .env.XXXXXX)"
trap 'rm -f "$ENV_TMP"' EXIT
aws ssm get-parameter --region "$AWS_REGION" --name "$ENV_PARAM" \
    --with-decryption --query Parameter.Value --output text > "$ENV_TMP"
if [[ ! -s "$ENV_TMP" ]]; then
    echo "Failed to get .env from Parameter Store ($ENV_PARAM)" >&2
    exit 1
fi
# .env は ec2-user と www-data グループだけが読めるようにする（コンテナには読み取り専用でマウントする）
chown ec2-user:33 "$ENV_TMP"
chmod 640 "$ENV_TMP"
mv -f "$ENV_TMP" .env

# 4. 新しいイメージでコンテナを入れ替え、設定キャッシュを作り、動作を確認する
# 失敗したら、直前に動いていたリリースに戻してからデプロイ失敗として終わる
cd "$BASE"
PREVIOUS_SHA="$(cat "$BASE/.current-release" 2>/dev/null || true)"
if ! bash "$BASE/deploy/switch-release.sh" "$RELEASE_SHA"; then
    if [[ -n "$PREVIOUS_SHA" && "$PREVIOUS_SHA" != "$RELEASE_SHA" ]]; then
        echo "Deploy failed. Rolling back to $PREVIOUS_SHA" >&2
        bash "$BASE/deploy/switch-release.sh" "$PREVIOUS_SHA" || echo "Rollback also failed" >&2
    fi
    exit 1
fi

# 5. 以前の方式（EC2 上のコードを上書きし、コンテナにマウントしていた）で使っていたファイルとイメージを消す
# 今はコードをイメージに含めているため使っていない（EC2 に残すのは compose の設定・デプロイ用スクリプト・storage・.env だけ）
LEGACY_PATHS=(
    Dockerfile .dockerignore .gitignore .github README.md docker infra
    laravel/app laravel/bootstrap laravel/config laravel/database laravel/lang laravel/public
    laravel/resources laravel/routes laravel/tests laravel/vendor laravel/node_modules
    laravel/artisan laravel/composer.json laravel/composer.lock laravel/package.json laravel/package-lock.json
    laravel/vite.config.ts laravel/phpunit.xml laravel/phpstan.neon laravel/Makefile laravel/README.md
    laravel/.env.example laravel/.env.production.enc laravel/.editorconfig laravel/.gitattributes laravel/.gitignore
)
for path in "${LEGACY_PATHS[@]}"; do
    if [[ -e "$BASE/$path" ]]; then
        rm -rf "${BASE:?}/$path"
        echo "Removed legacy $path"
    fi
done
# 以前の方式でビルドしていたイメージ（タグ latest）
docker image rm tektektech-app:latest 2>/dev/null && echo "Removed legacy image tektektech-app:latest" || true

# 6. 古いイメージを消す（新しい順に KEEP_IMAGES 世代はロールバック用に残す）
# 実行中のコンテナが使っているイメージ（ロールバック後など）は消せないため、失敗しても続ける
for repo in tektektech-app tektektech-nginx; do
    docker image ls "$repo" --format '{{.Tag}}' | tail -n +"$((KEEP_IMAGES + 1))" | while read -r tag; do
        docker image rm "$repo:$tag" || echo "Skip removing $repo:$tag (in use)"
    done
done
docker image prune -f
echo "Images kept for rollback:"
docker image ls tektektech-app --format '  {{.Tag}}  ({{.CreatedSince}})'
