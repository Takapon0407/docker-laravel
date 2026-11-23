<?php

namespace Tests\Feature;

use Tests\TestCase;

// ガチャ天井計算機のページ（harness/spec.md「ガチャで狙いが手に入るまでの回数と金額を計算する」gacha-03）
class GachaPageTest extends TestCase
{
    private const DESCRIPTION = '確率・すり抜け・天井（ソフト天井）・交換までの回数を入れると、ガチャで狙いが手に入るまでの平均の回数と金額、運が悪いときの回数、予算で手に入る確率を計算します。入力はブラウザの中だけで処理し、サーバーには送りません。';

    /**
     * /tools/gacha が開け、タイトル・説明・canonical・見出しがあること
     */
    public function test_page_has_title_description_canonical_and_heading(): void
    {
        $response = $this->get('/tools/gacha');

        $response->assertOk();
        $response->assertSee('<title>ガチャ天井計算機 | てくてくテック</title>', false);
        $response->assertSee('<meta name="description" content="'.self::DESCRIPTION.'">', false);
        $response->assertSee('<link rel="canonical" href="'.url('/tools/gacha').'">', false);
        $this->assertMatchesRegularExpression('/<h1\b[^>]*>ガチャ天井計算機<\/h1>/', (string) $response->getContent());
        $this->assertSame(url('/tools/gacha'), route('tools.gacha'));
    }

    /**
     * /tools の一覧に、QR コード作成の次にカードがあること（一般向け・端末内で完結）
     */
    public function test_tools_index_lists_gacha_after_qr(): void
    {
        $html = (string) $this->get('/tools')->assertOk()->getContent();

        preg_match_all('/<li data-purpose="([a-z]+)" data-storage="([a-z]+)">\s*<a class="tools-card" href="([^"]+)"/', $html, $cards, PREG_SET_ORDER);
        $hrefs = array_column($cards, 3);
        $qr = array_search(route('tools.qr'), $hrefs, true);
        $gacha = array_search(route('tools.gacha'), $hrefs, true);

        $this->assertIsInt($qr);
        $this->assertSame($qr + 1, $gacha);
        $this->assertSame('general', $cards[$gacha][1]);
        $this->assertSame('local', $cards[$gacha][2]);
    }

    /**
     * スクリプトは nonce 付きの Vite のものだけで、インラインの <script> と on*= 属性がないこと
     */
    public function test_page_scripts_use_nonce_without_inline_code(): void
    {
        $response = $this->get('/tools/gacha');
        $policy = (string) $response->headers->get('Content-Security-Policy');
        preg_match("/'nonce-([A-Za-z0-9]+)'/", $policy, $matches);
        $nonce = $matches[1] ?? '';
        $this->assertNotSame('', $nonce);

        $html = (string) $response->getContent();
        preg_match_all('/<script\b([^>]*)>(.*?)<\/script>/is', $html, $scripts, PREG_SET_ORDER);
        $this->assertNotEmpty($scripts);
        $viteScripts = 0;
        foreach ($scripts as [$tag, $attributes, $body]) {
            $this->assertStringContainsString('nonce="'.$nonce.'"', $attributes, $tag);
            if (preg_match('/\bsrc="[^"]*gacha[^"]*"/', $attributes) === 1) {
                $viteScripts++;
            }
            // 中身のある（インラインの）スクリプトは置かない
            if (! str_contains($attributes, 'src=')) {
                $this->assertSame('', trim($body), $tag);
            }
        }
        $this->assertGreaterThan(0, $viteScripts, 'Vite のガチャのスクリプトがない');
        $this->assertDoesNotMatchRegularExpression('/<[^>]+\son[a-z]+\s*=/i', $html);
    }

    /**
     * プライバシーポリシーの「端末内で完結するツール」に名前があること
     */
    public function test_privacy_lists_gacha_as_local_tool(): void
    {
        $html = (string) $this->get('/privacy')->assertOk()->getContent();

        $this->assertMatchesRegularExpression('/端末内で完結するツール<\/h3>\s*<p>[^<]*ガチャ天井計算機/u', $html);
    }
}
