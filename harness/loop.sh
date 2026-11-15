#!/usr/bin/env bash
# 実装ループの開始・終了（開始・終了は人が決める。Human-in-the-loop の切れ目）
#   bash harness/loop.sh start   … features.json をいまの形で固定し、hooks の見張りと Stop hook の検証を有効にする
#   bash harness/loop.sh stop    … 終了。固定したときから features.json がどう変わったかを出す
#   bash harness/loop.sh status
#   bash harness/loop.sh escalate "理由"  … 仕様の穴などでユーザーに確認したいとき。次の Stop hook は検証せずに止まる
set -euo pipefail

HARNESS="$(cd "$(dirname "$0")" && pwd)"
LOOP="$HARNESS/.loop"

case "${1:-status}" in
start)
    if [ -f "$LOOP/active" ]; then
        echo "すでに実装ループ中です（harness/.loop/active）"
        exit 1
    fi
    node "$HARNESS/features.mjs" check
    mkdir -p "$LOOP"
    cp "$HARNESS/features.json" "$LOOP/baseline.json"
    git -C "$HARNESS" rev-parse HEAD >"$LOOP/base-commit"
    echo 0 >"$LOOP/stop-blocks"
    date '+%Y-%m-%d %H:%M:%S' >"$LOOP/active"
    echo "実装ループを開始しました。features.json は passes だけ変えられます"
    ;;
stop)
    if [ ! -d "$LOOP" ]; then
        echo "実装ループ中ではありません"
        exit 0
    fi
    echo "--- features.json の変化（開始時から） ---"
    diff "$LOOP/baseline.json" "$HARNESS/features.json" || true
    echo "--- 開始してからのコミット ---"
    git -C "$HARNESS" log --oneline "$(cat "$LOOP/base-commit")..HEAD"
    rm -rf "$LOOP"
    echo "実装ループを終了しました"
    ;;
escalate)
    [ -d "$LOOP" ] || { echo "実装ループ中ではありません"; exit 1; }
    echo "${2:-理由の記載なし}" >"$LOOP/escalate"
    echo "ユーザーに確認するため、止まってください：${2:-}"
    ;;
status)
    if [ -f "$LOOP/active" ]; then
        echo "実装ループ中（$(cat "$LOOP/active") に開始。Stop hook で止めた回数：$(cat "$LOOP/stop-blocks")）"
    else
        echo "実装ループ中ではありません"
    fi
    node "$HARNESS/features.mjs" summary
    ;;
*)
    echo "使い方：bash harness/loop.sh start|stop|status|escalate" >&2
    exit 2
    ;;
esac
