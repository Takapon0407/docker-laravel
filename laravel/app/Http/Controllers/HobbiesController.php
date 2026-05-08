<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Aws\S3\S3Client;

class HobbiesController extends Controller
{
    private S3Client $s3Client;

    public function __construct(S3Client $s3Client)
    {
        $this->s3Client = $s3Client;
    }

    public function show(): View
    {
        $disk = Storage::disk('s3');
        $allPhotoObjectKeys = $disk->files('');
        $photosWithUrls = [];

        foreach ($allPhotoObjectKeys as $photoObjectKey) {
            $url = $disk->url($photoObjectKey);
            $meta = $this->s3Client->headObject([
                'Bucket' => config('filesystems.disks.s3.bucket'),
                'Key'    => $photoObjectKey,
            ]);

            $width = $meta['Metadata']['width'] ?? null;
            $height = $meta['Metadata']['height'] ?? null;
            $orientation = $this->getImageOrientation($width, $height);

            $photosWithUrls[] = [
                'url'         => $url,
                'filename'    => basename($photoObjectKey),
                'orientation' => $orientation,
            ];
        }

        return view('hobbies', ['photos' => $photosWithUrls]);
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
