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
        $top->assertSee('<meta name="description" content="Laravel・React・AWSを中心にWebサービスを開発しているエンジニア、たかぽんのポートフォリオです。', false);
        // ヘッダーのロゴもサイト名と同じ表記にそろえる
        $top->assertDontSee('てくてくてっく');

        $hobbies = $this->get('/hobbies');
        $hobbies->assertSee('<title>趣味 | てくてくテック</title>', false);
        $hobbies->assertSee('<link rel="canonical" href="'.url('/hobbies').'">', false);
        $hobbies->assertSee('<meta property="og:title" content="趣味 | てくてくテック">', false);
        $hobbies->assertSee('<meta name="description" content="Webエンジニア・たかぽんの趣味のページです。α7R3で撮った写真、弾いている楽器、これまで遊んできたゲームを紹介しています。">', false);

        $warikan = $this->get('/tools/warikan');
        $warikan->assertOk();
        $warikan->assertSee('<title>割り勘計算 | てくてくテック</title>', false);
        $warikan->assertSee('<link rel="canonical" href="'.url('/tools/warikan').'">', false);
        // ヘッダーからたどれること
        $warikan->assertSee('href="'.route('tools.warikan').'"', false);
    }
}
