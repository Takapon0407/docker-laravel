---
name: implement-loop
description: 実装ループの 1 回ぶん。harness/features.json の未達成の must 項目を 1 つだけ実装し、検証が通ったら passes を true にしてコミットする。bash harness/loop.sh start のあと、/implement-loop で使う（毎回 /clear してから呼ぶ）。
disable-model-invocation: true
---

# 実装ループ（1 回 = 1 項目）

## 0. 前提の確認

- `bash harness/loop.sh status` が「実装ループ中」でなければ、何もせずに止まり、ユーザーに `bash harness/loop.sh start` を頼む。
- 今のブランチが `develop`・`main` なら止まる（`feature/` などのブランチで行う）。

## 1. 現状を把握する

- `git log --oneline -10`・`harness/progress.txt` の末尾・`bash harness/loop.sh status` を読む。
- 選ぶ項目の節を `harness/spec.md` で読む（features.json の steps だけで判断しない）。

## 2. 起動と回帰の確認

- `bash harness/init.sh`、続けて `bash harness/check.sh`。**最初から失敗しているなら、新しい項目に手を付けず、まずそれを直す**（直すのも 1 回ぶんの作業として記録する）。

## 3. 1 項目だけ実装する

- 未達成の `must` を features.json の上から 1 つ選ぶ（must が全部 true なら nice）。2 つ以上はやらない。
- CLAUDE.md の規約に従う（DOM に依存しないロジックは `resources/ts/lib/` に置いてテストする、CSP、privacy、CLAUDE.md の更新など）。
- その項目の steps を、**新しいテストのファイル**として書く：ブラウザ操作は `laravel/e2e/<機能>.spec.ts`（Playwright）、HTML の中身は `laravel/tests/Feature/` の新しいファイル。既存のテストと features.json の passes 以外は hooks が止める。
- **仕様の穴を見つけたら自分で決めない**：`bash harness/loop.sh escalate "何が決まっていないか"` を実行し、progress.txt に書いてから終える（要件定義に差し戻す）。

## 4. 検証する（自己申告で終えない）

- `bash harness/check.sh` が exit 0 になること。
- `feature-verifier` エージェントに項目の id を渡し、steps どおりに動くかを別の目で採点させる。NG ならその指摘を直して 4 をやり直す。
- **同じ項目で 3 回やり直しても通らなければ**、escalate して止まる。

## 5. 記録して終える

1. features.json のその項目だけ `"passes": true` にする。
2. `harness/progress.txt` の末尾に追記：日時・id・やったこと・検証の結果・詰まったこと・次の候補。
3. コミットする（メッセージは日本語で「何ができるようになったか」。末尾に Co-Authored-By の行）。push と PR はしない（ユーザーがまとめて行う）。
4. 終える。終えるときに Stop hook がもう一度 check.sh を流す。

must が全部 true になったら、ユーザーに `bash harness/loop.sh stop` と最終レビュー（spec.md の「最終レビューで見ること」）を頼む。
