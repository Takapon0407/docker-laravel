<?php

namespace App\Http\Controllers;

use App\Enums\Orientation;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class HobbiesController extends Controller
{
    private const PHOTOS_CACHE_KEY = 'hobbies.photos';

    // S3への問い合わせはアクセスごとではなく、この間隔で1回だけ行う
    private const PHOTOS_CACHE_FRESH_SECONDS = 3600;

    // 期限切れ後もこの時間までは古い結果を返し、更新はレスポンス後にバックグラウンドで1回だけ行う
    // （期限切れの瞬間に複数のリクエストが同時にS3を呼ぶのを防ぐ。S3障害時も古い結果で表示を続ける）
    private const PHOTOS_CACHE_STALE_SECONDS = 86400;

    // バケットに画像以外のファイルが置かれても表示しない
    private const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    public function __construct(private S3Client $s3Client) {}

    public function show(): View
    {
        $photos = collect(Cache::flexible(
            self::PHOTOS_CACHE_KEY,
            [self::PHOTOS_CACHE_FRESH_SECONDS, self::PHOTOS_CACHE_STALE_SECONDS],
            fn (): array => $this->fetchPhotos()
        ));
        $photosOf = fn (Orientation ...$orientations): array => $photos
            ->filter(fn (array $photo): bool => in_array(Orientation::tryFrom($photo['orientation'] ?? ''), $orientations, true))
            ->values()
            ->all();

        return view('hobbies', [
            // 正方形の写真も横長のスライダーに収まるため、横の写真と一緒に表示する
            'landscapePhotos' => $photosOf(Orientation::Landscape, Orientation::Square),
            'portraitPhotos' => $photosOf(Orientation::Portrait),
            'playingGames' => config('hobbies.playing_games'),
            'pastGames' => config('hobbies.past_games'),
        ]);
    }

    /**
     * キャッシュ（オブジェクトを保存しない設定）に入れるため、向きは Orientation の値（文字列）で持つ
     * メタデータが取れなかった写真の向きは null（表示しない）
     *
     * @return array<int, array{url: string, filename: string, orientation: ?string}>
     */
    private function fetchPhotos(): array
    {
        $disk = Storage::disk('s3');
        $bucket = config()->string('filesystems.disks.s3.bucket');
        $keys = array_filter(
            $disk->files(''),
            fn (string $key): bool => in_array(strtolower(pathinfo($key, PATHINFO_EXTENSION)), self::PHOTO_EXTENSIONS, true)
        );

        $photos = [];
        foreach ($keys as $key) {
            $photos[] = [
                'url' => $disk->url($key),
                'filename' => basename($key),
                'orientation' => $this->detectOrientation($bucket, $key)?->value,
            ];
        }

        return $photos;
    }

    private function detectOrientation(string $bucket, string $key): ?Orientation
    {
        try {
            $meta = $this->s3Client->headObject(['Bucket' => $bucket, 'Key' => $key]);
        } catch (S3Exception $e) {
            // メタデータが取れなくてもページ全体はエラーにしない
            report($e);

            return null;
        }

        // 幅・高さは S3 への PUT 時に Lambda がメタデータとして付加している
        $metadata = $meta['Metadata'] ?? null;
        $width = is_array($metadata) ? $metadata['width'] ?? null : null;
        $height = is_array($metadata) ? $metadata['height'] ?? null : null;
        if (! is_numeric($width) || ! is_numeric($height)) {
            return null;
        }

        return Orientation::fromSize((int) $width, (int) $height);
    }
}
