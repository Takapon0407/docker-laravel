<?php

namespace Tests\Feature;

use Aws\S3\S3Client;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class PageMetaTest extends TestCase
{
    /**
     * トップページと同じ内容だった /profile は、トップページへ恒久的に転送すること
     */
    public function test_profile_url_redirects_permanently_to_top(): void
    {
        $response = $this->get('/profile');

        $response->assertStatus(301);
        $response->assertRedirect(url('/'));
    }

    /**
     * ページごとのタイトル・説明・canonical・OGP を出力すること
     */
    public function test_pages_output_title_description_and_ogp(): void
    {
        Storage::fake('s3');
        $this->app->instance(S3Client::class, Mockery::mock(S3Client::class));

        $top = $this->get('/');
        $top->assertSee('<title>てくてくテック</title>', false);
        $top->assertSee('<link rel="canonical" href="'.url('/').'">', false);
        $top->assertSee('<meta property="og:title" content="てくてくテック">', false);
        $top->assertSee('<meta name="description" content="Webエンジニア・たかぽんのポートフォリオサイトです。スキルスタック', false);

        $hobbies = $this->get('/hobbies');
        $hobbies->assertSee('<title>趣味 | てくてくテック</title>', false);
        $hobbies->assertSee('<link rel="canonical" href="'.url('/hobbies').'">', false);
        $hobbies->assertSee('<meta property="og:title" content="趣味 | てくてくテック">', false);
        $hobbies->assertSee('<meta name="description" content="たかぽんの趣味（写真・音楽・ゲーム）を紹介しています。">', false);
    }
}
