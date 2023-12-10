# docker-laravel

ポートフォリオ用のサイト

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

上記でコンテナを立ち上げた後、`http://localhost:8000/`へアクセス

## frontend(React)

```
$ pwd
... docker-laravel/laravel
$ npm install
$ npm run dev
```

`http://localhost:8000/react/home`へアクセス

## env ファイルの更新手順について

local にて以下を実行。
(ENCRYPTION_SECRET は置き換える)

```
// 暗号化
openssl aes-256-cbc -salt -pbkdf2 -iter 10000 -in .env -out .env.production.enc -k <ENCRYPTION_SECRET>

// 複合化(.env.productionとして書き出し)
openssl aes-256-cbc -d -pbkdf2 -iter 10000 -in .env.production.enc -out .env.production -k <ENCRYPTION_SECRET>
```
