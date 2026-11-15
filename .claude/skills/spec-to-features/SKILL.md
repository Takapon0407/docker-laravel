---
name: spec-to-features
description: 承認済みの harness/spec.md の節を、実装ループの入力 harness/features.json に変換する。要件定義が承認されたあと、/spec-to-features で使う。
disable-model-invocation: true
---

# 仕様書 → features.json

## 前提

- 変換するのは spec.md で「承認済み」の節だけ。未承認なら変換せず、`/spec-interview` に戻るよう伝える。
- 実装ループ中（`harness/.loop/active` がある）は変換しない（hooks が止める）。`bash harness/loop.sh stop` のあとに行う。

## 形

```json
{ "features": [
  { "id": "tools-search-01",
    "description": "ユーザーができること（1 文）",
    "steps": ["/tools を開く", "検索欄に「QR」と入れる", "QR コード作成のカードだけが表示される"],
    "priority": "must",
    "passes": false }
] }
```

- `id`：`<機能のスラッグ>-<2 桁>`。既存の項目の id・順番・中身は変えない（足すだけ）。
- **1 項目 = 1 セッションで終わる大きさ**。受け入れ条件 1〜3 個ぶんが目安。
- `steps` は、Playwright か PHPUnit でそのまま書ける具体的な操作と期待結果。URL・入力する文字・見える文言まで書く。
- `priority`：spec.md の「必須」は `must`、「できれば」は `nice`。主観的なこと（見た目の好み）は項目にしない（spec.md の「最終レビューで見ること」に残す）。
- `passes` はすべて `false`。

## 終わったら

1. `node harness/features.mjs check` が通ることを確かめる。
2. 項目の一覧（id・description・priority）をユーザーに見せ、承認をもらう。
3. 承認されたら、`bash harness/loop.sh start` で実装ループを始められることを伝える（始めるかはユーザーが決める）。
