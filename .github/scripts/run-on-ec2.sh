#!/bin/bash
# SSM Run Command で EC2 上のシェルコマンドを実行し、終わるまで待って結果を表示する（デプロイ・ロールバックで共通）
# 使い方: run-on-ec2.sh <コマンドの説明> <AWS-RunShellScript のパラメーター JSON のパス>
# 必要な環境変数: INSTANCE_ID（AWS の認証情報とリージョンは configure-aws-credentials で設定済みのこと）
set -euo pipefail

COMMENT="$1"
PARAMS_FILE="$2"

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "$COMMENT" \
  --parameters "file://$PARAMS_FILE" \
  --query Command.CommandId --output text)
echo "SSM command: $COMMAND_ID"

# 終了状態になるまで待つ（aws ssm wait は約100秒で打ち切られ、遅いビルドでジョブだけ失敗するため自前で待つ）
STATUS=Pending
for _ in $(seq 1 100); do
  sleep 10
  STATUS=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
    --query Status --output text 2>/dev/null || echo Pending)
  case "$STATUS" in
    Pending|InProgress|Delayed) ;;
    *) break ;;
  esac
done

RESULT=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID")
echo "::group::stdout"; echo "$RESULT" | jq -r .StandardOutputContent; echo "::endgroup::"
echo "::group::stderr"; echo "$RESULT" | jq -r .StandardErrorContent; echo "::endgroup::"
echo "Status: $STATUS"
test "$STATUS" = "Success"
