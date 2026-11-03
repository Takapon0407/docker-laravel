@extends('layouts.common')
@section('title', '便利ツール')
@section('description', '割り勘の計算や勉強会で使える匿名の質問ボード、JSON 整形・日時の変換・正規表現チェックなど、ブラウザですぐに使える便利ツールの一覧です。入力したデータを外に送らない「端末内で完結」のツールと、「サーバーに保存」するツールで絞り込めます。')
@section('content')

<div class="container tools-container">
    <h1 class="tools-title font-heading">便利ツール</h1>
    <p class="tools-lead">ブラウザですぐに使える、ちょっとした便利ツールです。ログインは要りません。</p>

    {{-- 絞り込みは CSS だけで行う（選んだラジオボタンに合わせて、_tools.scss でカードを隠す） --}}
    <fieldset class="tools-filter">
        <legend class="tools-filter-label">データの扱いで絞り込む</legend>
        {{-- グループの名前は fieldset の legend で付ける --}}
        <div class="btn-group">
            <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-all" value="all" checked>
            <label class="btn btn-outline-success" for="tools-filter-all">すべて</label>
            <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-local" value="local">
            <label class="btn btn-outline-success" for="tools-filter-local">端末内で完結</label>
            <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-server" value="server">
            <label class="btn btn-outline-success" for="tools-filter-server">サーバーに保存</label>
        </div>
    </fieldset>

    {{-- data-storage：local = 入力はブラウザの中だけ / server = サーバーに送って保存する --}}
    <section class="tools-section" aria-labelledby="tools-section-daily">
        <h2 class="tools-section-title" id="tools-section-daily">ふだん使い</h2>
        <ul class="tools-list">
            <li data-storage="local">
                <a class="tools-card" href="{{ route('tools.warikan') }}">
                    <h3 class="tools-card-title font-heading">割り勘計算</h3>
                    <p class="tools-card-text">
                        合計金額と人数から、1 人あたりの金額を計算します。先輩・後輩などグループごとの比率や、固定額の人、1 人ずつ金額を決める割り方にも対応しています。
                    </p>
                    <span class="tools-storage is-local">端末内で完結：計算はブラウザの中だけで行います</span>
                </a>
            </li>
            @if (config('board.enabled'))
                <li data-storage="server">
                    <a class="tools-card" href="{{ route('tools.board') }}">
                        <h3 class="tools-card-title font-heading">匿名質問ボード</h3>
                        <p class="tools-card-text">
                            勉強会などで使える、匿名の質問・コメントボードです。ルームを作って URL や QR コードを配ると、参加者がその場で投稿できます。
                        </p>
                        <span class="tools-storage is-server">サーバーに保存：投稿はルームの保存期間（最長 30 日）が過ぎると自動で消えます</span>
                    </a>
                </li>
            @endif
        </ul>
    </section>

    <section class="tools-section" aria-labelledby="tools-section-dev">
        <h2 class="tools-section-title" id="tools-section-dev">開発向け</h2>
        <ul class="tools-list">
            <li data-storage="local">
                <a class="tools-card" href="{{ route('tools.json') }}">
                    <h3 class="tools-card-title font-heading">JSON 整形</h3>
                    <p class="tools-card-text">
                        1 行の JSON をインデント付きで見やすく整形したり、1 行に圧縮したりします。形が正しくないときは、何行目の何文字目かを表示します。
                    </p>
                    <span class="tools-storage is-local">端末内で完結：整形はブラウザの中だけで行います</span>
                </a>
            </li>
            <li data-storage="local">
                <a class="tools-card" href="{{ route('tools.datetime') }}">
                    <h3 class="tools-card-title font-heading">日時の変換</h3>
                    <p class="tools-card-text">
                        いまの時刻を UTC・JST・UNIX 時間で確かめたり、UNIX 時間や ISO 8601 の日時を UTC・JST に変換したりします。
                    </p>
                    <span class="tools-storage is-local">端末内で完結：変換はブラウザの中だけで行います</span>
                </a>
            </li>
            <li data-storage="local">
                <a class="tools-card" href="{{ route('tools.regex') }}">
                    <h3 class="tools-card-title font-heading">正規表現チェック</h3>
                    <p class="tools-card-text">
                        正規表現がテスト用の文字列のどこに一致するかを、色を付けて確かめます。キャプチャグループや置換した結果も表示します。
                    </p>
                    <span class="tools-storage is-local">端末内で完結：正規表現はブラウザの中だけで動かします</span>
                </a>
            </li>
        </ul>
    </section>
</div>

@endsection
