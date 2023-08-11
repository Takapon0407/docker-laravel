<!DOCTYPE HTML>
<html lang="ja">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>てくてくテック</title>
        <!-- cssをインポート -->
        @vite('resources/sass/app.scss')
    </head>
    <body>
        @include('layouts.header')
        @yield('content')
        @vite('resources/sass/app.scss')
    </body>
</html>
