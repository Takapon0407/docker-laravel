<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Illuminate\Support\Facades\Log;
use Aws\S3\S3Client;

class PhotographController extends Controller
{
    /**
     * S3から写真リストを取得し、photographページへ遷移
     */
    public function show(): View
    {
        $s3Client = new S3Client([
            'version' => 'latest',
            'region'  => env('AWS_DEFAULT_REGION'),
            'credentials' => [
                'key'    => env('AWS_ACCESS_KEY_ID'),
                'secret' => env('AWS_SECRET_ACCESS_KEY'),
            ],
        ]);

        $disk = Storage::disk('s3');
        $allFiles = $disk->files('');
        $filesWithUrls = [];

        foreach ($allFiles as $file) {
            $url = $disk->url($file);
            $meta = $s3Client->headObject([
                'Bucket' => env('AWS_BUCKET'),
                'Key'    => $file,
            ]);

            $width = $meta['Metadata']['width'] ?? null;
            $height = $meta['Metadata']['height'] ?? null;
            $orientation = $this->getImageOrientation($width, $height);

            $filesWithUrls[] = [
                'url' => $url,
                'filename' => basename($file),
                'orientation' => $orientation
            ];
        }

        return view('photograph', ['files' => $filesWithUrls]);
    }

    private function getImageOrientation($width, $height)
    {
        // metaデータが付いていない場合は表示をしないためnullを文字列として返す
        if ($width === null || $height === null) {
            return 'null';
        }

        if ($width > $height) {
            return 'landscape';
        } elseif ($height > $width) {
            return 'portrait';
        } else {
            return 'square';
        }
    }
}
