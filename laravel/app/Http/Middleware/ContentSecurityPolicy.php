<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * ページに Content-Security-Policy を付ける
 *
 * スクリプトは自サイトのファイルと、このリクエスト用の nonce を付けたもの
 * （@vite が出力するタグ・ゲームページのインラインスクリプト）だけを実行できるようにする。
 * nginx でも最低限の CSP（base-uri など）を付けており、ブラウザは両方を満たすものだけを許可する。
 */
class ContentSecurityPolicy
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // @vite が出力する <script> / <link> にも同じ nonce が付く
        $nonce = Vite::useCspNonce();

        $response = $next($request);

        // ローカルで Vite の開発サーバー（npm run dev）を使っているときは付けない
        // （開発サーバーのアドレスが [::1] のように CSP で指定できない形になることがあるため）
        if (! Vite::isRunningHot()) {
            $response->headers->set('Content-Security-Policy', $this->policy($nonce));
        }

        return $response;
    }

    private function policy(string $nonce): string
    {
        $photoOrigin = $this->photoOrigin();

        $directives = [
            'default-src' => ["'self'"],
            'script-src' => ["'self'", "'nonce-{$nonce}'"],
            // Bootstrap / Swiper やテトリスの描画が style 属性を使うため 'unsafe-inline' を許可する
            'style-src' => ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'font-src' => ["'self'", 'https://fonts.gstatic.com'],
            // data: はハンバーガーメニューのアイコン（CSS 内の SVG）
            'img-src' => array_filter(["'self'", 'data:', $photoOrigin]),
            // 匿名質問ボードの WebSocket を別のドメインにつなぐとき（ローカルで dev 環境を使うときなど）はその接続先も許可する
            'connect-src' => array_filter(["'self'", $this->boardWebSocketOrigin()]),
            'manifest-src' => ["'self'"],
            'base-uri' => ["'self'"],
            'object-src' => ["'none'"],
            'frame-ancestors' => ["'self'"],
            'form-action' => ["'self'"],
        ];

        return collect($directives)
            ->map(fn (array $sources, string $name): string => $name.' '.implode(' ', $sources))
            ->implode('; ');
    }

    /**
     * 写真（/hobbies）を配信している S3 のオリジン
     *
     * Storage::disk('s3')->url() は AWS SDK が認証情報を取りに行く（EC2 ではメタデータサービスへの通信が発生する）ため、
     * 全ページで使うこのミドルウェアでは使わず、filesystems の設定から組み立てる
     */
    private function photoOrigin(): ?string
    {
        $url = config('filesystems.disks.s3.url');
        if (is_string($url) && $url !== '') {
            return $this->originOf($url);
        }

        $endpoint = config('filesystems.disks.s3.endpoint');
        if (is_string($endpoint) && $endpoint !== '') {
            return $this->originOf($endpoint);
        }

        $bucket = config('filesystems.disks.s3.bucket');
        $region = config('filesystems.disks.s3.region');
        if (! is_string($bucket) || $bucket === '' || ! is_string($region) || $region === '') {
            return null;
        }

        return "https://{$bucket}.s3.{$region}.amazonaws.com";
    }

    private function boardWebSocketOrigin(): ?string
    {
        $url = config('board.websocket_url');

        return is_string($url) && $url !== '' ? $this->originOf($url) : null;
    }

    private function originOf(string $url): ?string
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($scheme) || ! is_string($host)) {
            return null;
        }

        return "{$scheme}://{$host}";
    }
}
