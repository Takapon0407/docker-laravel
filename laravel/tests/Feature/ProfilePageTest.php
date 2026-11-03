<?php

namespace Tests\Feature;

use Tests\TestCase;

class ProfilePageTest extends TestCase
{
    /**
     * クエリなしでは、スキルスタック・略歴・資格を HTML に出さない（説明文でも触れない）
     */
    public function test_top_page_hides_career_without_query(): void
    {
        foreach (['/', '/?for=other', '/?for[]=recruit'] as $url) {
            $response = $this->get($url);

            $response->assertOk();
            $response->assertSee('だれ？');
            $response->assertDontSee('すきるすたっく');
            $response->assertDontSee('りゃくれき');
            $response->assertDontSee('AWS SAP');
            $response->assertDontSee('スキルスタック');
            $response->assertDontSee('<meta name="robots"', false);
        }
    }

    /**
     * 就活用のクエリが付いたときだけ出し、その表示は検索結果に出さない
     */
    public function test_top_page_shows_career_with_query(): void
    {
        $response = $this->get('/?for=recruit');

        $response->assertOk();
        $response->assertSee('すきるすたっく');
        $response->assertSee('りゃくれき');
        $response->assertSee('AWS SAP');
        $response->assertSee('<meta name="description" content="Laravel・React・AWSを中心にWebサービスを開発しているエンジニア、たかぽんのポートフォリオです。スキルスタック・略歴・資格', false);
        $response->assertSee('<meta name="robots" content="noindex">', false);
        $response->assertSee('<link rel="canonical" href="'.url('/').'">', false);
    }
}
