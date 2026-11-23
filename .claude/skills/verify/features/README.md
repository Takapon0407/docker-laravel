# てくてくテックの確かめ方の地図

このフォルダは、ユーザーに見える動きを確かめるための手順のもと。操作する前にこの一覧を読み、該当する機能のファイルを手順として使う。

## Baseline preconditions

- `bash .claude/skills/verify/scripts/stack.sh up <checkout>` のあと、`stack.sh doctor <checkout>` が `doctor: OK`。
- サイトは `http://localhost`。ログイン・DB・シードはない。
- このラン以外が立ち上げたスタックを、断りなく入れ替えない（SKILL.md「同時に動かせるのは 1 つだけ」）。

## Driving conventions

- ジャーニーは Playwright の 1 ファイル（`*.spec.ts`）にして、`bash .claude/skills/verify/scripts/drive.sh <file> [desktop|mobile|all]` で流す。
- 要素はラベル・ロール・アクセシブルな名前で取る。CSS のクラスや DOM の位置には頼らない。
- 入力欄は `getByLabel(ラベル, { exact: true })`。ラベルは画面の文のとおりで、半角スペースもそのまま（例：`1 回に使う石の数`）。
- 計算は入力のたびに走る（ボタンはない）。決まった時間を待たずに、変わったあとの文・値を `expect` で待つ。

## Proof and skip reporting

- 操作と結果の両方を残す。画面はスクリーンショットと ARIA スナップショット。
- `pageerror` と `console.error` が 0 件であること（CSP の違反を含む）。
- 見た目の変更は、PC 幅とスマホ幅の両方。横にはみ出していないこと（`scrollWidth <= clientWidth`）。
- 証拠には、機能の ID と入口を書く。
- 入口を確かめられなかったときは、試したことと足りない前提を書く。ほかの入口で確かめたものを、その入口の結果として報告しない。

## Feature entry contract

各ファイルは H1 と、ユーザーに見える動きの 1 段落で始まり、次の 4 つの H2 をこの順に持つ。

1. `Sub-features`：短い ID と 1 行の説明。
2. `How to get to it (user POV)`：ユーザーの入口すべて。
3. `Driving it with Playwright`：`Preconditions:` で始め、ユーザーの操作・コード・見える結果を組にした箇条書き。
4. `Gotchas`：確かめるときの落とし穴。

実装の詳しい話は書かない。ユーザーの道筋・安定した取っ手・要る状態・コマンド・見える証拠だけを書く。

## Features

- [全ページの表示](./site-pages.md)：どのページも 200 で開け、エラーがなく、横にはみ出さず、フッターからプライバシーポリシーにたどれる。
- [便利ツールの一覧](./tools-index.md)：`/tools` のカード、用途とデータの扱いでの絞り込み、各ツールへのリンク。
- [ガチャ天井計算機](./gacha.md)：入力欄・入力の確かめ・回数と金額の表・予算の確率・グラフ・重い入力。ジャーニー：`journeys/gacha.spec.ts`。
