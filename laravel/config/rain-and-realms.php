<?php

// /works/rain-and-realms に載せる、Rain & Realms のアルバム
// リンクはこのサイト → Rain & Realms の一方向だけにする（Rain & Realms 側にはこのサイトの名前を出さない）
// 音源は再生（.m4a）に加えて、MP3・WAV でダウンロードできる。クレジット（Rain & Realms）を書けば動画や配信の BGM に使えるが、音源そのものの再配布・販売は不可

return [
    'youtube_id' => 's1191DgMU5U',

    // 外部へのリンク（上から順に並べる）。3 時間版・ショートは公開されたら足す
    'links' => [
        ['label' => 'YouTube（1 時間版）', 'url' => 'https://youtu.be/s1191DgMU5U'],
        ['label' => 'Spotify・Apple Music など', 'url' => 'https://distrokid.com/hyperfollow/rainandrealms/rainy-day-in-an-old-japanese-house'],
        ['label' => 'Amazon Music', 'url' => 'https://music.amazon.co.jp/albums/B0HQZN8GDV'],
        ['label' => 'YouTube チャンネル', 'url' => 'https://www.youtube.com/@RainRealmsBGM'],
    ],

    'album' => [
        'title' => 'Rainy Day in an Old Japanese House',
        'subtitle' => '雨の古民家 × ケルト音楽',
        'artist' => 'Rain & Realms',
        'released' => '2026-11-09',
        'cover' => 'images/works/rain-and-realms/cover.jpg',
        // 音源の場所（config('works.media_url') からの相対パス）。再生用の file と同じ名前の .mp3・.wav も置く。
        // ブラウザに長くキャッシュさせるため、中身を差し替えるときはファイル名かフォルダを変える
        'media_path' => 'rain-and-realms/kominka-rain',
        // 曲名は英語と、古語調の日本語。duration は「分:秒」
        'tracks' => [
            ['title_en' => 'First Drops on the Engawa', 'title_ja' => '縁に初雨の落つる', 'duration' => '3:33', 'file' => '01-first-drops-on-the-engawa.m4a'],
            ['title_en' => 'The Old House Breathes', 'title_ja' => '古き家の息づかひ', 'duration' => '3:08', 'file' => '02-the-old-house-breathes.m4a'],
            ['title_en' => 'Ink and Rainfall', 'title_ja' => '墨の香と雨音と', 'duration' => '3:32', 'file' => '03-ink-and-rainfall.m4a'],
            ['title_en' => 'Steam Rising from the Teacup', 'title_ja' => '茶の湯気たちのぼる', 'duration' => '2:58', 'file' => '04-steam-rising-from-the-teacup.m4a'],
            ['title_en' => 'Moss on the Stepping Stones', 'title_ja' => '飛び石の苔', 'duration' => '3:04', 'file' => '05-moss-on-the-stepping-stones.m4a'],
            ['title_en' => 'A Letter Never Sent', 'title_ja' => '宛名なき文', 'duration' => '3:17', 'file' => '06-a-letter-never-sent.m4a'],
            ['title_en' => 'Shoji Light', 'title_ja' => '障子のあかり', 'duration' => '2:51', 'file' => '07-shoji-light.m4a'],
            ['title_en' => 'The Sleeping Cat', 'title_ja' => '眠れる猫', 'duration' => '3:19', 'file' => '08-the-sleeping-cat.m4a'],
            ['title_en' => 'Where the Page Goes', 'title_ja' => '一葉の行方', 'duration' => '3:12', 'file' => '09-where-the-page-goes.m4a'],
            ['title_en' => 'Song of the Rain', 'title_ja' => '雨の唄', 'duration' => '3:20', 'file' => '10-song-of-the-rain.m4a'],
            ['title_en' => 'Wooden Floors, Warm Hands', 'title_ja' => '板の間とあたたかい手', 'duration' => '3:08', 'file' => '11-wooden-floors-warm-hands.m4a'],
            ['title_en' => 'Dusk over the Garden', 'title_ja' => '庭に暮れゆく', 'duration' => '3:23', 'file' => '12-dusk-over-the-garden.m4a'],
            ['title_en' => 'Lantern in the Mist', 'title_ja' => '霧にけぶる灯籠', 'duration' => '3:12', 'file' => '13-lantern-in-the-mist.m4a'],
            ['title_en' => 'A Dream Between Lessons', 'title_ja' => '文机の夢枕', 'duration' => '3:07', 'file' => '14-a-dream-between-lessons.m4a'],
            ['title_en' => 'Tea Gone Cold', 'title_ja' => '湯気の去りし後', 'duration' => '3:22', 'file' => '15-tea-gone-cold.m4a'],
            ['title_en' => 'Whispers of the Eaves', 'title_ja' => '軒のささめき', 'duration' => '3:33', 'file' => '16-whispers-of-the-eaves.m4a'],
            ['title_en' => 'Lamp-lit Pages', 'title_ja' => '灯にうつる書', 'duration' => '3:17', 'file' => '17-lamp-lit-pages.m4a'],
            ['title_en' => 'The Last Raindrops', 'title_ja' => '名残の雨', 'duration' => '3:26', 'file' => '18-the-last-raindrops.m4a'],
            ['title_en' => 'When the Rain Stops', 'title_ja' => '雨やみぬ', 'duration' => '3:30', 'file' => '19-when-the-rain-stops.m4a'],
        ],
    ],
];
