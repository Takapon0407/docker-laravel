<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;

abstract class TestCase extends BaseTestCase
{
    /**
     * ツールの一覧で、そのツールへのリンクが、指定した分類（data-purpose / data-storage）のカードの中にあること
     * （順番だけを見ると、別のカードの分類と別のカードのリンクでも通ってしまうため、<li> の直後の <a> で確かめる）
     *
     * @param  TestResponse<Response>  $response
     */
    protected function assertToolCard(TestResponse $response, string $attributes, string $url): void
    {
        $this->assertMatchesRegularExpression(
            '/<li '.preg_quote($attributes, '/').'>\s*<a class="tools-card" href="'.preg_quote($url, '/').'">/',
            (string) $response->getContent(),
        );
    }
}
