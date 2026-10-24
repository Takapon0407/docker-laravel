# アプリのコード（vendor と Vite のビルド結果を含む。GitHub Actions でビルド済み）をイメージに含め、
# デプロイはイメージごとコンテナを入れ替える（実行中のコンテナが読むファイルを上書きしない）
# ローカル開発では docker-compose.override.yml でコードをマウントして上書きする

# PHP-FPM（Laravel）
FROM php:8.5-fpm AS app
COPY ./docker/php/php.ini /usr/local/etc/php/
# composer install / npm run build は GitHub Actions 側で実施済みのため、イメージには composer 等を入れない
COPY ./laravel /var/www/laravel
# storage は実行時にマウントする。bootstrap/cache（設定キャッシュ）はコンテナごとに作るため、php-fpm（www-data）が書き込めるようにする
RUN mkdir -p /var/www/laravel/storage /var/www/laravel/bootstrap/cache \
    && chown www-data:www-data /var/www/laravel/bootstrap/cache
WORKDIR /var/www

# nginx（公開ディレクトリと設定だけを含める。.env などは見せない）
FROM nginx:stable AS nginx
COPY ./docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY ./docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY ./laravel/public /var/www/laravel/public
