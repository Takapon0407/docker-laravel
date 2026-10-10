<?php

namespace App\Providers;

use Aws\S3\S3Client;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\App;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        $this->app->singleton(S3Client::class, function ($app) {
            $config = [
                'version' => 'latest',
                'region'  => config('filesystems.disks.s3.region'),
                'http' => [
                    'connect_timeout' => 3,
                    'timeout'         => 10,
                ],
            ];

            // キー未設定時はSDKの既定の認証情報チェーン（EC2のIAMロール等）を使う
            $key = config('filesystems.disks.s3.key');
            $secret = config('filesystems.disks.s3.secret');
            if (! empty($key) && ! empty($secret)) {
                $config['credentials'] = ['key' => $key, 'secret' => $secret];
            }

            return new S3Client($config);
        });
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        if ($this->app->environment('local')) {
            URL::forceScheme('http');
        } else {
            URL::forceScheme('https');
            // リクエストのHostヘッダーではなくAPP_URLを基準にURLを生成する
            URL::forceRootUrl(config('app.url'));
        }
    }
}
