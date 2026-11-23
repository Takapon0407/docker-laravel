# 全ページの表示

どのページも 200 で開け、タイトルに「てくてくテック」が入り、エラーが出ず、横にはみ出さない。ゲーム以外のページは、フッターからプライバシーポリシーにたどれる。

## Sub-features

- `pages-open`：`laravel/e2e/pages.ts` の全ページが 200 で開ける。
- `pages-footer`：フッターに `/privacy` へのリンクがある（ゲームの 2 ページは除く）。
- `pages-no-overflow`：PC 幅とスマホ幅で横にはみ出さない。
- `pages-no-errors`：`pageerror`・`console.error`（CSP の違反を含む）が 0 件。
- `pages-404`：ないページは 404。

## How to get to it (user POV)

- ヘッダーのナビ（Works・Hobbies・Tools）と、`/tools` のカード。
- フッターの「プライバシーポリシー」。
- URL を直接開く。

## Driving it with Playwright

Preconditions:

- `stack.sh doctor` が `doctor: OK`。
- ページを足したなら、`laravel/e2e/pages.ts` にも足してある。

- **全ページを開く。** 既存の回帰テストを流す：`cd laravel && npx playwright test regression`。両方の画面幅で、すべての `… を開ける` と `ないページは 404` が passed。
- **変えたページの証拠。** ジャーニーで `page.goto(<path>)` し、`page.screenshot({ path: \`${process.env.VERIFY_EVIDENCE}/<名前>-${test.info().project.name}.png\`, fullPage: true })`。`drive.sh <journey> all` で PC 幅とスマホ幅の画像が残る。
- **はみ出し。** `await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)` が 0 以下。

## Gotchas

- `/tools/char-count`・`/tools/qr`・`/tools/diff` は `pages.ts` に入っていない。変えたときはジャーニーで直接開く。
- `/hobbies` の写真は S3 から読むので、ローカルでは出ないことがある。ページが 200 なら写真の有無は問わない。
- `/tools/board/room` は WebSocket（`infra/board`）がないと部屋につながらない。ローカルで確かめられるのは、ページが開くところまで。
