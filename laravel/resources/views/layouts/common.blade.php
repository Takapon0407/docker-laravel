<!DOCTYPE HTML>
<html lang="ja">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <!-- responsiveにするために追加 -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- PWA -->
    <meta name="theme-color" content="#55c501"/>
    <link rel="apple-touch-icon" href="{{ asset('tektektech.jpg') }}">
    <link rel="manifest" href="{{ asset('manifest.json') }}">
    <!-- PWA end -->
    <title>てくてくテック</title>
    <!-- cssをインポート -->
    @vite('resources/sass/app.scss')
</head>

<body>
    @include('layouts.header')
    @yield('content')
</body>

</html>
