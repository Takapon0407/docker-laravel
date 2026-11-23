---
name: verify
description: てくてくテック（Laravel ＋ Blade ＋ TypeScript のポートフォリオサイト）を、ローカルの Docker（http://localhost）で起動し、Playwright でユーザーと同じように操作して、変更が動く証拠（スクリーンショット・ARIA スナップショット・ログ）を残す。ページ・便利ツール（/tools/*）・見た目を変えたあと、「動くことを確かめて」と言われたとき、PR の前の確認に使う。
---

# verify：てくてくテックを実際に動かして確かめる

対象は Web の画面（Blade ＋ TS）。サーバー側の入力はなく、ほぼすべてのツールはブラウザの中だけで動く。例外の匿名質問ボード（`/tools/board`）は `infra/board` の WebSocket が要り、ローカルでは部屋に入るところまでしか確かめられない。

機能ごとの手順は [`features/README.md`](features/README.md)。操作する前に、そこから該当する機能のファイルを読む。

## 同時に動かせるのは 1 つだけ

`docker-compose.yml` はコンテナ名（`app`・`nginx`）とポート 80 を固定している。**2 つ目のスタックは立ち上がらない**。スタックは、`docker compose up` を実行したチェックアウトの `laravel/` をマウントする。worktree のコードを確かめるには、ユーザーの checkout で動いているスタックを止めて、worktree のスタックを立ち上げることになる（`stack.sh up` が行い、`stack.sh restore` が元に戻す）。

- 2 つのエージェントが同時にスタックを動かさない。別のエージェントが `.verify/previous-owner` を作っていたら（=確かめている途中）、終わるまで待つ。
- ユーザーのスタックを入れ替えたら、終わったあと必ず `restore` する。

## Launch

```bash
bash .claude/skills/verify/scripts/stack.sh up [checkout]   # 省略時はこの checkout
```

行うこと：今のスタックの持ち主を `.verify/previous-owner` に記録する → worktree なら `laravel/.env` を写す（中身は読まない。CLAUDE.md の決まり）→ 別の checkout のスタックを `docker compose down` → `docker compose up -d` → `composer install`（コンテナ内）→ `node_modules` がなければ `npm ci` → `npm run build` → `/tmp/views` を www-data に戻す → `http://localhost/` が 200 になるまで待つ → doctor。

「準備ができた」の判定は、doctor が `doctor: OK` を出すこと。プロセスが返事をするだけでは足りない（ビルドが古いと、画面は前のコードのまま）。DB・シードはない（閲覧専用のサイト）。

## Doctor

```bash
bash .claude/skills/verify/scripts/stack.sh doctor [checkout]
```

読むだけで、何も変えない。確かめること：`app`・`nginx` が動いている、マウントされているのが確かめたい checkout である、ポート 80 が nginx のものである、`GET /` が 200、`public/build/manifest.json` が `resources/` の最後の変更より新しい。様子がおかしいときは、まずこれを流す。

## Drive

Playwright のジャーニー（1 つの `*.spec.ts`）を書き、`drive.sh` で流す。

```bash
bash .claude/skills/verify/scripts/drive.sh <journey.spec.ts> [desktop|mobile|all] [run-id]
bash .claude/skills/verify/scripts/drive.sh .claude/skills/verify/journeys/gacha.spec.ts   # 例
```

- 画面幅は `desktop`（1280×800）と `mobile`（375×740）。CLAUDE.md の決まりで、見た目に関わる変更は両方で確かめる（省略時は両方）。
- 要素は、ラベル・ロール・見出しで取る：`page.getByLabel("最高レアの確率", { exact: true })`、`page.getByRole("table", { name: "…" })`、`page.getByRole("status")`。CSS のクラスや位置には頼らない。
- 証拠は `process.env.VERIFY_EVIDENCE` に書く：`page.screenshot({ path: \`${process.env.VERIFY_EVIDENCE}/<名前>-${test.info().project.name}.png\`, fullPage: true })`、`page.locator("main").ariaSnapshot()`（多くのページは `<main>` がない。そのときは `body`）。
- `pageerror` と `console.error` を集めて最後に 0 件を確かめる。CSP の違反はコンソールのエラーとして出る。
- 既にある E2E（`laravel/e2e/*.spec.ts`）は `cd laravel && npm run e2e`（全ページの回帰は `npx playwright test regression`）。これはテストで、ジャーニーの証拠の代わりにはならない。

`journeys/` に、そのまま流せるジャーニーを置いている。新しい機能の確かめ方が固まったら、ここに足す。

## Evidence

置き場所は **`<最初の checkout>/.verify/evidence/<run-id>/`**（git に入れない）。中身は `journey.spec.ts`（流したもの）・`drive.log`・`exit-code`・`playwright/`（各テストの最後の画面、失敗時の trace）と、ジャーニーが書いたスクリーンショット・`*.aria.txt`。

証拠の基準：

- ユーザーと同じ道筋で操作する（URL を開く、ラベルの欄に入力する、ボタンを押す）。内部の関数を直接呼んだり、`page.evaluate` で値を入れたりしない。
- 操作と、その結果の両方を残す（入力の前後のスクリーンショット、変わった値の ARIA スナップショット）。
- 「保存しない」と言っているツールは、`localStorage.length` と URL が変わらないことも確かめる。保存するツール（寿命の計算・カウントダウン・雨音コードプレイヤー）は、再読み込みしても残ることを確かめる。
- PR やユーザーへの報告には、`run-id`・使った画面幅・`exit-code` を書く。

## Cleanup

```bash
bash .claude/skills/verify/scripts/stack.sh restore
```

`up` の前にスタックを持っていた checkout に戻し、写した `.env` を消す。**`.verify/evidence/` は消さない**。プロセス名で kill しない（`docker compose` で自分が上げたものだけを下ろす）。何も入れ替えていなければ、何もしない。

## Gotchas

- `docker compose exec` は root で動く。`php artisan test` などのあとに 500（ログに `tempnam()`）が出たら、`docker compose exec -T app sh -c 'rm -rf /tmp/views/* && chown www-data:www-data /tmp/views'`。
- CSS・TS を変えたら `npm run build` し直さないと、画面は前のまま（`up` を流し直すか、`cd laravel && npm run build`）。`npm run dev` 中は CSP が付かないので、CSP の確かめにならない。
- `getByText` は `<noscript>` の中を探さない。`page.locator("noscript p", { hasText: "…" })` を使う。
- 作品の音源（`laravel/public/media`）は git に入っていない。worktree では `/works/rain-and-realms` の再生は確かめられない。
- `/hobbies` の写真は S3 から読む。ローカルで AWS の認証情報がないと写真は出ない（ページは 200）。
