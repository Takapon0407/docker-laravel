<?php

namespace Tests\Feature;

use Tests\TestCase;

class BoardPageTest extends TestCase
{
    /**
     * 公開するまでは、匿名質問ボードのページを 404 にすること
     */
    public function test_pages_are_not_found_until_enabled(): void
    {
        config(['board.enabled' => false]);

        $this->get('/tools/board')->assertNotFound();
        $this->get('/tools/board/room')->assertNotFound();
    }

    /**
     * 有効にしたら、作成ページとルームのページを検索結果に出さない形で表示すること
     */
    public function test_pages_are_shown_without_indexing_when_enabled(): void
    {
        config(['board.enabled' => true, 'board.websocket_url' => null]);

        foreach (['/tools/board', '/tools/board/room'] as $path) {
            $response = $this->get($path);
            $response->assertOk();
            $response->assertSee('<meta name="robots" content="noindex">', false);
            // 接続先の設定がなければ空（ブラウザがページと同じドメインの /tools/board/ws につなぐ）
            $response->assertSee('<meta name="board-websocket-url" content="">', false);
        }
    }

    /**
     * 接続先を別のドメインにしたときは、ページに渡し、CSP の connect-src でも許可すること
     */
    public function test_configured_websocket_url_is_passed_and_allowed_by_csp(): void
    {
        config(['board.enabled' => true, 'board.websocket_url' => 'wss://dev.example.net/tools/board/ws']);

        $response = $this->get('/tools/board');

        $response->assertSee('<meta name="board-websocket-url" content="wss://dev.example.net/tools/board/ws">', false);
        $this->assertStringContainsString(
            "connect-src 'self' wss://dev.example.net;",
            (string) $response->headers->get('Content-Security-Policy'),
        );
    }

    /**
     * 接続先の設定がなければ、connect-src は自サイトだけのままにすること
     */
    public function test_csp_connect_src_is_self_only_by_default(): void
    {
        config(['board.websocket_url' => null]);

        $response = $this->get('/tools/warikan');

        $this->assertStringContainsString("connect-src 'self';", (string) $response->headers->get('Content-Security-Policy'));
    }
}
