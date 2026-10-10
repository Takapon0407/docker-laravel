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
$ docker-compose up -d
```

上記でコンテナを立ち上げた後、`http://localhost/`へアクセス

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

## frontend(React)

```
$ pwd
... docker-laravel/laravel
$ npm install
$ npm run dev
```

`http://localhost/react/home`へアクセス

## env ファイルの更新手順について

local の `laravel/` ディレクトリにて以下を実行。
パスフレーズ（GitHub Secrets の `ENCRYPTION_SECRET` と同じ値）は `~/.config/tektektech/enc_pass` に保存しておく（公開厳禁、`.env.production` には書かない）。
コマンド引数に直接書くとシェル履歴やプロセス一覧に残るため、`-pass file:` で読み込む。

```
// 暗号化
openssl aes-256-cbc -salt -pbkdf2 -iter 10000 -in .env.production -out .env.production.enc -pass file:$HOME/.config/tektektech/enc_pass

// 復号化(.env.productionとして書き出し)
openssl aes-256-cbc -d -pbkdf2 -iter 10000 -in .env.production.enc -out .env.production -pass file:$HOME/.config/tektektech/enc_pass
```

## 画像の追加について

画像追加時の基本フローは一旦は以下の通り。
adobe light room classic にて、下記設定で画像書き出し。

- 1280 × 853 で書き出し。（縦構図は逆）
- Max は 150KB

上記の形で書き出したファイル群を S3 へ PUT。
PUT 後、lambda でメタデータに解像度が付加されるので、あとは本番の画面等で問題なく表示されていることを確認。

※後々ファイル追加もフロント経由でできると良い（ただし、認証等入れる必要も出てきてそこまでする？感はあるので、いったんは別の見せ物優先で）
