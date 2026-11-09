# CLAUDE.md

このリポジトリで作業するときの前提・手順・ハマりどころ。手順の詳細（env の暗号化、写真の追加など）は README.md を参照。

## 概要

- ポートフォリオサイト（https://tektektech-portfolio.com/）。Laravel 13 / PHP 8.5、フロントは Blade ＋ TypeScript ＋ Sass（Vite でビルド）
- **閲覧専用のサイト**：DB・ログイン・フォームはない。ページは `/`（プロフィール）・`/works`（作品の一覧）・`/works/rain-and-realms`（AI で作る作業用 BGM のアルバム。全曲を再生できる）・`/hobbies`・`/games/{tetris,puyo}`・`/tools`（便利ツールの一覧）・`/tools/warikan`・`/tools/board`（匿名質問ボード）・`/tools/lifespan`（寿命の計算）・`/tools/countdown`（今年の残り・祝日・マイ記念日まで）・`/tools/pixel-art`（画像をドット絵にする）・`/tools/chord-player`（雨音コードプレイヤー：コード進行を組み立てて、エレピで鳴らす）・`/tools/{json,datetime,regex}`（開発向け）・`/privacy`（プライバシーポリシー・免責事項。全ページのフッターからリンク）だけ
- 匿名質問ボードだけはサーバー側の処理があるが、Laravel とは別の **`infra/board`（CDK：API Gateway の WebSocket ＋ Lambda ＋ DynamoDB）**。Laravel はページを返すだけで、ブラウザが WebSocket で直接やり取りする。詳細は `infra/board/README.md`
- `/hobbies` の写真は S3 から取得する。S3 への PUT 時に Lambda が幅・高さをメタデータとして付け、`HobbiesController` が `headObject` で読んで縦横を判定する

## 本番の構成

```
閲覧者 ─HTTPS→ CloudFront ─HTTP:80（VPC オリジン：AWS の内部ネットワーク）→ EC2 のプライベート IP
                                      EC2: nginx コンテナ → app コンテナ（php-fpm）
```

- CloudFront のオリジンは **VPC オリジン `tektektech-ec2`**（EC2 のプライベート DNS 名 `ip-172-31-45-191.ap-northeast-1.compute.internal`）。メンテナンス画面（`/errors/*`）だけ S3 オリジン、**`/tools/board/ws` は API Gateway（`BoardStack-prod` の WebSocket）**。このビヘイビアは CDK の外で手で設定している（`X-Origin-Verify` ヘッダーの値は SSM の `/tektektech/board/prod/origin-secret` と同じ。手順は `infra/board/README.md`）
- **`/media/*`（作品の音源）は S3（`MediaStack` の `tektektech-media-<アカウント>`、OAC）**。viewer request の CloudFront Function `tektektech-media-gate` が KeyValueStore の `media_enabled` を見て、`false` なら 403。5 分おきの Lambda が、今月（UTC）の CloudFront 全体の転送量が上限（700GB）を超えたら `false` にし、月が変わったら戻す。このビヘイビアも CDK の外で手で設定している（手順は `infra/media/README.md`）
- EC2 の SG の受信は **80 番・`CloudFront-VPCOrigins-Service-SG` からのみ**（インターネットから EC2 には直接届かない）。ALB はない
- EC2 はパブリックサブネットに置いたまま、**Elastic IP は送信専用**（Docker イメージの取得・SSM・S3・Parameter Store・OS の更新に使う。解放するとデプロイできなくなる）
- 閲覧者 → CloudFront は全ビヘイビア `Redirect HTTP to HTTPS`
- 証明書は ACM（us-east-1、DNS 検証で自動更新）。EC2 へのログインは SSM Session Manager のみ（22 番は閉じている）
- AWS を CLI で見るときは SSO の閲覧専用プロファイル `tektektech-view`（許可セット `ViewOnlyAccess`）を使う。切れたらユーザーに `aws sso login --profile tektektech-view` を実行してもらう
  - `ReadOnlyAccess` は Parameter Store の値（本番の .env）まで読めるため使わない。`ViewOnlyAccess` では Parameter Store の一覧・IAM ポリシーの中身・CloudFront の詳細設定は見られない

