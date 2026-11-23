# 便利ツールの一覧

`/tools` に便利ツールのカードが `config/tools.php` の順に並ぶ。「用途」と「データの扱い」のラジオボタンで絞り込むと、合わないカードが隠れる。どのカードもそのツールのページへリンクしている。

## Sub-features

- `tools-cards`：カードごとに、見出し（ツール名）・分類のタグ（一般向け／開発向け、端末内で完結／サーバーに保存）・説明・データの扱いの注意がある。
- `tools-filter-purpose`：「用途」で「一般向け」「開発向け」に絞り込める。
- `tools-filter-storage`：「データの扱い」で「端末内で完結」「サーバーに保存」に絞り込める。
- `tools-empty`：条件に合うカードがないと「条件に合うツールはありません。」が見える。
- `tools-link`：カードを押すと、そのツールのページが開く。

## How to get to it (user POV)

- ヘッダーの「Tools」。
- URL `/tools`。

## Driving it with Playwright

Preconditions:

- `stack.sh doctor` が `doctor: OK`。

- **一覧を開く。** `await page.goto("/tools")`。`page.getByRole("heading", { level: 1, name: "便利ツール" })` が見える。
- **カードの並び。** `page.locator(".tools-card-title").allTextContents()` が `config/tools.php` の `title` の順。
- **用途で絞る。** `page.getByText("開発向け", { exact: true }).first().click()`（ラジオボタンは隠れていて、ラベルを押す）。`page.getByRole("heading", { name: "ガチャ天井計算機" })` が隠れ、`page.getByRole("heading", { name: "JSON 整形" })` などの開発向けのカードが見える。
- **データの扱いで絞る。** 「データの扱い」の `サーバーに保存` のラベルを押す。見えるカードは匿名質問ボードだけ。
- **合うものがない。** 「開発向け」と「サーバーに保存」を両方選ぶ。`page.getByText("条件に合うツールはありません。")` が見える。
- **リンク。** 「すべて」に戻し、`page.getByRole("link", { name: /ガチャ天井計算機/ }).click()`。URL が `/tools/gacha` になり、h1 が「ガチャ天井計算機」。
- **証拠。** 絞り込みの前後で `page.screenshot(…)` と `page.locator(".tools-list").ariaSnapshot()` を `VERIFY_EVIDENCE` に書く。

## Gotchas

- 絞り込みは CSS だけ（`_tools.scss`）。ラジオボタン自体は `btn-check` で見えないので、`check()` ではなくラベルを押す。「すべて」「一般向け」などのラベルは 2 つの fieldset にある語と重なることがあるので、`page.locator("fieldset", { hasText: "用途" }).getByText("開発向け")` のように fieldset で絞る。
- `enabled_by` が設定で切られているツールはカードが出ない。
- カードの名前の正しい表記は `config/tools.php` の `title` を見る（推測で書かない）。
