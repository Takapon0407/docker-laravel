<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;

class HobbiesController extends Controller
{
    // S3への問い合わせはアクセスごとではなく、この間隔で1回だけ行う
    private const PHOTOS_CACHE_FRESH_SECONDS = 3600;
    // 期限切れ後もこの時間までは古い結果を返し、更新はレスポンス後にバックグラウンドで1回だけ行う
    // （期限切れの瞬間に複数のリクエストが同時にS3を呼ぶのを防ぐ。S3障害時も古い結果で表示を続ける）
    private const PHOTOS_CACHE_STALE_SECONDS = 86400;

    public function __construct(private S3Client $s3Client)
    {
    }

    public function show(): View
    {
        $photosWithUrls = Cache::flexible(
            'hobbies.photos',
            [self::PHOTOS_CACHE_FRESH_SECONDS, self::PHOTOS_CACHE_STALE_SECONDS],
            fn (): array => $this->fetchPhotos()
        );

        return view('hobbies', [
            'photos' => $photosWithUrls,
            'playingGames' => config('hobbies.playing_games'),
            'pastGames' => config('hobbies.past_games'),
        ]);
    }

    /**
     * @return array<int, array{url: string, filename: string, orientation: string}>
     */
    private function fetchPhotos(): array
    {
        $disk = Storage::disk('s3');
        $allPhotoObjectKeys = $disk->files('');
        $photosWithUrls = [];

        foreach ($allPhotoObjectKeys as $photoObjectKey) {
            $url = $disk->url($photoObjectKey);

            try {
                $meta = $this->s3Client->headObject([
                    'Bucket' => config('filesystems.disks.s3.bucket'),
                    'Key'    => $photoObjectKey,
                ]);
                $width = $meta['Metadata']['width'] ?? null;
                $height = $meta['Metadata']['height'] ?? null;
            } catch (S3Exception $e) {
                // メタデータが取れなくてもページ全体はエラーにしない
                report($e);
                $width = null;
                $height = null;
            }

            $photosWithUrls[] = [
                'url'         => $url,
                'filename'    => basename($photoObjectKey),
                'orientation' => $this->getImageOrientation($width, $height),
            ];
        }

        return $photosWithUrls;
    }

    private function getImageOrientation(?string $width, ?string $height): string
    {
        if ($width === null || $height === null) {
            return 'null';
        }

        return match ((int) $width <=> (int) $height) {
            1  => 'landscape',
            -1 => 'portrait',
            0  => 'square',
        };
    }
}
