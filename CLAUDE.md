# CLAUDE.md

このリポジトリで作業するときの前提・手順・ハマりどころ。手順の詳細（env の暗号化、写真の追加など）は README.md を参照。

## 概要

- ポートフォリオサイト（https://tektektech-portfolio.com/）。Laravel 13 / PHP 8.5、フロントは Blade ＋ TypeScript ＋ Sass（Vite でビルド）
- **閲覧専用のサイト**：DB・ログイン・フォームはない。ページは `/`（プロフィール）・`/hobbies`・`/games/{tetris,puyo}` だけ
- `/hobbies` の写真は S3 から取得する。S3 への PUT 時に Lambda が幅・高さをメタデータとして付け、`HobbiesController` が `headObject` で読んで縦横を判定する

## 本番の構成

```
閲覧者 ─HTTPS→ CloudFront ─HTTP:80→ origin.tektektech-portfolio.com（Route 53 → EC2 の Elastic IP）
                                      EC2: nginx コンテナ → app コンテナ（php-fpm）
```

- **ALB はない**（以前使っていた名残りのターゲットグループ・SG が残っているだけ）。EC2 の SG は 80 番を CloudFront のプレフィックスリストからのみ許可
- 証明書は ACM（us-east-1、DNS 検証で自動更新）。EC2 へのログインは SSM Session Manager のみ（22 番は閉じている）
- AWS を CLI で見るときは SSO の閲覧専用プロファイル `tektektech-view`（許可セット `ViewOnlyAccess`）を使う。切れたらユーザーに `aws sso login --profile tektektech-view` を実行してもらう
  - `ReadOnlyAccess` は Parameter Store の値（.env の復号キー）まで読めるため使わない

## ローカル開発

すべてリポジトリのルートから実行する。

```bash
docker compose up -d --build        # docker-compose.override.yml も自動で読まれ、コードと設定がマウントされる
cd laravel && npm install && npm run build   # Vite（開発中は npm run dev）
```

テスト・静的解析は app コンテナで実行する（ホストの PHP は 8.4 のため）。

```bash
docker compose exec -T -w /var/www/laravel app php artisan test
docker compose exec -T -w /var/www/laravel app php vendor/bin/phpstan analyse --memory-limit=1G   # level 10
docker compose exec -T -w /var/www/laravel app php vendor/bin/pint --test
```

- 見た目に関わる変更は、変更前後で主要な要素の位置・大きさ・色を測って比べる（PC 幅とスマホ幅）。CSS / JS を変えたら `npm run build` し直す
- ブランチは `develop` から `feature/` `refactor/` `fix/` などを切り、PR は `develop` 向けに出す。`develop` → `main` のマージ（＝本番デプロイ）と Rollback の実行はユーザーが行う

## デプロイとロールバック

- `main` への push で `.github/workflows/deploy.yml` が動く：`test` と `lint`（PHPStan / Pint）が通ったら、ビルド（npm / composer `--no-dev`）→ tarball を S3 へ → SSM Run Command で `deploy/remote-deploy.sh` を実行
- `remote-deploy.sh`：コードを含むイメージ `tektektech-app` / `tektektech-nginx` を **コミットの SHA をタグにして**作り、`deploy/switch-release.sh` でコンテナごと入れ替える。トップページが 200 を返さなければ**直前のリリース（`.current-release`）に自動で戻す**。イメージは直近 3 世代を残す
- 手動で戻すときは Actions の `Rollback` に SHA（40 桁）を渡す。戻せる SHA はデプロイのログ末尾の `Images kept for rollback` に出る
- `.env` は `laravel/.env.production.enc` を EC2 上で復号する（パスフレーズは Parameter Store `/tektektech/prod/env-enc-key` と 1Password）。**`.env` や復号結果の中身は読まない・出力しない**
- EC2 上の `/home/ec2-user/tektektech/laravel/app` などは以前の方式（コードを上書き＋マウント）の残骸で、今は使われていない

## 設計上の前提（変えるときは関連箇所もあわせて直す）

- **GET / HEAD 以外は nginx で 405**。セッション・Cookie・CSRF のミドルウェアは `bootstrap/app.php` で外している。フォームやログインを追加するときは戻すこと
- nginx は `index.php` 以外の `.php` を 404、ドットファイルを 403 にする。セキュリティヘッダーは `docker/nginx/security-headers.conf` にまとめ、**location 内で `add_header` を書くときはこのファイルも include する**（書かないと server レベルのヘッダーが消える）。`/build/assets/` の `Cache-Control` は 404 に付かないよう `always` なし
- 本番の opcache は `validate_timestamps=0`（コードはイメージの中で変わらない）。Blade のコンパイル済みビューはコンテナ内の `/tmp/views`
- `config/cache.php` は `serializable_classes => false`（**キャッシュにオブジェクトを入れられない**）。enum などは値（文字列）にして保存する
- `config/` は変更したものだけを置き、ほかは Laravel の既定値を使う。`/hobbies` のゲーム一覧は `config/hobbies.php` のデータ
- Sass は `components/`・`base/`・`pages/` に分け、サイトの緑は `_variables.scss` の `$main-color`。Bootstrap 5 のクラスを使う（Bootstrap 4 のクラスは効かない）
- `/` と `/profile` は同じ内容のため `/profile` は `/` へ 301。ページのタイトル・説明は `@section('title')` / `@section('description')`

## ハマりどころ

- **`core.fileMode=false`**：`chmod +x` してもコミットに実行権限が乗らない。スクリプトはワークフロー・EC2 とも `bash script.sh` で呼ぶ（必要なら `git update-index --chmod=+x`）
- **SSM Run Command は `/usr/bin` をカレントにして実行される**：デプロイスクリプト内で相対パスを使わない（compose ファイルは絶対パスで指定）
- デプロイスクリプトを変えたら、CI と同じ手順で作ったリリースを使い、`/` をカレントにして `remote-deploy.sh` 自体を手元で実行して確かめる（`aws` / `openssl` / `chown` だけ偽物にし、`BASE` をテスト用のフォルダに置き換える）
- Docker Desktop（Mac）で 1 ファイルだけをバインドマウントしていると、書き換え後もコンテナから古い長さのまま見えることがある（`nginx -t` が途中で終わる等）。`docker compose up -d --force-recreate nginx` で直る。本番（Linux）では起きない
- 手元の Docker は Content Trust が有効で、`docker run` は手元で作ったイメージでも失敗する。`docker compose` 経由なら動く
- 編集が反映されないときは、コンパイル済みビュー（`php artisan view:clear`）と opcache（app コンテナの再起動）を疑う
