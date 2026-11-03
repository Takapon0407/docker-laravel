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
        $top->assertSee('<meta name="description" content="Webエンジニア・たかぽんのポートフォリオサイトです。', false);
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

        // プライバシーポリシー・免責事項：全ページの下からたどれる
        $privacy = $this->get('/privacy');
        $privacy->assertOk();
        $privacy->assertSee('<title>プライバシーポリシー・免責事項 | てくてくテック</title>', false);
        $privacy->assertSee('<link rel="canonical" href="'.url('/privacy').'">', false);
        foreach ([$top, $hobbies, $warikan] as $page) {
            $page->assertSee('<a href="'.route('privacy').'">プライバシーポリシー・免責事項</a>', false);
        }

        $tools = $this->get('/tools');
        $tools->assertOk();
        $tools->assertSee('<title>便利ツール | てくてくテック</title>', false);
        $tools->assertSee('<link rel="canonical" href="'.url('/tools').'">', false);
        $tools->assertSee('href="'.route('tools.warikan').'"', false);
        // 割り勘は入力をサーバーに送らないツールとして、絞り込んでも残す
        $this->assertToolCard($tools, 'data-purpose="general" data-storage="local"', route('tools.warikan'));
        $tools->assertSee('id="tools-filter-local"', false);
        $tools->assertSee('id="tools-filter-server"', false);
        $tools->assertSee('id="tools-purpose-dev"', false);

        // 寿命の計算：一般向け・端末内で完結。出典の統計へのリンクを載せる
        $this->assertToolCard($tools, 'data-purpose="general" data-storage="local"', route('tools.lifespan'));
        $lifespan = $this->get(route('tools.lifespan'));
        $lifespan->assertOk();
        $lifespan->assertSee('<title>寿命の計算 | てくてくテック</title>', false);
        $lifespan->assertSee('href="https://www.mhlw.go.jp/toukei/saikin/hw/life/life25/index.html"', false);
        $lifespan->assertSee('href="https://population.un.org/wpp/"', false);
        // 共有する前に、おおよその年齢がわかることを確かめる画面を出す
        $lifespan->assertSee('id="lifespan-share-dialog"', false);
        $lifespan->assertSee('あなたのおおよその年齢がわかります', false);
        // ホーム画面には寿命の計算のアプリとして追加し、誕生日はチェックしたときだけ端末に覚える
        $lifespan->assertSee('<link rel="manifest" href="'.asset('manifest-lifespan.json').'">', false);
        $lifespan->assertSee('id="lifespan-remember"', false);

        // 開発向けのツール：一覧から「端末内で完結」としてたどれ、ページごとのタイトルを出す
        foreach ([
            'tools.json' => 'JSON 整形',
            'tools.datetime' => '日時の変換（UTC / JST）',
            'tools.regex' => '正規表現チェック',
        ] as $route => $title) {
            $this->assertToolCard($tools, 'data-purpose="dev" data-storage="local"', route($route));
            $page = $this->get(route($route));
            $page->assertOk();
            $page->assertSee('<title>'.$title.' | てくてくテック</title>', false);
            $page->assertSee('<link rel="canonical" href="'.route($route).'">', false);
        }
    }
}
