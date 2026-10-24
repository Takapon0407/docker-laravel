<?php

use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // CloudFront 経由のリクエストのため、X-Forwarded-For / Port / Proto を信頼する
        // X-Forwarded-Host は信頼しない（URL 生成は AppServiceProvider で APP_URL に固定）
        // TrustHosts はオリジンに渡る Host が CloudFront の設定次第で変わるため無効のまま
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR |
                Request::HEADER_X_FORWARDED_PORT |
                Request::HEADER_X_FORWARDED_PROTO,
        );

        // サイトは閲覧専用（GET のみ、フォーム・ログインなし）のため、セッション・Cookie・CSRF 対策は使わない
        // （来訪者ごとのセッションファイル作成と Set-Cookie をなくし、CloudFront でキャッシュしやすくする）
        // フォームやログインを追加するときは、ここで外しているミドルウェアを戻すこと
        $middleware->web(remove: [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            PreventRequestForgery::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
