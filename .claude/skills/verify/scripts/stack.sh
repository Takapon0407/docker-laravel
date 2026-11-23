#!/usr/bin/env bash
# Local stack for verification: one instance at a time on http://localhost (port 80, fixed container names app/nginx).
#   bash .claude/skills/verify/scripts/stack.sh doctor [checkout]   read-only: is the running instance serving <checkout>?
#   bash .claude/skills/verify/scripts/stack.sh up [checkout]       serve <checkout> (default: this checkout), install deps, build assets, wait for 200
#   bash .claude/skills/verify/scripts/stack.sh restore             give the stack back to the checkout that served it before `up`
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
main="$(git -C "$here" worktree list --porcelain | sed -n '1s/^worktree //p')"
state="$main/.verify"

resolve_checkout() {
    local dir="${1:-$(git -C "$here" rev-parse --show-toplevel)}"
    git -C "$dir" rev-parse --show-toplevel
}

# The checkout whose laravel/ is mounted into the app container, empty when the stack is down.
mounted_checkout() {
    local src
    src="$(docker inspect app --format '{{range .Mounts}}{{if eq .Destination "/var/www/laravel"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
    [ -n "$src" ] && dirname "$src" || true
}

wait_ready() {
    for _ in $(seq 1 60); do
        [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)" = "200" ] && return 0
        sleep 2
    done
    echo "http://localhost/ did not return 200 (docker compose logs nginx app)" >&2
    return 1
}

doctor() {
    local target ok=1 mounted
    target="$(resolve_checkout "${1:-}")"
    mounted="$(mounted_checkout)"
    echo "target checkout : $target ($(git -C "$target" rev-parse --short HEAD), $(git -C "$target" branch --show-current))"
    echo "mounted checkout: ${mounted:-<stack down>}"
    for c in app nginx; do
        if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ]; then printf '%-16s: running\n' "container $c"; else printf '%-16s: NOT running\n' "container $c"; ok=0; fi
    done
    [ "$mounted" = "$target" ] || { echo "PROBLEM: the stack serves another checkout. Run: stack.sh up $target"; ok=0; }
    docker port nginx 80/tcp 2>/dev/null | grep -q ':80$' || { echo "PROBLEM: port 80 is not published by the nginx container"; ok=0; }
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost/ || true)"
    echo "GET /           : $code"
    [ "$code" = "200" ] || ok=0
    local manifest="$target/laravel/public/build/manifest.json"
    if [ ! -f "$manifest" ]; then
        echo "PROBLEM: no built assets ($manifest). Run: stack.sh up $target"; ok=0
    elif [ -n "$(find "$target/laravel/resources" -newer "$manifest" -type f -print -quit)" ]; then
        echo "PROBLEM: resources/ changed after the last build. Run: stack.sh up $target"; ok=0
    else
        echo "assets          : built after the last change in resources/"
    fi
    if [ "$ok" = 1 ]; then echo "doctor: OK"; else echo "doctor: NOT READY"; return 1; fi
}

up() {
    local target current
    target="$(resolve_checkout "${1:-}")"
    current="$(mounted_checkout)"
    mkdir -p "$state"
    # Remember who had the stack before this run, once, so restore can give it back.
    [ -f "$state/previous-owner" ] || echo "${current:-$main}" >"$state/previous-owner"
    # A worktree has no .env (it is not in git). Copy it without reading it (CLAUDE.md: never read or print .env).
    if [ ! -f "$target/laravel/.env" ]; then
        cp "$main/laravel/.env" "$target/laravel/.env"
        echo "copied laravel/.env from $main (scaffolding; removed by restore)"
        echo "$target/laravel/.env" >>"$state/scaffolding"
    fi
    if [ -n "$current" ] && [ "$current" != "$target" ]; then
        echo "stopping the stack served from $current"
        (cd "$current" && docker compose down)
    fi
    (cd "$target" && docker compose up -d)
    (cd "$target" && docker compose exec -T -w /var/www/laravel app composer install --no-interaction --quiet)
    if [ ! -d "$target/laravel/node_modules" ]; then
        (cd "$target/laravel" && npm ci --no-audit --no-fund --silent)
    fi
    (cd "$target/laravel" && npm run build >/dev/null)
    # Views compiled by root (artisan as root) make php-fpm fail with 500 (CLAUDE.md pitfalls).
    (cd "$target" && docker compose exec -T app sh -c 'mkdir -p /tmp/views && chown -R www-data:www-data /tmp/views')
    wait_ready
    doctor "$target"
}

restore() {
    local previous current
    [ -f "$state/previous-owner" ] || { echo "nothing to restore"; return 0; }
    previous="$(cat "$state/previous-owner")"
    current="$(mounted_checkout)"
    if [ -n "$current" ] && [ "$current" != "$previous" ]; then
        (cd "$current" && docker compose down)
    fi
    if [ "$current" != "$previous" ]; then
        (cd "$previous" && docker compose up -d)
        wait_ready
    fi
    if [ -f "$state/scaffolding" ]; then
        while IFS= read -r f; do rm -f "$f"; done <"$state/scaffolding"
        rm -f "$state/scaffolding"
    fi
    rm -f "$state/previous-owner"
    echo "stack restored to $previous"
}

case "${1:-}" in
doctor) doctor "${2:-}" ;;
up) up "${2:-}" ;;
restore) restore ;;
*) echo "usage: stack.sh doctor|up [checkout] | restore" >&2; exit 2 ;;
esac
