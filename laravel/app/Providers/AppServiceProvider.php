<?php

namespace App\Providers;

use Aws\S3\S3Client;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // 認証情報（キー未設定時は EC2 の IAM ロール等）・タイムアウトは config/filesystems.php の s3 ディスクの設定を使う
        $this->app->singleton(S3Client::class, function (): S3Client {
            $disk = Storage::disk('s3');
            assert($disk instanceof AwsS3V3Adapter);

            return $disk->getClient();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (! $this->app->environment('local')) {
            URL::forceScheme('https');
            // リクエストのHostヘッダーではなくAPP_URLを基準にURLを生成する
            URL::forceRootUrl(config('app.url'));
        }
    }
}
