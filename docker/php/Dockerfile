FROM php:8.1-fpm 
COPY php.ini /usr/local/etc/php/
RUN apt-get update && apt-get install -y \
    zlib1g-dev \
    libzip-dev \
    vim \
  && docker-php-ext-install zip pdo_mysql opcache
WORKDIR /var/www
COPY --from=composer /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER 1 
ENV COMPOSER_HOME /composer
ENV PATH $PATH:/composer/vendor/bin
RUN composer global require "laravel/installer"