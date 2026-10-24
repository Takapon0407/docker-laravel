<?php

namespace Tests\Feature;

use Aws\S3\S3Client;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class ContentSecurityPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('s3');
        $this->app->instance(S3Client::class, Mockery::mock(S3Client::class));
    }

    /**
     * 各ページの CSP はスクリプトを自サイトと nonce を付けたものだけに制限し、ページ内の <script> にはすべてその nonce が付いていること
     */
    public function test_pages_restrict_scripts_with_nonce(): void
    {
        foreach (['/', '/hobbies', '/games/tetris', '/games/puyo'] as $path) {
            $response = $this->get($path);
            $response->assertStatus(200);

            $policy = (string) $response->headers->get('Content-Security-Policy');
            $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-([A-Za-z0-9]+)'/", $policy, $path);
            preg_match("/'nonce-([A-Za-z0-9]+)'/", $policy, $matches);
            $nonce = $matches[1] ?? '';

            $html = (string) $response->getContent();
            preg_match_all('/<script\b[^>]*>/i', $html, $scripts);
            $this->assertNotEmpty($scripts[0], $path);
            foreach ($scripts[0] as $tag) {
                $this->assertStringContainsString('nonce="'.$nonce.'"', $tag, "{$path}: {$tag}");
            }

            // CSP で実行できないインラインのイベントハンドラ属性（onclick= など）を使っていないこと
            $this->assertDoesNotMatchRegularExpression('/<[^>]+\son[a-z]+\s*=/i', $html, $path);
        }
    }

    /**
     * nonce はリクエストごとに変わること
     */
    public function test_nonce_changes_per_request(): void
    {
        $first = $this->get('/')->headers->get('Content-Security-Policy');
        $second = $this->get('/')->headers->get('Content-Security-Policy');

        $this->assertNotSame($first, $second);
    }
}
