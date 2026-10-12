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
chown -R ec2-user:ec2-user "$BASE"
chmod -R 777 storage

# .env の復号。パスフレーズは EC2 の IAM ロールで Parameter Store から取得し、環境変数で openssl に渡す
# （コマンド引数・SSM のコマンド履歴・ログには値を出さない）
ENCRYPTION_SECRET="$(aws ssm get-parameter --region "$AWS_REGION" --name "$ENC_KEY_PARAM" \
    --with-decryption --query Parameter.Value --output text)"
export ENCRYPTION_SECRET
openssl aes-256-cbc -d -pbkdf2 -iter 10000 -in .env.production.enc -out .env -pass env:ENCRYPTION_SECRET
unset ENCRYPTION_SECRET
chown ec2-user:ec2-user .env

cd "$BASE"
# ベースイメージ（php / nginx）は毎回最新のパッチ版を取得してからビルド・起動する
docker compose build --pull
docker compose pull --ignore-buildable
docker compose up -d --remove-orphans
docker compose exec -T app php laravel/artisan config:cache
docker image prune -f
