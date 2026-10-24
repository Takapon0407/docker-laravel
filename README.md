# docker-laravel

ポートフォリオ用のサイト
https://tektektech-portfolio.com/

# branch 名の基本ルール

| branch 名    | 用途             |
| ------------ | ---------------- |
| main         | 本番用           |
| develop      | 開発用           |
| feature/...  | 新規機能開発用   |
| refactor/... | リファクタ用     |
| fix/...      | バグフィックス用 |

# 環境構築

## laravel

```
$ git clone git@github.com:Takapon0407/docker-laravel.git
$ cd docker-laravel
$ pwd
/Users/taka/Practice/Laravel/docker-laravel/docker-laravel (=リポジトリのルート)
$ cd laravel
$ composer install
$ cd ..
$ docker compose up -d --build
```

上記でコンテナを立ち上げた後、`http://localhost/`へアクセス

ローカルでは `docker-compose.override.yml` が自動で読み込まれ、コード（`laravel/`）と nginx の設定をコンテナにマウントするため、編集はすぐ反映される。
本番は `docker-compose.yml` だけを使い、コードを含むイメージでコンテナごと入れ替える（下記「デプロイ」）。

### php stan での静的分析を local で叩く

pr をマージする際、actions で静的分析が行われる。
local で php stan を動かすには以下手順を参考。

```
$ pwd
docker-laravel/laravel
$ ./vendor/bin/phpstan analyse

// localでメモリリミットのエラーが起きる場合
php vendor/bin/phpstan analyse app --memory-limit=1G

```

## frontend(Vite)

Blade 用の TypeScript / Sass を Vite でビルドする。

```
$ pwd
... docker-laravel/laravel
$ npm install
$ npm run dev
```

## デプロイ

`main` へのマージで GitHub Actions（`Deploy to EC2`）が実行される。

1. テスト・Lint が通ったら、Vite のビルドと `composer install --no-dev` を行い、tarball を S3 に置く
2. SSM Run Command で EC2 上の `deploy/remote-deploy.sh` を実行し、コードを含むイメージ（`tektektech-app` / `tektektech-nginx`）をコミットの SHA をタグにして作る
3. `deploy/switch-release.sh` でコンテナを新しいイメージに入れ替え、トップページが 200 を返すか確認する。**失敗したら直前のリリースに自動で戻す**
4. ロールバック用に直近 3 リリース分のイメージを残し、それより古いものは消す（残っている SHA はデプロイのログの末尾に出る）

### ロールバック

GitHub の Actions → `Rollback` → `Run workflow` で、戻したいリリースのコミット SHA（40 桁）を指定して実行する。

## env ファイルの更新手順について

local の `laravel/` ディレクトリにて以下を実行。
パスフレーズは 1Password（`op://selfdevelopment/tektektech-portfolio/env-enc-key`）と、本番 EC2 が読み取る AWS Systems Manager Parameter Store（`/tektektech/prod/env-enc-key`、SecureString）で管理している（公開厳禁、`.env.production` や GitHub Secrets には置かない）。パスフレーズを変更するときは両方を更新する。
1Password CLI（`brew install 1password-cli`、アプリの「設定 → 開発者 → 1Password CLI と連携」をオン）で取り出し、`-pass file:<(...)` で渡す。
コマンド引数に直接書くとシェル履歴やプロセス一覧に残るため、`-k` や `-pass pass:` は使わない。

```
// 暗号化
openssl aes-256-cbc -salt -pbkdf2 -iter 10000 -in .env.production -out .env.production.enc -pass file:<(op read --no-newline "op://selfdevelopment/tektektech-portfolio/env-enc-key")

// 復号化(.env.productionとして書き出し)
openssl aes-256-cbc -d -pbkdf2 -iter 10000 -in .env.production.enc -out .env.production -pass file:<(op read --no-newline "op://selfdevelopment/tektektech-portfolio/env-enc-key")
```

## 画像の追加について

画像追加時の基本フローは一旦は以下の通り。
adobe light room classic にて、下記設定で画像書き出し。

- 1280 × 853 で書き出し。（縦構図は逆）
- Max は 150KB

上記の形で書き出したファイル群を S3 へ PUT。
PUT 後、lambda でメタデータに解像度が付加されるので、あとは本番の画面等で問題なく表示されていることを確認。

※後々ファイル追加もフロント経由でできると良い（ただし、認証等入れる必要も出てきてそこまでする？感はあるので、いったんは別の見せ物優先で）