## ローカル開発

すべてリポジトリのルートから実行する。

```bash
docker compose up -d --build        # docker-compose.override.yml も自動で読まれ、コードと設定がマウントされる
docker compose exec -T -w /var/www/laravel app composer install
cd laravel && npm install && npm run build   # Vite（開発中は npm run dev）
```

composer・テスト・静的解析は app コンテナで実行する（ホストの PHP に頼らない）。ローカルの app は Dockerfile の `dev` ターゲット（本番の `app` ＋ composer）で、本番のイメージには composer は入らない。

```bash
docker compose exec -T -w /var/www/laravel app php artisan test
docker compose exec -T -w /var/www/laravel app php vendor/bin/phpstan analyse --memory-limit=1G   # level 10
docker compose exec -T -w /var/www/laravel app php vendor/bin/pint --test
cd laravel && npm test   # TS の計算ロジック（resources/ts/lib/*.test.ts）。依存なしで node --test を使う
```

- 見た目に関わる変更は、変更前後で主要な要素の位置・大きさ・色を測って比べる（PC 幅とスマホ幅）。CSS / JS を変えたら `npm run build` し直す
- ブランチは `develop` から `feature/` `refactor/` `fix/` などを切り、PR は `develop` 向けに出す。`develop` → `main` のマージ（＝本番デプロイ）と Rollback の実行はユーザーが行う

## デプロイとロールバック

- `infra/board` は `.github/workflows/board.yml` が別にデプロイする（PR で diff、`develop` → dev、`main` → Environment `production` の承認 → prod）
- `infra/media` は CI（`.github/workflows/media.yml`）でテスト・synth だけを行い、デプロイは管理者が手で `cdk deploy MediaStack` する
- `main` への push で `.github/workflows/deploy.yml` が動く：`test` と `lint`（PHPStan / Pint）が通ったら、ビルド（npm / composer `--no-dev`）→ tarball を S3 へ → SSM Run Command で `deploy/remote-deploy.sh` を実行
- `remote-deploy.sh`：コードを含むイメージ `tektektech-app` / `tektektech-nginx` を **コミットの SHA をタグにして**作り、`deploy/switch-release.sh` でコンテナごと入れ替える。トップページが 200 を返さなければ**直前のリリース（`.current-release`）に自動で戻す**。イメージは直近 3 世代を残す
- 手動で戻すときは Actions の `Rollback` を実行する。**sha を空欄にすると 1 つ前に動いていたリリース（`.previous-release`）に戻る**（もう一度空欄で実行すると元に戻る）。特定のリリースに戻すときは SHA（40 桁）を渡す。戻せる SHA はデプロイのログ末尾の `Images kept for rollback` に出る
- `.env` の中身は Parameter Store の `/tektektech/prod/env`（SecureString）にあり、デプロイ時に EC2 が IAM ロールで取得して `laravel/.env` に書き出す。**`.env` の中身は読まない・出力しない**
- EC2 の `/home/ec2-user/tektektech` に置くのは `docker-compose.yml`・`deploy/`・`laravel/storage`・`laravel/.env`・`.current-release`／`.previous-release` だけ（以前の方式の残骸はデプロイ時に削除する）

## 設計上の前提（変えるときは関連箇所もあわせて直す）

