@extends('layouts.common')
@section('title', 'ガチャ天井計算機')
@section('description', '確率・すり抜け・天井（ソフト天井）・交換までの回数を入れると、ガチャで狙いが手に入るまでの平均の回数と金額、運が悪いときの回数、予算で手に入る確率を計算します。入力はブラウザの中だけで処理し、サーバーには送りません。')
@push('head')
    @vite('resources/ts/laravel/tools/gacha.ts')
@endpush
@section('content')

{{-- 計算はブラウザ内だけで行う（入力はサーバーに送らず、どこにも保存しない） --}}
<div class="container devtool-container gacha-container">
    <h1 class="devtool-title font-heading">ガチャ天井計算機</h1>
    <p class="devtool-lead">確率・すり抜け・天井を入れると、狙いの 1 体が手に入るまでの回数と金額、予算で手に入る確率を計算します。</p>

    <noscript>
        <p class="devtool-card gacha-noscript">このツールは JavaScript を使います。ブラウザの設定で JavaScript を有効にしてください。</p>
    </noscript>
</div>
@endsection
