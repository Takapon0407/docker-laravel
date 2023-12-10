<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Illuminate\Support\Facades\Log;

class PhotographController extends Controller
{
    /**
     * S3から写真リストを取得し、photographページへ遷移
     */
    public function show(): View
    {
        $disk = Storage::disk('s3');
        $allFiles = $disk->files('');
        $filesWithUrls = [];

        foreach ($allFiles as $file) {
            $imageContent = $disk->get($file);

            // 一時的にlocalへ保存し、縦横の解像度を取得
            $tempPath = tempnam(sys_get_temp_dir(), 'image');
            file_put_contents($tempPath, $imageContent);
            [$width, $height] = getimagesize($tempPath);
            unlink($tempPath);

            // 縦構図か横構図か判定
            $orientation = $width > $height ? 'landscape' : 'portrait';

            $filesWithUrls[] = [
                'url' => $disk->url($file),
                'filename' => basename($file),
                'orientation' => $orientation
            ];
        }

        return view('photograph', ['files' => $filesWithUrls]);
    }
}
