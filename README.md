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
$ docker compose up -d --build
$ docker compose exec -w /var/www/laravel app composer install
```

上記でコンテナを立ち上げた後、`http://localhost/`へアクセス

composer は手元の PHP ではなく app コンテナ（本番と同じ PHP 8.5）で動かす。ローカルの app コンテナは Dockerfile の `dev` ターゲット（本番の `app` に composer を足したもの）で作られる。

ローカルでは `docker-compose.override.yml` が自動で読み込まれ、コード（`laravel/`）と nginx の設定をコンテナにマウントするため、編集はすぐ反映される。
本番は `docker-compose.yml` だけを使い、コードを含むイメージでコンテナごと入れ替える（下記「デプロイ」）。

### php stan での静的分析を local で叩く

pr をマージする際、actions で静的分析が行われる。
local で php stan を動かすには以下手順を参考。

```
$ pwd
docker-laravel (=リポジトリのルート)
$ docker compose exec -T -w /var/www/laravel app php vendor/bin/phpstan analyse --memory-limit=1G
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

本番の `.env` の中身は、AWS Systems Manager Parameter Store の **`/tektektech/prod/env`（SecureString）** に置いている（リポジトリや GitHub Secrets には置かない）。
デプロイのたびに EC2 が IAM ロールで読み取り、`laravel/.env` に書き出す。

更新するときは、AWS コンソールの Systems Manager → パラメータストア → `/tektektech/prod/env` →「編集」で値を書き換え、`main` にデプロイする（デプロイ時に反映される）。
CLI で更新する場合は、書き込み権限のある認証情報で次を実行する（値をコマンド引数に直接書かず、ファイルから渡す）。

```
aws ssm put-parameter --region ap-northeast-1 --name /tektektech/prod/env --type SecureString --overwrite --value file://.env.production
```

`.env.production` を手元に作った場合は、更新後に削除する（`.gitignore` 済みだが、平文を残さない）。

## 画像の追加について

画像追加時の基本フローは一旦は以下の通り。
adobe light room classic にて、下記設定で画像書き出し。

- 1280 × 853 で書き出し。（縦構図は逆）
- Max は 150KB

上記の形で書き出したファイル群を S3 へ PUT。
PUT 後、lambda でメタデータに解像度が付加されるので、あとは本番の画面等で問題なく表示されていることを確認。

※後々ファイル追加もフロント経由でできると良い（ただし、認証等入れる必要も出てきてそこまでする？感はあるので、いったんは別の見せ物優先で）
