<?php

namespace Tests\Feature;

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
}
