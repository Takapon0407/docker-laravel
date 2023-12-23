<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Illuminate\Support\Facades\Log;
use Aws\S3\S3Client;

class PhotographController extends Controller
{
    private S3Client $s3Client;

    public function __construct(S3Client $s3Client)
    {
        $this->s3Client = $s3Client;
    }

    /**
     * S3から写真リストを取得し、photographページへ遷移
     */
    public function show(): View
    {
        $disk = Storage::disk('s3');
        $allPhotoObjectKeys = $disk->files('');
        $photosWithUrls = [];

        foreach ($allPhotoObjectKeys as $photoObjectKey) {
            $url = $disk->url($photoObjectKey);
            $meta = $this->s3Client->headObject([
                'Bucket' => env('AWS_BUCKET'),
                'Key'    => $photoObjectKey,
            ]);

            $width = $meta['Metadata']['width'] ?? null;
            $height = $meta['Metadata']['height'] ?? null;
            $orientation = $this->getImageOrientation($width, $height);

            $photosWithUrls[] = [
                'url' => $url,
                'filename' => basename($photoObjectKey),
                'orientation' => $orientation
            ];
        }

        return view('photograph', ['photos' => $photosWithUrls]);
    }

    /**
    * 解像度から画像の構図を判別して返す
    *
    * @param string|null $width  横の解像度
    * @param string|null $height 縦の解像度
    * 
    * @return string 構図情報
    */
    private function getImageOrientation(?string $width, ?string $height)
    {
        // metaデータが付いていない場合は表示をしないためnullを文字列として返す
        if ($width === null || $height === null) {
            return 'null';
        }
    
        $width = (int)$width;
        $height = (int)$height;
    
        if ($width > $height) {
            return 'landscape';
        } elseif ($height > $width) {
            return 'portrait';
        } else {
            return 'square';
        }
    }
    
}
