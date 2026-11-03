@extends('layouts.common')
@section('title', 'JSON 整形')
@section('description', '1 行の JSON をインデント付きで見やすく整形したり、1 行に圧縮したりするツールです。形が正しくないときは何行目の何文字目かを表示します。入力はブラウザの中だけで処理します。')
@push('head')
    @vite('resources/ts/laravel/tools/json.ts')
@endpush
@section('content')

<div id="notification" class="notification"></div>

{{-- 整形はブラウザ内だけで行う（入力内容はサーバーに送らない・保存しない） --}}
<div class="container devtool-container">
    <h1 class="devtool-title font-heading">JSON 整形</h1>
    <p class="devtool-lead">JSON を貼り付けると、すぐに整形します。数値や文字列は書いたとおりのまま並べ直すので、大きな ID の桁も落ちません。</p>

    <section class="devtool-card">
        <div class="devtool-toolbar">
            <div class="btn-group" role="group" aria-label="整形のしかた">
                <input type="radio" class="btn-check" name="json-mode" id="json-mode-pretty" value="pretty" checked>
                <label class="btn btn-outline-success btn-sm" for="json-mode-pretty">整形</label>
                <input type="radio" class="btn-check" name="json-mode" id="json-mode-minify" value="minify">
                <label class="btn btn-outline-success btn-sm" for="json-mode-minify">圧縮（1 行）</label>
            </div>
            <label class="visually-hidden" for="json-indent">インデント</label>
            <select class="form-select form-select-sm w-auto" id="json-indent">
                <option value="2" selected>スペース 2</option>
                <option value="4">スペース 4</option>
                <option value="tab">タブ</option>
            </select>
        </div>

        <label class="form-label" for="json-input">JSON</label>
        <textarea class="form-control devtool-code" id="json-input" spellcheck="false" autocomplete="off"
            placeholder='{"id":1,"name":"たか","tags":["a","b"]}'></textarea>
        <p class="devtool-error" id="json-error" role="alert" hidden></p>
        <button type="button" class="btn btn-outline-secondary btn-sm mt-2" id="json-error-jump" hidden>エラーの場所を選ぶ</button>
    </section>

    <section class="devtool-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="devtool-heading mb-0">結果</h2>
            <button type="button" class="btn btn-success btn-sm" data-copy-target="json-output">コピー</button>
        </div>
        <label class="visually-hidden" for="json-output">整形した JSON</label>
        <textarea class="form-control devtool-code" id="json-output" readonly spellcheck="false"></textarea>
    </section>
</div>

@endsection
