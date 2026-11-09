<?php

// /works に並べる作品の一覧（並び順もこの順）。作品ごとのデータは作品の設定ファイル（config/rain-and-realms.php など）に置く

return [
    // 音源などの大きいファイルの置き場所（URL の頭。末尾の / なし）
    // 本番は同じドメインの /media（CloudFront の /media/* → S3。infra/media）。
    // ローカルでは laravel/public/media に置いたファイルを nginx が返す（git には入れない）
    // 別の場所（R2 など）に移すときは、ファイルをコピーしてここを変える。
    // 別のドメイン・サービスから配信するようになったら、プライバシーポリシー（privacy.blade.php の「このサイトのサーバーから配信」）も直す
    'media_url' => rtrim((string) env('WORKS_MEDIA_URL', '/media'), '/'),

    'list' => [
        [
            'route' => 'works.rain-and-realms',
            'title' => 'Rain & Realms',
            'subtitle' => 'AI で作る作業用 BGM のチャンネル',
            'description' => '雨の古民家で勉強する女の子の映像と、ケルト音楽の作業用 BGM。AI で生成した曲と映像を選び、後処理・長時間の動画づくり・配信までを 1 人で仕組みにしました。',
            'image' => 'images/works/rain-and-realms/cover.jpg',
            'tags' => ['Python', 'OpenCV', 'ffmpeg', '生成 AI'],
        ],
    ],
];
