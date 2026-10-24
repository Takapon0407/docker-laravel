<!DOCTYPE HTML>
<html lang="ja">

<head>
    @php
        $siteName = 'てくてくテック';
        $pageTitle = View::hasSection('title') ? View::yieldContent('title').' | '.$siteName : $siteName;
        $description = View::yieldContent('description', 'Webエンジニア・たかぽんのポートフォリオサイトです。');
    @endphp
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $pageTitle }}</title>
    <meta name="description" content="{{ $description }}">
    <link rel="canonical" href="{{ url()->current() }}">
    {{-- SNS で共有されたときの表示（OGP） --}}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ $siteName }}">
    <meta property="og:title" content="{{ $pageTitle }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ url()->current() }}">
    <meta property="og:image" content="{{ asset('tektektech.jpg') }}">
    <meta property="og:locale" content="ja_JP">
    <meta name="twitter:card" content="summary">
    {{-- PWA --}}
    <meta name="theme-color" content="#55c501"/>
    <link rel="apple-touch-icon" href="{{ asset('icons/apple-touch-icon.png') }}">
    <link rel="manifest" href="{{ asset('manifest.json') }}">
    {{-- 見出しのフォント（Cherry Bomb One） --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap" rel="stylesheet">
    @vite(['resources/sass/app.scss', 'resources/ts/laravel/util/header.ts'])
    {{-- ページごとの CSS / JS は @push('head') で追加する --}}
    @stack('head')
</head>

<body>
    @include('layouts.header')
    @yield('content')
</body>

</html>
