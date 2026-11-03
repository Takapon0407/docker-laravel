<?php

// /tools に表示する便利ツールの一覧（表示と絞り込みはビュー側で行う。並び順もこの順）
// purpose：general = 一般向け / dev = 開発向け
// storage：local = 入力はブラウザの中だけ（端末内で完結） / server = サーバーに送って保存する
// storage_note はデータの扱いの説明（カードの下に出す）。enabled_by は表示する条件にする設定のキー

return [
    [
        'route' => 'tools.warikan',
        'title' => '割り勘計算',
        'description' => '合計金額と人数から、1 人あたりの金額を計算します。先輩・後輩などグループごとの比率や、固定額の人、1 人ずつ金額を決める割り方にも対応しています。',
        'purpose' => 'general',
        'storage' => 'local',
        'storage_note' => '計算はブラウザの中だけで行います',
    ],
    [
        'route' => 'tools.board',
        'title' => '匿名質問ボード',
        'description' => '勉強会などで使える、匿名の質問・コメントボードです。ルームを作って URL や QR コードを配ると、参加者がその場で投稿できます。',
        'purpose' => 'general',
        'storage' => 'server',
        'storage_note' => '投稿はルームの保存期間（最長 30 日）が過ぎると自動で消えます',
        'enabled_by' => 'board.enabled',
    ],
    [
        'route' => 'tools.lifespan',
        'title' => '寿命の計算',
        'description' => '誕生日を入れると、日本と世界の平均寿命を迎える日と、そこまでの残りの年・日・時間・分・秒を計算します。出典の統計も載せています。',
        'purpose' => 'general',
        'storage' => 'local',
        'storage_note' => '誕生日はブラウザの中だけで計算に使います。「この端末に覚える」を選んだときだけ、ブラウザに残します',
    ],
    [
        'route' => 'tools.countdown',
        'title' => 'カウントダウン',
        'description' => '今年の残り時間と、これから 1 年の祝日や、自分で決めた記念日などまで、あと何日かを表示します。',
        'purpose' => 'general',
        'storage' => 'local',
        'storage_note' => '自分で足した日は、ブラウザの中にだけ残します',
    ],
    [
        'route' => 'tools.json',
        'title' => 'JSON 整形',
        'description' => '1 行の JSON をインデント付きで見やすく整形したり、1 行に圧縮したりします。形が正しくないときは、何行目の何文字目かを表示します。',
        'purpose' => 'dev',
        'storage' => 'local',
        'storage_note' => '整形はブラウザの中だけで行います',
    ],
    [
        'route' => 'tools.datetime',
        'title' => '日時の変換',
        'description' => 'いまの時刻を UTC・JST・UNIX 時間で確かめたり、UNIX 時間や ISO 8601 の日時を UTC・JST に変換したりします。',
        'purpose' => 'dev',
        'storage' => 'local',
        'storage_note' => '変換はブラウザの中だけで行います',
    ],
    [
        'route' => 'tools.regex',
        'title' => '正規表現チェック',
        'description' => '正規表現がテスト用の文字列のどこに一致するかを、色を付けて確かめます。キャプチャグループや置換した結果も表示します。',
        'purpose' => 'dev',
        'storage' => 'local',
        'storage_note' => '正規表現はブラウザの中だけで動かします',
    ],
];
