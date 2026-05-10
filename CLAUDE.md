# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

すべてのコマンドはリポジトリルート（`docker-laravel/`）から実行する。

### Docker

```bash
docker-compose up -d          # コンテナ起動
docker-compose build --no-cache  # イメージ再ビルド
docker-compose down           # コンテナ停止
```

### フロントエンド（ローカル・コンテナ外）

```bash
cd laravel
npm install
npm run build    # 本番ビルド（public/build/ を更新）
npm run dev      # 開発サーバー起動
```

Vite の manifest は `public/build/` に出力される。**新しい `.ts` ファイルを追加した後は必ず `npm run build` を実行すること。** `resources/ts/laravel/**/*.ts` は glob で自動的に Vite エントリに追加される。

### PHPStan（静的解析）

```bash
cd laravel
vendor/bin/phpstan --configuration=phpstan.neon

# メモリ不足エラーが出る場合
php vendor/bin/phpstan analyse app --memory-limit=1G
```

### テスト

```bash
cd laravel
php artisan test

# 単一テストを実行
php artisan test --filter=テストメソッド名
```

## アーキテクチャ

### 全体構成

- **Nginx + PHP-FPM + MySQL** を Docker Compose で管理
- **Laravel 13**（PHP 8.4）がバックエンド
- **Vite** でフロントエンドをビルドし `public/build/` に出力
- **AWS S3** に写真を保存。Lambda が S3 PUT をトリガーに画像の width/height をメタデータとして付加する
- **AWS EC2** に本番デプロイ。`main` push → GitHub Actions → SCP + `docker-compose up --build`

### フロントエンド構成

2種類のフロントエンドが共存している：

| 種類 | エントリ | 用途 |
|---|---|---|
| Laravel Blade 向け TS | `resources/ts/laravel/**/*.ts` | 各ページの DOM 操作・Swiper 等 |
| React SPA | `resources/ts/app.tsx` | `/react/*` 以下のルート |

Blade ページごとに対応する TS ファイルがあり、Blade テンプレート内で `@vite('resources/ts/laravel/xxx.ts')` でロードする。

### CSS 設計上の注意点

`resources/sass/pages/util.scss` にグローバルなスタイルが定義されている。特に以下は全ページに影響するため、ページ固有のスタイルは必ずスコープを当てること：

- `.container` → `display: flex; flex-direction: column` で上書きされている
- `li` → `width: 100%` がデフォルト
- `a` → `position: relative` がデフォルト

ページ固有 SCSS（例: `hobbies.scss`）では `.hobbies-container` 配下にスコープして副作用を防ぐこと。

### S3 写真表示の仕組み

`HobbiesController` が S3 から全オブジェクトを取得し、各オブジェクトの `headObject` で Lambda が付加した `width`/`height` メタデータを読み取って `landscape`/`portrait`/`square` を判定。Blade テンプレートに渡して Swiper で表示する。

`S3Client` は `AppServiceProvider` で DI コンテナに登録済みなので、コントローラのコンストラクタでタイプヒントすれば自動的に注入される。

### ブランチ戦略

```
main ← develop ← feature/...
                ← fix/...
                ← refactor/...
```

feature ブランチは必ず `develop` から切り、PR は `develop` 向けに出す。`main` へのマージは `develop` からのみ。

### デプロイ

`main` への push で GitHub Actions が自動実行される（`.github/workflows/deploy.yml`）：

1. Vite ビルド・`composer install`（PHP 8.4）
2. SCP で EC2 の `/home/ec2-user/tektektech` に転送
3. SSH で EC2 に接続し、`.env.production.enc` を復号して `.env` を生成
4. `docker-compose up -d --build`

`.env.production.enc` の復号は EC2 上で `openssl aes-256-cbc`（鍵: `ENCRYPTION_SECRET` シークレット）により行われる。
