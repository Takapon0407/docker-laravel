@extends('layouts.common')
@section('title', '便利ツール')
@section('description', '割り勘の計算や、勉強会で使える匿名の質問ボードなど、ブラウザですぐに使える便利ツールの一覧です。')
@section('content')

<div class="container tools-container">
    <h1 class="tools-title font-heading">便利ツール</h1>
    <p class="tools-lead">ブラウザですぐに使える、ちょっとした便利ツールです。ログインは要りません。</p>

    <ul class="tools-list">
        <li>
            <a class="tools-card" href="{{ route('tools.warikan') }}">
                <h2 class="tools-card-title font-heading">割り勘計算</h2>
                <p class="tools-card-text">
                    合計金額と人数から、1 人あたりの金額を計算します。先輩・後輩などグループごとの比率や、固定額の人、1 人ずつ金額を決める割り方にも対応しています。
                </p>
                <span class="tools-card-note">計算はブラウザの中だけで行います</span>
            </a>
        </li>
        @if (config('board.enabled'))
            <li>
                <a class="tools-card" href="{{ route('tools.board') }}">
                    <h2 class="tools-card-title font-heading">匿名質問ボード</h2>
                    <p class="tools-card-text">
                        勉強会などで使える、匿名の質問・コメントボードです。ルームを作って URL や QR コードを配ると、参加者がその場で投稿できます。
                    </p>
                    <span class="tools-card-note">ルームは保存期間が過ぎると自動で消えます</span>
                </a>
            </li>
        @endif
    </ul>
</div>

@endsection
