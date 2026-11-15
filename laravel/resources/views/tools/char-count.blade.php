@extends('layouts.common')
@section('title', '文字数カウント')
@section('description', '文章の文字数を、改行・空白を含む／除く、全角・半角、原稿用紙の枚数、X（旧 Twitter）の数え方などでまとめて数えるツールです。目標の文字数まで、あと何文字かも出します。文章はブラウザの中だけで数えます。')
@push('head')
    @vite('resources/ts/laravel/tools/char-count.ts')
@endpush
@section('content')

<div id="notification" class="notification"></div>

{{-- 数えるのはブラウザ内だけ（文章はサーバーに送らず、どこにも保存しない） --}}
<div class="container devtool-container">
    <h1 class="devtool-title font-heading">文字数カウント</h1>
    <p class="devtool-lead">文章を貼り付けると、すぐに数えます。エントリーシートやレポート、SNS の投稿の文字数の確認に。</p>

    <section class="devtool-card">
        <div class="d-flex justify-content-between align-items-end gap-2 mb-2">
            <label class="form-label mb-0" for="count-input">文章</label>
            <div class="d-flex flex-wrap justify-content-end gap-2">
                {{-- 押したときだけ、文章を入れた X の投稿画面を新しいタブで開く（投稿するかどうかは X の画面で決める） --}}
                <button type="button" class="btn btn-dark btn-sm" id="count-post-x" disabled>X に投稿する</button>
                <button type="button" class="btn btn-success btn-sm" data-copy-target="count-input">コピー</button>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="count-clear">消す</button>
            </div>
        </div>
        <textarea class="form-control count-input" id="count-input" rows="10" placeholder="ここに文章を入力するか、貼り付けてください"></textarea>

        <div class="count-target">
            <label for="count-target-value">目標</label>
            <input type="number" class="form-control form-control-sm count-target-value" id="count-target-value" min="1" max="1000000" inputmode="numeric" placeholder="400">
            <span class="me-2">文字</span>
            <label for="count-target-basis">数え方</label>
            <select class="form-select form-select-sm w-auto" id="count-target-basis">
                <option value="withoutNewlines" selected>改行を除く</option>
                <option value="total">改行を含む</option>
                <option value="withoutSpaces">空白・改行を除く</option>
            </select>
        </div>
        <p class="count-target-status" id="count-target-status" aria-live="polite"></p>
        <p class="devtool-help count-x-over" id="count-x-over" hidden>X の上限（280）を超えています。X Premium でなければ、投稿の画面で短くしてから投稿してください。</p>

        <p class="devtool-help mb-0">
            文章はサーバーに送らず、お使いのブラウザの中だけで数えます。保存もしないため、ページを閉じると消えます。<br>
            「X に投稿する」を押したときだけ、文章を X の投稿画面に渡します（すぐには投稿されません）。
        </p>
    </section>

    <section class="devtool-card">
        <h2 class="devtool-heading">結果</h2>
        <dl class="count-stats" id="count-stats">
            <div class="count-stat is-main">
                <dt>文字数（改行を除く）</dt>
                <dd><span id="count-without-newlines">0</span> 文字</dd>
            </div>
            <div class="count-stat">
                <dt>改行を含む</dt>
                <dd><span id="count-total">0</span> 文字</dd>
            </div>
            <div class="count-stat">
                <dt>空白・改行を除く</dt>
                <dd><span id="count-without-spaces">0</span> 文字</dd>
            </div>
            <div class="count-stat">
                <dt>全角 / 半角</dt>
                <dd><span id="count-full-width">0</span> / <span id="count-half-width">0</span> 文字</dd>
            </div>
            <div class="count-stat">
                <dt>行数</dt>
                <dd><span id="count-lines">0</span> 行</dd>
            </div>
            <div class="count-stat">
                <dt>原稿用紙（400 字詰め）</dt>
                <dd><span id="count-manuscript-pages">0</span> 枚（<span id="count-manuscript-lines">0</span> 行）</dd>
            </div>
            <div class="count-stat">
                <dt>X（旧 Twitter）</dt>
                <dd><span id="count-x">0</span> / 280</dd>
            </div>
            <div class="count-stat">
                <dt>バイト数（UTF-8）</dt>
                <dd><span id="count-bytes">0</span> バイト</dd>
            </div>
        </dl>
        <ul class="devtool-help mt-3 mb-0 ps-3">
            <li>絵文字や、濁点を組み合わせた文字も、見た目の 1 文字として数えます。</li>
            <li>半角は、英数字・記号・スペースと半角カタカナです。</li>
            <li>原稿用紙は、改行ごとに新しい行にして 1 行 20 マスで折り返した目安です（字下げや、句読点を行の頭に置かない決まりは数えていません）。</li>
            <li>X は、日本語などの全角の文字を 2、英数字を 1、URL を長さによらず 23 として数えます（上限 280）。</li>
        </ul>
    </section>
</div>

@endsection
