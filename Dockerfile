FROM php:8.5-fpm
COPY ./docker/php/php.ini /usr/local/etc/php/
# Laravelアプリケーションのソースコードをコピー
# （composer install / npm run build は GitHub Actions 側で実施済みのため、イメージには composer 等を入れない）
COPY ./laravel /var/www/laravel
WORKDIR /var/www
