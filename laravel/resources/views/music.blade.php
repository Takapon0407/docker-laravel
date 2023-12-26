@extends('layouts.common')
@section('content')
@vite('resources/ts/laravel/profile.ts')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap" rel="stylesheet">

<div id="notification" class="notification"></div>

<div class="container">

    <div class="content-box">
        <h2 class="font-cherry">このページはこうじちゅうです！！！</h2>
    </div>

    <div class="content-box">
        <h2 class="font-cherry">れんしゅうちゅう</h2>
        <div class="sub-content">
            れんしゅうちゅうの曲のyoutubuかなんか貼る
        </div>
    </div>

    <div class="content-box">
        <h2 class="font-cherry">つくったもの</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">EDM</h3>
                <ul>
                    <li>SoundCloudか、S3の音楽ファイルをここにまとめたい...!</li>
                </ul>
                <h3 class="font-cherry">Guitar</h3>
                <ul>
                    <li>SoundCloudか、S3の音楽ファイルをここにまとめたい...!</li>
                </ul>
            </div>
        </div>
    </div>
    <div class="content-box">
        <h2 class="font-cherry">スキルスタック</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">がっき</h3>
                <ul>
                    <li>ピアノ</li>
                    <li>エレキギター</li>
                    <li>アコースティックギター</li>
                    <li>カリンバ</li>
                </ul>
            </div>
            <div class="sub-right-content">
                <h3 class="font-cherry">DAW</h3>
                <ul>
                    <li>Cubase 9</li>
                    <li>Logic Pro</li>
                </ul>
            </div>
        </div>
    </div>
</div>
@endsection
