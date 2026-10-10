<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;

class HobbiesController extends Controller
{
    private S3Client $s3Client;

    public function __construct(S3Client $s3Client)
    {
        $this->s3Client = $s3Client;
    }

    // S3への問い合わせはアクセスごとではなく、この間隔で1回だけ行う
    private const PHOTOS_CACHE_TTL_SECONDS = 3600;

    public function show(): View
    {
        $photosWithUrls = Cache::remember(
            'hobbies.photos',
            self::PHOTOS_CACHE_TTL_SECONDS,
            fn (): array => $this->fetchPhotos()
        );

        return view('hobbies', ['photos' => $photosWithUrls]);
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

        $width  = (int) $width;
        $height = (int) $height;

        if ($width > $height) {
            return 'landscape';
        } elseif ($height > $width) {
            return 'portrait';
        } else {
            return 'square';
        }
    }
}