- **GET / HEAD 以外は nginx で 405**。セッション・Cookie・CSRF のミドルウェアは `bootstrap/app.php` で外している。フォームやログインを追加するときは戻すこと
- **CSP は `App\Http\Middleware\ContentSecurityPolicy` で nonce を使って付ける**。インラインの `<script>` には `nonce="{{ Vite::cspNonce() }}"` を付け、`onclick=` などのイベントハンドラ属性は使わない（スクリプト内で登録する）。外部の画像・フォントなどを増やすときはミドルウェアの許可先に追加する。ローカルで `npm run dev` 中は CSP を付けない
- nginx は `index.php` 以外の `.php` を 404、ドットファイルを 403 にする。セキュリティヘッダーは `docker/nginx/security-headers.conf` にまとめ、**location 内で `add_header` を書くときはこのファイルも include する**（書かないと server レベルのヘッダーが消える）。`/build/assets/` の `Cache-Control` は 404 に付かないよう `always` なし
- 本番の opcache は `validate_timestamps=0`（コードはイメージの中で変わらない）。Blade のコンパイル済みビューはコンテナ内の `/tmp/views`
- `config/cache.php` は `serializable_classes => false`（**キャッシュにオブジェクトを入れられない**）。enum などは値（文字列）にして保存する
- **扱うデータを変えたら `privacy.blade.php` も直す**（ツールを足す・保存するものや期間を変える・外部のサービスを増やすなど）。日付も更新する
- 便利ツールはヘッダーの「Tools」→ `/tools`（`tools/index.blade.php`）からたどる。一覧は `config/tools.php` のデータで、ツールを増やしたらここに足す。`purpose`（`general`：一般向け / `dev`：開発向け）と `storage`（`local`：入力をサーバーに送らない＝端末内で完結 / `server`：サーバーに保存する）がカードのラベルと絞り込みに使われ、`storage_note` にデータの扱いを書く
- 寿命の計算の平均寿命は `lib/lifespan.ts` の `LIFE_EXPECTANCY`（日本：厚労省の簡易生命表、世界：国連の World Population Prospects）。新しい統計が出たら、値と `tools/lifespan.blade.php` の出典（リンク・年）をあわせて更新する。「この端末に覚える」を選んだときだけ、誕生日と性別を localStorage（`lifespan:v1`）に残す。ホーム画面には専用の `manifest-lifespan.json` で追加する
- カウントダウンの祝日は `lib/holidays.ts` で祝日法の今の決まり（2022〜2099 年）から計算する。祝日法が変わったら直す。春分・秋分は近似式なので、官報の発表と違ったら直す。マイ記念日は localStorage（`countdown:v1`）。今の季節は気象庁の決まり（春 3〜5 月・夏 6〜8 月・秋 9〜11 月・冬 12〜2 月）
- ドット絵メーカーは、縮小（画素の平均）と減色（メディアンカット）を `lib/pixel-art.ts` で行う。画像はブラウザの中だけで扱い、どこにも保存しない。表示は CSP の `img-src` に `blob:` を足さずに済むよう `<canvas>` に描く
- 雨音コードプレイヤーは、コードの読み取り・ボイシング・8 分ごとに鳴らすもの（`planStep`）・定番の進行（`PRESET_GROUPS`）を `lib/chord-player.ts`、次のコードの候補を `lib/chord-suggest.ts`（よく行く先の表 `TRANSITIONS` と、考えられるキーを絞っていく仕組み）、音の合成（Web Audio API。音のファイルは使わない）を `lib/chord-audio.ts` で行う。鳴らすのは 25ms ごとのタイマーで少し先まで予約する方式（タブが裏にあるときは長めに予約）。入力と設定は localStorage（`chord-player:v1`。組み立て中の状態は残さない）
- 開発向けのツールは見た目を `pages/_devtools.scss`（`.devtool-*`）で共通にする。正規表現は時間のかかるパターンで固まらないよう Web Worker（`lib/regex-worker.ts`）で動かし、1 秒で止める。コピーのボタンは `util/copy.ts` の `data-copy-target`、結果が変わったことを知らせる光らせ方は `util/flash.ts`
- `/tools/*` の便利ツールは計算をブラウザ内だけで行う（サーバーに入力を送らない。匿名質問ボードの投稿だけは例外で、`infra/board` の WebSocket に送る）。DOM に依存しないロジックは `resources/ts/lib/` に置いてテストし、ページの TS（`resources/ts/laravel/tools/`）から使う（`resources/ts/laravel/` 以下は全部 Vite のエントリーになるため）
- 作品はヘッダーの「Works」→ `/works`（`config/works.php` の一覧）からたどる。Rain & Realms のページは `config/rain-and-realms.php`。**リンクはこのサイト → Rain & Realms の一方向だけ**（外部リンクは `rel="noopener noreferrer"`）、曲は AI で生成しているので**「作曲した」とは書かない**、音源のダウンロードは付けない
- 作品の音源は `config('works.media_url')`（既定は同じドメインの `/media`。本番は CloudFront の `/media/*` → S3）から `preload="none"` で再生する。ローカルは `laravel/public/media` に置く（git には入れない）。音源が返ってこない（転送量の上限を超えた月は 403）ときは、YouTube・配信サービスへ案内する。YouTube は押したときだけ youtube-nocookie.com を読み込む。`works.media_url` を別のドメイン（R2 など）に変えたら、CSP は自動で許可されるが、プライバシーポリシーの音源の配信元の記述は手で直す
- `config/` は変更したものだけを置き、ほかは Laravel の既定値を使う。`/hobbies` のゲーム一覧は `config/hobbies.php` のデータ
- Sass は `components/`・`base/`・`pages/` に分け、サイトの緑は `_variables.scss` の `$main-color`。見出しのフォントは `.font-heading`（Google Fonts の Mochiy Pop One。漢字も含む）。Bootstrap 5 のクラスを使う（Bootstrap 4 のクラスは効かない）
- `/` のスキルスタック・略歴・資格は、就活用のクエリ（`config/profile.php`。今は `/?for=recruit`）が付いたときだけ HTML に出す（ツールなどから来た人に見せないため。秘密ではない）。その表示は `noindex`
- `/` と `/profile` は同じ内容のため `/profile` は `/` へ 301。ページのタイトル・説明は `@section('title')` / `@section('description')`

