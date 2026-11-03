@extends('layouts.common')
@section('title', '便利ツール')
@section('description', '割り勘の計算や、勉強会で使える匿名の質問ボードなど、ブラウザですぐに使える便利ツールの一覧です。入力したデータを外に送らない「端末内で完結」のツールと、「サーバーに保存」するツールで絞り込めます。')
@section('content')

<div class="container tools-container">
    <h1 class="tools-title font-heading">便利ツール</h1>
    <p class="tools-lead">ブラウザですぐに使える、ちょっとした便利ツールです。ログインは要りません。</p>

    {{-- 絞り込みは CSS だけで行う（選んだラジオボタンに合わせて、_tools.scss でカードを隠す） --}}
    <fieldset class="tools-filter">
        <legend class="tools-filter-label">データの扱いで絞り込む</legend>
        <div class="btn-group" role="group">
            <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-all" value="all" checked>
            <label class="btn btn-outline-success" for="tools-filter-all">すべて</label>
            <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-local" value="local">
            <label class="btn btn-outline-success" for="tools-filter-local">端末内で完結</label>
            <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-server" value="server">
            <label class="btn btn-outline-success" for="tools-filter-server">サーバーに保存</label>
        </div>
    </fieldset>

    {{-- data-storage：local = 入力はブラウザの中だけ / server = サーバーに送って保存する --}}
    <ul class="tools-list">
        <li data-storage="local">
            <a class="tools-card" href="{{ route('tools.warikan') }}">
                <h2 class="tools-card-title font-heading">割り勘計算</h2>
                <p class="tools-card-text">
                    合計金額と人数から、1 人あたりの金額を計算します。先輩・後輩などグループごとの比率や、固定額の人、1 人ずつ金額を決める割り方にも対応しています。
                </p>
                <span class="tools-storage is-local">端末内で完結：計算はブラウザの中だけで行います</span>
            </a>
        </li>
        @if (config('board.enabled'))
            <li data-storage="server">
                <a class="tools-card" href="{{ route('tools.board') }}">
                    <h2 class="tools-card-title font-heading">匿名質問ボード</h2>
                    <p class="tools-card-text">
                        勉強会などで使える、匿名の質問・コメントボードです。ルームを作って URL や QR コードを配ると、参加者がその場で投稿できます。
                    </p>
                    <span class="tools-storage is-server">サーバーに保存：投稿はルームの保存期間（最長 30 日）が過ぎると自動で消えます</span>
                </a>
            </li>
        @endif
    </ul>
</div>

@endsection
