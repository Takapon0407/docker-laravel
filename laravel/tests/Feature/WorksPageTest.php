<?php

namespace Tests\Feature;

use App\Http\Controllers\WorksController;
use Tests\TestCase;

class WorksPageTest extends TestCase
{
    /**
     * ヘッダーから作品の一覧へ、一覧から Rain & Realms のページへたどれること
     */
    public function test_works_index_links_to_rain_and_realms(): void
    {
        $response = $this->get('/works');

        $response->assertOk();
        $response->assertSee('<title>作品 | てくてくテック</title>', false);
        $response->assertSee('<link rel="canonical" href="'.url('/works').'">', false);
        $response->assertSee('href="'.route('works.index').'"', false);
        $response->assertSee('href="'.route('works.rain-and-realms').'"', false);
    }

    /**
     * アルバムの全曲を、ページを開いただけでは読み込まないプレーヤーに並べること
     */
    public function test_rain_and_realms_lists_all_tracks_without_preloading(): void
    {
        $response = $this->get('/works/rain-and-realms');

        $response->assertOk();
        $response->assertSee('<title>Rain &amp; Realms | てくてくテック</title>', false);
        $response->assertSee('<meta property="og:image" content="'.asset('images/works/rain-and-realms/cover.jpg').'">', false);
        // 曲の長さの合計（61 分 51 秒）を四捨五入する
        $response->assertSee('19 曲・約 62 分', false);
        // 押すまで音源を取りに行かない
        $response->assertSee('<audio id="album-audio" preload="none"></audio>', false);
        $response->assertSee('data-src="/media/rain-and-realms/kominka-rain/01-first-drops-on-the-engawa.m4a"', false);
        $response->assertSee('data-src="/media/rain-and-realms/kominka-rain/19-when-the-rain-stops.m4a"', false);
        $response->assertSee('縁に初雨の落つる');
        $response->assertSee('When the Rain Stops');
        // 再生できなかったときに、ほかで聴ける場所を案内する
        $response->assertSee('id="album-unavailable"', false);
        $response->assertSee('id="album-links"', false);
    }

    /**
     * 音源の置き場所を設定で変えられること（R2 などに移すとき）。CSP もその配信元を許可する
     */
    public function test_media_url_can_be_moved_to_another_origin(): void
    {
        config(['works.media_url' => 'https://media.example.com']);

        $response = $this->get('/works/rain-and-realms');

        $response->assertSee('data-src="https://media.example.com/rain-and-realms/kominka-rain/01-first-drops-on-the-engawa.m4a"', false);
        $this->assertStringContainsString("media-src 'self' https://media.example.com;", (string) $response->headers->get('Content-Security-Policy'));
    }

    /**
     * 既定以外のポートの配信元は、ポートも含めて CSP で許可すること（落とすと音源がブロックされる）
     */
    public function test_media_origin_keeps_port(): void
    {
        config(['works.media_url' => 'https://media.example.com:8443/files']);

        $response = $this->get('/works/rain-and-realms');

        $this->assertStringContainsString("media-src 'self' https://media.example.com:8443;", (string) $response->headers->get('Content-Security-Policy'));
    }

    /**
     * YouTube は押すまで読み込まず、外部へのリンクは参照元を送らないこと（Rain & Realms 側にこのサイトを出さない）
     */
    public function test_youtube_is_loaded_on_demand_and_links_hide_referrer(): void
    {
        $response = $this->get('/works/rain-and-realms');

        $response->assertDontSee('<iframe', false);
        $response->assertSee('data-youtube-id="s1191DgMU5U"', false);
        $this->assertStringContainsString('frame-src \'self\' https://www.youtube-nocookie.com', (string) $response->headers->get('Content-Security-Policy'));

        $content = (string) $response->getContent();
        preg_match_all('/<a [^>]*href="https:\/\/[^"]*"[^>]*>/', $content, $matches);
        $external = array_filter($matches[0], fn (string $tag): bool => str_contains($tag, 'distrokid.com') || str_contains($tag, 'youtu'));
        $this->assertNotEmpty($external);
        foreach ($external as $tag) {
            $this->assertStringContainsString('rel="noopener noreferrer"', $tag);
        }

        // 曲は AI で生成しているため、「作曲した」とは書かない
        $response->assertDontSee('作曲');
    }

    public function test_seconds_of_duration(): void
    {
        $this->assertSame(213, WorksController::secondsOf('3:33'));
        $this->assertSame(3723, WorksController::secondsOf('1:02:03'));
        $this->assertNull(WorksController::secondsOf('3:75'));
        $this->assertNull(WorksController::secondsOf('3:5'));
        $this->assertNull(WorksController::secondsOf(''));
    }

    /**
     * 設定の曲の長さがすべて読めること（書き間違えると、合計の分数が黙って少なくなるため）
     */
    public function test_all_track_durations_are_readable(): void
    {
        $tracks = config()->array('rain-and-realms.album.tracks');
        $this->assertNotEmpty($tracks);
        foreach ($tracks as $track) {
            $this->assertIsArray($track);
            $duration = $track['duration'] ?? null;
            $this->assertIsString($duration);
            $this->assertNotNull(WorksController::secondsOf($duration), "曲の長さ「{$duration}」が読めない");
        }
    }
}
