@extends('layouts.common')
@section('title', 'QR コード作成')
@section('description', 'URL や文章、Wi-Fi の設定から QR コードを作るツールです。読み取りやすさ（誤り訂正）を選んで、PNG か SVG で保存できます。QR コードはブラウザの中だけで作り、サーバーには送りません。')
@push('head')
    @vite('resources/ts/laravel/tools/qr.ts')
@endpush
@section('content')

{{-- QR コードはブラウザ内だけで作る（入力・Wi-Fi のパスワードはサーバーに送らず、どこにも保存しない） --}}
<div class="container devtool-container">
    <h1 class="devtool-title font-heading">QR コード作成</h1>
    <p class="devtool-lead">URL や文章、Wi-Fi の設定を入れると、すぐに QR コードを作ります。チラシや名刺、スライド、来客用の Wi-Fi の案内に。</p>

    <section class="devtool-card">
        <div class="btn-group mb-3" role="group" aria-label="QR コードにするもの">
            <input type="radio" class="btn-check" name="qr-mode" id="qr-mode-text" value="text" checked>
            <label class="btn btn-outline-success btn-sm" for="qr-mode-text">URL・文章</label>
            <input type="radio" class="btn-check" name="qr-mode" id="qr-mode-wifi" value="wifi">
            <label class="btn btn-outline-success btn-sm" for="qr-mode-wifi">Wi-Fi</label>
        </div>

        <div id="qr-text-fields">
            <label class="form-label" for="qr-input">URL・文章</label>
            <textarea class="form-control" id="qr-input" rows="3" spellcheck="false" autocomplete="off" placeholder="https://example.com/"></textarea>
        </div>

        {{-- 読み取ったスマホが、このネットワークにつなぐか尋ねる --}}
        <div class="qr-wifi" id="qr-wifi-fields" hidden>
            <div>
                <label class="form-label" for="qr-wifi-ssid">ネットワーク名（SSID）</label>
                <input type="text" class="form-control" id="qr-wifi-ssid" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="MyHome-5G">
            </div>
            <div>
                <label class="form-label" for="qr-wifi-password">パスワード</label>
                <div class="input-group">
                    <input type="password" class="form-control" id="qr-wifi-password" spellcheck="false" autocomplete="off" autocapitalize="off">
                    <button type="button" class="btn btn-outline-secondary" id="qr-wifi-password-toggle" aria-controls="qr-wifi-password" aria-pressed="false">表示</button>
                </div>
            </div>
            <div>
                <label class="form-label" for="qr-wifi-security">セキュリティ</label>
                <select class="form-select" id="qr-wifi-security">
                    <option value="WPA" selected>WPA / WPA2 / WPA3（ふつうはこれ）</option>
                    <option value="WEP">WEP（古い方式）</option>
                    <option value="nopass">なし（パスワードなし）</option>
                </select>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="qr-wifi-hidden">
                <label class="form-check-label" for="qr-wifi-hidden" aria-describedby="qr-wifi-hidden-help">ネットワーク名を隠している（ステルス）</label>
                <p class="devtool-help mb-0" id="qr-wifi-hidden-help">スマホの Wi-Fi の一覧に名前が出てこず、名前を手で入れてつないだネットワークのときだけ選びます。わからなければ、選ばなくて大丈夫です。</p>
            </div>
            <p class="devtool-help mb-0">ネットワーク名とパスワードは、ルーターの側面や底のシールに書いてあることが多いです。</p>
        </div>

        <p class="devtool-error" id="qr-error" role="alert" hidden></p>

        <fieldset class="mt-3">
            <legend class="form-label fs-6 mb-1">読み取りやすさ（誤り訂正）</legend>
            <div class="btn-group" role="group">
                <input type="radio" class="btn-check" name="qr-ecc" id="qr-ecc-l" value="L">
                <label class="btn btn-outline-success btn-sm" for="qr-ecc-l">低（7%）</label>
                <input type="radio" class="btn-check" name="qr-ecc" id="qr-ecc-m" value="M" checked>
                <label class="btn btn-outline-success btn-sm" for="qr-ecc-m">標準（15%）</label>
                <input type="radio" class="btn-check" name="qr-ecc" id="qr-ecc-q" value="Q">
                <label class="btn btn-outline-success btn-sm" for="qr-ecc-q">高（25%）</label>
                <input type="radio" class="btn-check" name="qr-ecc" id="qr-ecc-h" value="H">
                <label class="btn btn-outline-success btn-sm" for="qr-ecc-h">最高（30%）</label>
            </div>
            <p class="devtool-help mt-1 mb-0">汚れや欠けがあっても読めるかどうかです。上げるとマスが細かくなります。印刷して外に貼るなら「高」が安心です。</p>
        </fieldset>

        <p class="devtool-help mt-3 mb-0">入力した内容（Wi-Fi のパスワードも）はサーバーに送らず、お使いのブラウザの中だけで QR コードにします。保存もしません。</p>
    </section>

    <section class="devtool-card">
        <h2 class="devtool-heading">QR コード</h2>
        <div class="qr-preview">
            <svg class="qr-image" id="qr-image" role="img" aria-label="QR コード" hidden></svg>
            <p class="qr-empty" id="qr-empty">URL や文章を入れると、ここに表示します</p>
        </div>
        <p class="devtool-help text-center mt-2 mb-3" id="qr-info"></p>

        <div class="qr-save">
            <label class="visually-hidden" for="qr-png-size">PNG の大きさ</label>
            <select class="form-select form-select-sm w-auto" id="qr-png-size">
                <option value="300">小（約 300px）</option>
                <option value="600" selected>中（約 600px）</option>
                <option value="1200">大（約 1200px）</option>
            </select>
            <button type="button" class="btn btn-success btn-sm" id="qr-save-png" disabled>PNG で保存</button>
            <button type="button" class="btn btn-outline-success btn-sm" id="qr-save-svg" disabled>SVG で保存</button>
        </div>
        <p class="devtool-help mt-3 mb-0">SVG は、拡大してもぼやけないので印刷に向いています。使う前に、スマホのカメラで読み取れるか確かめてください。</p>
        <p class="devtool-help mt-1 mb-0" id="qr-wifi-note" hidden>Wi-Fi の QR コードは、iPhone（iOS 11 以降）と Android（10 以降）のカメラで読み取ると、つなぐか尋ねられます。パスワードを知られたくない場所には貼らないでください。</p>
    </section>

    <p class="devtool-help text-center mb-0">QR コードは株式会社デンソーウェーブの登録商標です。</p>
</div>

@endsection
