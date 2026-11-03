@extends('layouts.common')
@section('title', '正規表現チェック')
@section('description', '正規表現がテスト用の文字列のどこに一致するかを、色を付けて確かめるツールです。キャプチャグループや置換した結果も表示します。入力はブラウザの中だけで処理します。')
@push('head')
    @vite('resources/ts/laravel/tools/regex.ts')
@endpush
@section('content')

<div id="notification" class="notification"></div>

{{-- 正規表現はブラウザ内（Web Worker）だけで動かす（入力内容はサーバーに送らない・保存しない） --}}
<div class="container devtool-container">
    <h1 class="devtool-title font-heading">正規表現チェック</h1>
    <p class="devtool-lead">JavaScript の正規表現で、一致する場所・キャプチャグループ・置換した結果を確かめられます。</p>

    <section class="devtool-card">
        <label class="form-label" for="regex-pattern">正規表現</label>
        <div class="input-group mb-2">
            <span class="input-group-text devtool-code">/</span>
            <input type="text" class="form-control devtool-code" id="regex-pattern" spellcheck="false" autocomplete="off" placeholder="(\d{4})-(?<month>\d{2})">
            <span class="input-group-text devtool-code" id="regex-flags-view">/g</span>
        </div>
        <fieldset class="devtool-toolbar">
            <legend class="visually-hidden">フラグ</legend>
            @foreach ([
                'g' => 'g（すべて）',
                'i' => 'i（大文字・小文字を区別しない）',
                'm' => 'm（行ごとに ^ $）',
                's' => 's（. が改行にも一致）',
                'u' => 'u（Unicode）',
            ] as $flag => $label)
                <input type="checkbox" class="btn-check" id="regex-flag-{{ $flag }}" value="{{ $flag }}" data-regex-flag @checked($flag === 'g')>
                <label class="btn btn-outline-success btn-sm" for="regex-flag-{{ $flag }}">{{ $label }}</label>
            @endforeach
        </fieldset>
        <p class="devtool-error" id="regex-error" role="alert" hidden></p>

        <label class="form-label mt-2" for="regex-text">テスト用の文字列</label>
        <textarea class="form-control devtool-code" id="regex-text" spellcheck="false" autocomplete="off" placeholder="2026-11 と 2027-01"></textarea>

        <div class="form-check mt-3">
            <input class="form-check-input" type="checkbox" id="regex-replace-enabled">
            <label class="form-check-label" for="regex-replace-enabled">置換も試す</label>
        </div>
        <div id="regex-replace-fields" hidden>
            <label class="form-label mt-2" for="regex-replacement">置換後の文字列（$1・$&lt;name&gt;・$&amp; が使えます）</label>
            <input type="text" class="form-control devtool-code" id="regex-replacement" spellcheck="false" autocomplete="off" placeholder="$<month>/$1">
        </div>
    </section>

    <section class="devtool-card">
        <h2 class="devtool-heading" id="regex-summary" aria-live="polite">一致</h2>
        <pre class="devtool-highlight devtool-code" id="regex-highlight"></pre>
        <div class="devtool-matches mt-3">
            <table class="table table-sm mb-0">
                <thead>
                    <tr><th scope="col">#</th><th scope="col">位置</th><th scope="col">一致した文字列</th><th scope="col">グループ</th></tr>
                </thead>
                <tbody id="regex-matches"></tbody>
            </table>
        </div>
    </section>

    <section class="devtool-card" id="regex-replaced-card" hidden>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="devtool-heading mb-0">置換した結果</h2>
            <button type="button" class="btn btn-success btn-sm" data-copy-target="regex-replaced">コピー</button>
        </div>
        <pre class="devtool-highlight devtool-code" id="regex-replaced"></pre>
    </section>
</div>

@endsection
