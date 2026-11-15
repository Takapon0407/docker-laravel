# 仕様駆動 ＋ 実装ループのハーネス

```
[要件定義ループ] /spec-interview → 👤 承認 → /spec-to-features → 👤 承認
      ↓ harness/spec.md ＋ harness/features.json
[実装ループ] 👤 bash harness/loop.sh start → (/clear → /implement-loop) を繰り返す → 👤 bash harness/loop.sh stop → 👤 最終レビュー
```

人が入るのはフェーズの切れ目だけ。小さな機能ごとに何周も回す。

## ファイル

| ファイル | 役割 |
|---|---|
| `spec.md` | 仕様書（プロジェクト全体で 1 つ。機能ごとに節を足す） |
| `features.json` | 実装ループの入力。1 項目 = 1 セッション。ループ中に変えてよいのは `passes` だけ |
| `progress.txt` | 実装ループの作業記録（次のセッションへの引き継ぎ） |
| `init.sh` | ローカルのサイトを起動し、開けることを確かめる |
| `check.sh` | 検証コマンド。exit 0 なら完了（PHPUnit・PHPStan・Pint・TS のテスト・ビルド・Playwright の E2E）。`--quick` は E2E を飛ばす |
| `loop.sh` | 実装ループの `start` / `stop` / `status` / `escalate "理由"` |
| `features.mjs` | features.json の形と、ループ中の書き換えの検査 |
| `hooks/guard-edits.mjs` | PreToolUse hook。ループ中、features.json（passes 以外）・既存のテスト・検証のしくみの書き換えを止める |
| `hooks/stop-check.sh` | Stop hook。ループ中、止まる前に check.sh を流し、失敗なら止まらせない（3 回まで） |

スキルは `.claude/skills/{spec-interview,spec-to-features,implement-loop}`、別のコンテキストで見るエージェントは `.claude/agents/{spec-reviewer,feature-verifier}.md`。hooks の登録は `.claude/settings.json`。

## 決まり

- 完了の判定は自己申告ではなく `bash harness/check.sh` の exit code。
- 回帰テストは毎回サイト全体（`laravel/e2e/regression.spec.ts`：全ページを PC 幅とスマホ幅で開き、エラー・横のはみ出しがないこと）。ページを増やしたら `laravel/e2e/pages.ts` に足す。
- 実装中に仕様の穴を見つけたら、AI は決めずに `bash harness/loop.sh escalate "理由"` で止まる（要件定義に差し戻す）。
- 上限：1 回の `/implement-loop` で 1 項目。同じ項目で 3 回やり直したら止まる。Stop hook が止めるのは続けて 3 回まで。
- hooks はループ中（`harness/.loop/active` があるとき）だけ働く。ふだんの作業には影響しない。柵には抜け道があり得るので、最後は人が diff を見る（`loop.sh stop` が features.json の変化と開始からのコミットを出す）。
