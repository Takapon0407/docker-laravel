#!/bin/bash
# EC2 上で実行するデプロイスクリプト（GitHub Actions から SSM Run Command 経由で root 権限で実行される）
# 使い方: remote-deploy.sh <展開済みリリースのディレクトリ>
set -euo pipefail
# SSM Run Command では HOME が未設定の場合があるため補う（aws / docker CLI が参照する）
export HOME="${HOME:-/root}"

RELEASE_DIR="$1"
BASE=/home/ec2-user/tektektech
AWS_REGION=ap-northeast-1
ENC_KEY_PARAM=/tektektech/prod/env-enc-key

mkdir -p "$BASE/laravel"
cd "$BASE/laravel"

# リポジトリ/ビルドから毎回再生成されるディレクトリは消してから配置する
# （上書きだけだと、リポジトリから削除したファイルがEC2に残り続けるため。storage と .env は残す）
rm -rf app bootstrap config database lang resources routes vendor public/build

cp -a "$RELEASE_DIR/." "$BASE/"
# storage は除外して所有者を ec2-user に戻す
# （storage 内は php-fpm(www-data) が作ったファイルで、Blade のコンパイル済みビューは
#   所有者でないと touch() で更新日時を設定できず 500 になるため、所有者を変えない）
find "$BASE" -path "$BASE/laravel/storage" -prune -o -exec chown -h ec2-user:ec2-user {} +
# storage と bootstrap/cache は php-fpm（www-data, uid/gid 33）だけが書き込めるようにする（777 にしない）
chown -R 33:33 storage bootstrap/cache
chmod -R u=rwX,g=rX,o= storage bootstrap/cache

# .env の復号。パスフレーズは EC2 の IAM ロールで Parameter Store から取得し、環境変数で openssl に渡す
# （コマンド引数・SSM のコマンド履歴・ログには値を出さない）
ENCRYPTION_SECRET="$(aws ssm get-parameter --region "$AWS_REGION" --name "$ENC_KEY_PARAM" \
    --with-decryption --query Parameter.Value --output text)"
export ENCRYPTION_SECRET
openssl aes-256-cbc -d -pbkdf2 -iter 10000 -in .env.production.enc -out .env -pass env:ENCRYPTION_SECRET
unset ENCRYPTION_SECRET
# .env は ec2-user と www-data グループだけが読めるようにする
chown ec2-user:33 .env
chmod 640 .env

cd "$BASE"
# ベースイメージ（php / nginx）は毎回最新のパッチ版を取得してからビルド・起動する
docker compose build --pull
docker compose pull --ignore-buildable
docker compose up -d --remove-orphans
# artisan は www-data で実行し、生成されるキャッシュ・ログの所有者を php-fpm と揃える
docker compose exec -T -u www-data app php laravel/artisan config:cache
# 前のリリースのコンパイル済みビューを消す
docker compose exec -T -u www-data app php laravel/artisan view:clear
docker image prune -f

# 動作確認：トップページが 200 を返さなければデプロイ失敗として扱う（GitHub Actions のジョブも失敗になる）
for i in 1 2 3 4 5; do
    if curl -fsS -o /dev/null http://localhost/; then
        echo "Smoke test passed"
        exit 0
    fi
    sleep 3
done
echo "Smoke test failed: http://localhost/ did not return 2xx" >&2
exit 1
