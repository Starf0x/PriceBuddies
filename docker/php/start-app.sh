#!/bin/bash

# Ensure storage exists (before any artisan call: an empty bind-mounted
# storage volume, e.g. Unraid appdata, otherwise breaks key:generate)
mkdir -p storage/framework/sessions \
    && mkdir -p storage/framework/views \
    && mkdir -p storage/framework/testing \
    && mkdir -p storage/logs \
    && mkdir -p storage/app/public \
    && chmod -R 777 storage

# PriceBuddies: keep .env (with APP_KEY) inside the storage volume so it
# survives container updates, unless an .env file is mounted directly.
if [ "${PERSIST_ENV_IN_STORAGE:-true}" = "true" ] && [ ! -e ".env" ] && [ ! -L ".env" ]; then
    ln -s storage/.env .env
fi

# Setup the environment file if it doesn't exist
if [ ! -s ".env" ] || ! grep -q . ".env" ; then
    cp .env.example "$(readlink -f .env)"
    php artisan key:generate --force
fi

# Debugging (without secrets)
printenv | grep -viE 'pass|secret|key|token' || true

# Setup storage and clear caches
php artisan storage:link
php artisan config:clear

# PriceBuddies: SQLite needs no database server (data file lives in the storage volume)
if [ "${DB_CONNECTION}" = "sqlite" ]; then
  export DB_DATABASE="${DB_DATABASE:-/app/storage/database.sqlite}"
  mkdir -p "$(dirname "$DB_DATABASE")"
  [ -f "$DB_DATABASE" ] || touch "$DB_DATABASE"
  chmod 666 "$DB_DATABASE"; chmod 777 "$(dirname "$DB_DATABASE")"
else
  # Wait for the database to be available
  while ! nc -z ${DB_HOST:-database} ${DB_PORT:-3306}; do
    >&2 echo "Database unavailable - sleeping"
    sleep 1
  done
fi

# Optimize clear once DB ready
php artisan optimize:clear

# Run migrations and seed the database if required
php artisan buddy:init-db

# Cache it all
php artisan cache:clear
php artisan optimize
php artisan icons:cache
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan buddy:regenerate-price-cache

# Install xdebug if running in Lando environment
if [ ! -z "${LANDO_INFO}" ]; then
    pecl install xdebug && docker-php-ext-enable xdebug
fi

# Start supervisor that handles cron and apache
supervisord -c /etc/supervisor/conf.d/supervisord.conf
