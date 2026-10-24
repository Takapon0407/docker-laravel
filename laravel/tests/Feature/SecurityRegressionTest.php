<?php

namespace Tests\Feature;

use Aws\Command;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class SecurityRegressionTest extends TestCase
{
    /**
     * DBを使わない構成のため、雛形の /api/user が公開されていないこと
     *
     * @return void
     */
    public function test_scaffold_api_user_route_is_not_exposed()
    {
        $response = $this->get('/api/user', ['Accept' => 'text/html']);

        $response->assertStatus(404);
    }

    /**
     * /hobbies はS3への問い合わせ結果をキャッシュし、アクセスのたびにS3を呼ばないこと
     *
     * @return void
     */
    public function test_hobbies_caches_s3_metadata_between_requests()
    {
        Storage::fake('s3');
        Storage::disk('s3')->put('a.jpg', 'dummy');
        Storage::disk('s3')->put('b.jpg', 'dummy');

        $s3Client = Mockery::mock(S3Client::class);
        $s3Client->shouldReceive('headObject')
            ->times(2)
            ->andReturn(['Metadata' => ['width' => '200', 'height' => '100']]);
        $this->app->instance(S3Client::class, $s3Client);

        $this->get('/hobbies')->assertStatus(200);
        $this->get('/hobbies')->assertStatus(200);
    }

    /**
     * リクエストの Host ヘッダーではなく APP_URL を基準に URL を生成すること
     *
     * @return void
     */
    public function test_generated_urls_ignore_request_host_header()
    {
        $response = $this->get('http://evil.example/');

        $response->assertStatus(200);
        $response->assertDontSee('evil.example');
        $response->assertSee('https://'.parse_url(config('app.url'), PHP_URL_HOST).'/', false);
    }

    /**
     * 閲覧専用サイトのため、セッションや CSRF トークンの Cookie を発行しないこと
     * （来訪者ごとのセッションファイル作成を防ぎ、CloudFront でキャッシュできるようにする）
     *
     * @return void
     */
    public function test_pages_do_not_set_cookies()
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $this->assertSame([], $response->headers->getCookies());
    }

    /**
     * /hobbies は写真の縦横（正方形を含む）をメタデータから判定して振り分け、メタデータが取れない写真や画像以外のファイルは表示しないこと
     *
     * @return void
     */
    public function test_hobbies_groups_photos_by_orientation_and_skips_unusable_files()
    {
        Storage::fake('s3');
        Storage::disk('s3')->put('wide.jpg', 'dummy');
        Storage::disk('s3')->put('tall.jpg', 'dummy');
        Storage::disk('s3')->put('square.jpg', 'dummy');
        Storage::disk('s3')->put('broken.jpg', 'dummy');
        Storage::disk('s3')->put('readme.txt', 'dummy');

        $s3Client = Mockery::mock(S3Client::class);
        $s3Client->shouldReceive('headObject')
            ->with(Mockery::on(fn (array $args) => $args['Key'] === 'wide.jpg'))
            ->andReturn(['Metadata' => ['width' => '300', 'height' => '200']]);
        $s3Client->shouldReceive('headObject')
            ->with(Mockery::on(fn (array $args) => $args['Key'] === 'tall.jpg'))
            ->andReturn(['Metadata' => ['width' => '200', 'height' => '300']]);
        $s3Client->shouldReceive('headObject')
            ->with(Mockery::on(fn (array $args) => $args['Key'] === 'square.jpg'))
            ->andReturn(['Metadata' => ['width' => '300', 'height' => '300']]);
        $s3Client->shouldReceive('headObject')
            ->with(Mockery::on(fn (array $args) => $args['Key'] === 'broken.jpg'))
            ->andThrow(new S3Exception('Forbidden', new Command('HeadObject')));
        // 画像以外のファイルは S3 にメタデータを問い合わせない
        $s3Client->shouldReceive('headObject')
            ->with(Mockery::on(fn (array $args) => $args['Key'] === 'readme.txt'))
            ->never();
        $this->app->instance(S3Client::class, $s3Client);

        $response = $this->get('/hobbies');

        $response->assertStatus(200);
        // 正方形の写真は横の写真と一緒に表示する
        $response->assertSeeInOrder(['よこのしゃしん', 'alt="square.jpg"', 'たてのしゃしん', 'alt="tall.jpg"'], false);
        $response->assertSeeInOrder(['よこのしゃしん', 'alt="wide.jpg"', 'たてのしゃしん'], false);
        $response->assertDontSee('alt="broken.jpg"', false);
        $response->assertDontSee('readme.txt', false);
    }
}
