@extends('layouts.common')
@section('title', 'テキスト差分')
@section('description', '2 つの文章を比べて、追加・削除した行を色分けし、変わった行の中は文字単位で印を付けるツールです。空白の違いを無視したり、変わったところの前後だけを表示したりできます。入力はブラウザの中だけで比べます。')
@push('head')
    @vite('resources/ts/laravel/tools/diff.ts')
@endpush
@section('content')

{{-- 比較はブラウザ内だけで行う（入力内容はサーバーに送らない・保存しない） --}}
<div class="container devtool-container diff-container">
    <h1 class="devtool-title font-heading">テキスト差分</h1>
    <p class="devtool-lead">変更前と変更後の文章を貼り付けると、すぐに違いを表示します。</p>

    <section class="devtool-card">
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label" for="diff-old">変更前</label>
                <textarea class="form-control devtool-code diff-input" id="diff-old" spellcheck="false" autocomplete="off"></textarea>
            </div>
            <div class="col-md-6">
                <label class="form-label" for="diff-new">変更後</label>
                <textarea class="form-control devtool-code diff-input" id="diff-new" spellcheck="false" autocomplete="off"></textarea>
            </div>
        </div>
        <div class="devtool-toolbar mt-3 mb-0">
            <div class="form-check form-switch mb-0">
                <input class="form-check-input" type="checkbox" role="switch" id="diff-ignore-whitespace">
                <label class="form-check-label" for="diff-ignore-whitespace">空白の違いを無視する</label>
            </div>
            <div class="form-check form-switch mb-0">
                <input class="form-check-input" type="checkbox" role="switch" id="diff-fold" checked>
                <label class="form-check-label" for="diff-fold">変わったところの前後だけ表示する</label>
            </div>
            <button type="button" class="btn btn-outline-secondary btn-sm ms-auto" id="diff-swap">変更前と変更後を入れ替える</button>
        </div>
        <p class="devtool-help mt-3 mb-0">入力した内容はサーバーに送らず、お使いのブラウザの中だけで比べます。保存もしません。</p>
    </section>

    <section class="devtool-card">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
            <h2 class="devtool-heading mb-0">違い</h2>
            <p class="diff-summary mb-0" id="diff-summary" aria-live="polite"></p>
        </div>
        <p class="devtool-help" id="diff-approximate" hidden>違いが多すぎるため、一部はまとめて入れ替えとして表示しています。</p>
        <div class="diff-result" id="diff-result">
            <table class="diff-table">
                <thead class="visually-hidden">
                    <tr><th scope="col">変更前の行</th><th scope="col">変更後の行</th><th scope="col">種類</th><th scope="col">内容</th></tr>
                </thead>
                <tbody id="diff-body"></tbody>
            </table>
            <p class="diff-empty" id="diff-empty">2 つの文章を入れると、ここに違いを表示します</p>
        </div>
    </section>

    {{-- 差分のしくみ（lib/text-diff.ts） --}}
    <section class="devtool-card">
        <h2 class="devtool-heading">しくみ</h2>
        <p class="devtool-help mb-2">
            違いは、Git の <code>git diff</code> でも使われている Myers のアルゴリズムで、追加・削除がいちばん少なくなる組み合わせを探して出しています。
            変わった行どうしは、同じ方法で 1 文字ずつ比べ直し、変わった文字に印を付けます。
        </p>
        <p class="devtool-help mb-0">
            論文：Eugene W. Myers,
            <a href="https://doi.org/10.1007/BF01840446" target="_blank" rel="noopener noreferrer" lang="en">“An O(ND) Difference Algorithm and Its Variations”</a>,
            Algorithmica 1, 251–266（1986）
        </p>
    </section>
</div>

@endsection
