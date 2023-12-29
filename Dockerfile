FROM php:8.1-fpm 
COPY ./docker/php/php.ini /usr/local/etc/php/
RUN apt-get update && apt-get install -y \
    zlib1g-dev \
    libzip-dev \
    vim \
  && docker-php-ext-install zip pdo_mysql opcache
# Laravelアプリケーションのソースコードをコピー
COPY ./laravel /var/www/laravel
WORKDIR /var/www
COPY --from=composer /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER 1 
ENV COMPOSER_HOME /composer
ENV PATH $PATH:/composer/vendor/bin
RUN composer global require "laravel/installer"
# パーミッションの設定
RUN chmod -R 777 laravel/storage
