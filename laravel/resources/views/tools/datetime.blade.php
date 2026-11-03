@extends('layouts.common')
@section('title', '日時の変換（UTC / JST）')
@section('description', 'いまの時刻を UTC・JST・UNIX 時間で確認したり、UNIX 時間や ISO 8601 の日時を UTC・JST に変換したりするツールです。入力はブラウザの中だけで処理します。')
@push('head')
    @vite('resources/ts/laravel/tools/datetime.ts')
@endpush
@section('content')

<div id="notification" class="notification"></div>

{{-- 変換はブラウザ内だけで行う（入力内容はサーバーに送らない・保存しない） --}}
<div class="container devtool-container">
    <h1 class="devtool-title font-heading">日時の変換</h1>
    <p class="devtool-lead">UTC・JST・UNIX 時間を、すぐに確かめられます。</p>

    <section class="devtool-card">
        <h2 class="devtool-heading">いまの時刻</h2>
        {{-- 1 秒ごとに書き換える。読み上げが続かないよう aria-live は付けない --}}
        <dl class="devtool-values" id="datetime-now"></dl>
    </section>

    <section class="devtool-card">
        <h2 class="devtool-heading">変換する</h2>
        <label class="form-label" for="datetime-input">日時か UNIX 時間</label>
        <div class="input-group mb-2">
            <input type="text" class="form-control devtool-code" id="datetime-input" spellcheck="false" autocomplete="off"
                placeholder="例: 1793723608 / 2026-11-04T12:00:00Z / 2026-11-04 21:00">
            <button type="button" class="btn btn-outline-success" id="datetime-fill-now">いまの時刻</button>
        </div>
        <fieldset class="mb-2">
            <legend class="devtool-help mb-1">タイムゾーンが書かれていない日時（2026-11-04 21:00 など）は</legend>
            <div class="btn-group" role="group" aria-label="タイムゾーンが書かれていない日時の読み方">
                <input type="radio" class="btn-check" name="datetime-zone" id="datetime-zone-jst" value="jst" checked>
                <label class="btn btn-outline-success btn-sm" for="datetime-zone-jst">JST として読む</label>
                <input type="radio" class="btn-check" name="datetime-zone" id="datetime-zone-utc" value="utc">
                <label class="btn btn-outline-success btn-sm" for="datetime-zone-utc">UTC として読む</label>
            </div>
        </fieldset>
        <p class="devtool-help mb-2" id="datetime-kind" aria-live="polite"></p>
        <p class="devtool-error" id="datetime-error" role="alert" hidden></p>
        <dl class="devtool-values" id="datetime-result"></dl>
    </section>
</div>

@endsection