## ハマりどころ

- **`core.fileMode=false`**：`chmod +x` してもコミットに実行権限が乗らない。スクリプトはワークフロー・EC2 とも `bash script.sh` で呼ぶ（必要なら `git update-index --chmod=+x`）
- **SSM Run Command は `/usr/bin` をカレントにして実行される**：デプロイスクリプト内で相対パスを使わない（compose ファイルは絶対パスで指定）
- デプロイスクリプトを変えたら、CI と同じ手順で作ったリリースを使い、`/` をカレントにして `remote-deploy.sh` 自体を手元で実行して確かめる（`aws`（Parameter Store の値の代わりに手元の `.env` を出す）と `chown` だけ偽物にし、`BASE` をテスト用のフォルダに置き換える）
- **`.env`（Parameter Store）だけを変えたときは、Actions の「Deploy to EC2」を Re-run すれば反映される**（`switch-release.sh` が同じリリースでもコンテナを作り直す）。1 ファイルだけのマウントは、ホスト側で `mv` で置き換えるとコンテナを作り直すまで古いファイルが見えたままになる
- Docker Desktop（Mac）で 1 ファイルだけをバインドマウントしていると、書き換え後もコンテナから古い長さのまま見えることがある（`nginx -t` が途中で終わる等）。`docker compose up -d --force-recreate nginx` で直る。本番（Linux）では起きない
- 手元の Docker は Content Trust が有効で、`docker run` は手元で作ったイメージでも失敗する。`docker compose` 経由なら動く
- 編集が反映されないときは、コンパイル済みビュー（`php artisan view:clear`）と opcache（app コンテナの再起動）を疑う
- `docker compose exec` は root で動くため、`php artisan test` や `view:clear` でコンパイル済みビューの `/tmp/views` が root の持ち物になり、php-fpm（www-data）が書き込めずローカルが 500（ログに `tempnam(): file created in the system's temporary directory`）になることがある。ビューを作る artisan は `-u www-data` を付けて実行する。なったら `docker compose exec -T app sh -c 'rm -rf /tmp/views/* && chown www-data:www-data /tmp/views'` で直る
- `Storage::disk('s3')->url()` などは URL を作るだけでも AWS SDK が認証情報を取りに行く（EC2 ではメタデータサービスへの通信、CI では失敗して 500）。全ページで通る処理では使わず、必要なら設定から組み立てる。テストは認証情報なし（`docker compose exec -e AWS_ACCESS_KEY_ID= -e AWS_SECRET_ACCESS_KEY= -e AWS_EC2_METADATA_DISABLED=true ...`）でも通ることを確かめる
