# ガチャ天井計算機

`/tools/gacha` で、確率・すり抜け・天井・石の数・値段を入れると、ボタンを押さずに、狙いが手に入るまでの回数・石・金額の表（平均・50%・90%・99%・最大）、平均の一文、予算で手に入る確率の文、回数ごとの確率のグラフが出る。不正な値は欄ごとに理由が出て、重すぎる入力は「回数が多すぎて計算できません。」になる。入力はどこにも保存しない。

## Sub-features

- `gacha-initial`：開いた直後から、最初の値（最高レア 0.6・天井 200 など）の結果が出ている。
- `gacha-table`：入力を変えると、表の値が変わる。
- `gacha-summary`：表の上の `role="status"` の一文「平均 〜 回（〜 円）で手に入ります。」。
- `gacha-budget`：予算を入れると「〜 円で 〜 回引けます。狙いが手に入る確率は 〜% です。」。
- `gacha-chart`：表の下の `svg[role=img]`。名前に右端の回数と確率が入る。
- `gacha-invalid`：不正な値は、その欄が `aria-invalid="true"` になり、理由の文と「赤い欄を直すと、結果が出ます」が出て、表が消える。
- `gacha-toggle`：「すり抜けが続いたら確定」を「なし」にすると「いま続いているすり抜け」が、天井を空にすると天井まわりの 3 欄が隠れる。
- `gacha-too-many`：重い入力（最高レア 0.01・すり抜け 99・確定なし・天井なし）で、固まらずに文が出る。
- `gacha-no-storage`：入力を変えても URL と `localStorage` が変わらない。

## How to get to it (user POV)

- `/tools` の「ガチャ天井計算機」のカード（QR コード作成の次）。
- URL `/tools/gacha`。

## Driving it with Playwright

Preconditions:

- `stack.sh doctor` が `doctor: OK`。
- 一通りのジャーニー：`bash .claude/skills/verify/scripts/drive.sh .claude/skills/verify/journeys/gacha.spec.ts`。

- **最初の値。** `await page.goto("/tools/gacha")`。`page.getByRole("status").filter({ hasText: /^平均 / })` が「平均 95.1 回（9,510 円）で手に入ります。」。
- **例 A を入れる。** `getByLabel(…, { exact: true })` で、`最高レアの確率`=1、`すり抜けの確率`=空、`すり抜けが続いたら確定`=`selectOption({ label: "なし" })`、`天井（最高レアが必ず出る回数）`=空、`1 回に使う石の数`=160、`石 1 個の値段`=1。`page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" }).getByRole("row", { name: /^平均/ })` に「100.0 回」「16,000 円」。
- **予算。** `予算`=16000。「16,000 円で 100 回引けます。狙いが手に入る確率は 63.3% です。」が見える。`page.getByRole("img", { name: "回数ごとの、狙いが手に入る確率のグラフ（459 回で 99.0%）" })` が見える。
- **不正な値。** `最高レアの確率`=abc。その欄が `aria-invalid="true"`、「0.01〜100 の数（小数第 3 位まで）を入れてください」と「赤い欄を直すと、結果が出ます」が見え、表は隠れる。
- **重い入力。** `最高レアの確率`=0.01、`すり抜けの確率`=99（確定なし・天井なしのまま）。「回数が多すぎて計算できません。」が 10 秒以内に見える。
- **保存しない。** 最初に `localStorage.clear()`、何度か入力したあと `page.evaluate(() => localStorage.length)` が 0、`page.url()` が `/tools/gacha` のまま。
- **証拠。** 各段階で `page.screenshot(…)` と `page.locator("main").ariaSnapshot()`（このページは `<main>` がある）。PC 幅とスマホ幅の両方。

## Gotchas

- 計算は Web Worker で、入力のあと 150ms 待ってから走る。決まった時間を待たずに、変わったあとの値を `expect` で待つ。
- ラベルは `exact: true` で取る（「予算」と予算の文、「天井」と天井まわりのラベルが部分一致で重なる）。
- 予算の文の要素の id は `gacha-budget-text`、予算の欄の id は `gacha-budget`。
- 表が隠れているあいだは、行の値を読む `expect` がタイムアウトする。先に不正な欄がないことを確かめる。
- スマホ幅で桁がとても多いと、単位（回・個・円）だけが次の行に回る。これは仕様どおり（数字は途中で切れない）。
