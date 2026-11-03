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
        // ヘッダーからツールの一覧へ、一覧から割り勘へたどれること
        $warikan->assertSee('href="'.route('tools.index').'"', false);
        // ホーム画面には割り勘専用のアプリとして追加する（ほかのページはポートフォリオの manifest のまま）
        $warikan->assertSee('<link rel="manifest" href="'.asset('manifest-warikan.json').'">', false);
        $warikan->assertSee('<link rel="apple-touch-icon" href="'.asset('icons/warikan-apple-touch-icon.png').'">', false);
        $top->assertSee('<link rel="manifest" href="'.asset('manifest.json').'">', false);
        $top->assertSee('<link rel="apple-touch-icon" href="'.asset('icons/apple-touch-icon.png').'">', false);

        $tools = $this->get('/tools');
        $tools->assertOk();
        $tools->assertSee('<title>便利ツール | てくてくテック</title>', false);
        $tools->assertSee('<link rel="canonical" href="'.url('/tools').'">', false);
        $tools->assertSee('href="'.route('tools.warikan').'"', false);
        // 割り勘は入力をサーバーに送らないツールとして、絞り込んでも残す
        $tools->assertSeeInOrder(['data-purpose="general" data-storage="local"', 'href="'.route('tools.warikan').'"'], false);
        $tools->assertSee('id="tools-filter-local"', false);
        $tools->assertSee('id="tools-filter-server"', false);
        $tools->assertSee('id="tools-purpose-dev"', false);

        // 寿命の計算：一般向け・端末内で完結。出典の統計へのリンクを載せる
        $tools->assertSeeInOrder(['data-purpose="general" data-storage="local"', 'href="'.route('tools.lifespan').'"'], false);
        $lifespan = $this->get(route('tools.lifespan'));
        $lifespan->assertOk();
        $lifespan->assertSee('<title>寿命の計算 | てくてくテック</title>', false);
        $lifespan->assertSee('href="https://www.mhlw.go.jp/toukei/saikin/hw/life/life25/index.html"', false);
        $lifespan->assertSee('href="https://population.un.org/wpp/"', false);

        // 開発向けのツール：一覧から「端末内で完結」としてたどれ、ページごとのタイトルを出す
        foreach ([
            'tools.json' => 'JSON 整形',
            'tools.datetime' => '日時の変換（UTC / JST）',
            'tools.regex' => '正規表現チェック',
        ] as $route => $title) {
            $tools->assertSeeInOrder(['data-purpose="dev" data-storage="local"', 'href="'.route($route).'"'], false);
            $page = $this->get(route($route));
            $page->assertOk();
            $page->assertSee('<title>'.$title.' | てくてくテック</title>', false);
            $page->assertSee('<link rel="canonical" href="'.route($route).'">', false);
        }
    }
}
