<!DOCTYPE HTML>
<html lang="ja">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>Qiita風記事投稿サービス</title>
        <!-- cssをインポート -->
        @vite('resources/sass/app.scss')
    </head>
    <body>
        @include('layouts.header')
        @yield('content')
        @vite('resources/sass/app.scss')
    </body>
</html>
