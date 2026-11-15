#!/usr/bin/env bash
# Stop hook：実装ループ中だけ、止まる前に harness/check.sh を流す。失敗なら exit 2 で止まらせない
# - 止めた回数が MAX_STOP_BLOCKS を超えたら、あきらめて止まり、ユーザーに知らせる（トークンを使いすぎないための上限）
# - bash harness/loop.sh escalate "理由" が実行されていたら、検証せずに止まる（仕様の穴などでユーザーに確認するとき）
set -uo pipefail

HARNESS="$(cd "$(dirname "$0")/.." && pwd)"
LOOP="$HARNESS/.loop"
MAX_STOP_BLOCKS=3

cat >/dev/null # hook の入力は使わない
[ -f "$LOOP/active" ] || exit 0

notify() {
    node -e 'process.stdout.write(JSON.stringify({ systemMessage: process.argv[1] }))' "$1"
}

if [ -f "$LOOP/escalate" ]; then
    reason="$(cat "$LOOP/escalate")"
    rm -f "$LOOP/escalate"
    notify "実装ループ：ユーザーの確認が必要です（${reason}）"
    exit 0
fi

if output="$(bash "$HARNESS/check.sh" 2>&1)"; then
    echo 0 >"$LOOP/stop-blocks"
    exit 0
fi

blocks=$(( $(cat "$LOOP/stop-blocks" 2>/dev/null || echo 0) + 1 ))
echo "$blocks" >"$LOOP/stop-blocks"
if [ "$blocks" -gt "$MAX_STOP_BLOCKS" ]; then
    echo 0 >"$LOOP/stop-blocks"
    notify "実装ループ：検証が ${MAX_STOP_BLOCKS} 回続けて失敗したので止まりました。bash harness/check.sh の結果を確認してください"
    exit 0
fi
{
    echo "harness/check.sh が失敗しました（${blocks}/${MAX_STOP_BLOCKS} 回目）。直してから終えてください。仕様の穴が原因なら、勝手に決めずに bash harness/loop.sh escalate \"理由\" を実行してから終えてください。"
    echo "$output" | tail -n 60
} >&2
exit 2
