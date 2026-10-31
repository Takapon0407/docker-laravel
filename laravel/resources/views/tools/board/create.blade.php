@extends('layouts.common')
@section('title', '匿名質問ボード')
@section('description', '勉強会などで使える、ログインなし・匿名の質問／コメントボードです。URL を共有するだけで、参加者が質問やコメントを投稿できます。')
@push('head')
    @include('tools.board._websocket')
    @vite('resources/ts/laravel/tools/board/create.ts')
@endpush
@section('content')

<div class="container board-container">
    <h1 class="board-title font-cherry">匿名質問ボード</h1>
    <p class="board-lead">
        勉強会などで使える、ログインなし・匿名の質問／コメントボードです。
        ルームを作って共有用 URL を配ると、参加者が質問やコメントを投稿できます。
    </p>

    <form class="board-card" id="board-create-form" novalidate>
        <div class="mb-3">
            <label class="form-label" for="board-title">タイトル</label>
            <input type="text" class="form-control form-control-lg" id="board-title" maxlength="50" required placeholder="例: A勉強会">
        </div>

        <fieldset class="mb-3">
            <legend class="form-label fs-6">保存期間（過ぎると自動で削除されます）</legend>
            <div class="btn-group w-100" role="group">
                <input type="radio" class="btn-check" name="retention" id="board-retention-24h" value="24h">
                <label class="btn btn-outline-success" for="board-retention-24h">24 時間</label>
                <input type="radio" class="btn-check" name="retention" id="board-retention-7d" value="7d" checked>
                <label class="btn btn-outline-success" for="board-retention-7d">7 日</label>
                <input type="radio" class="btn-check" name="retention" id="board-retention-30d" value="30d">
                <label class="btn btn-outline-success" for="board-retention-30d">30 日</label>
            </div>
        </fieldset>

        <fieldset class="mb-3">
            <legend class="form-label fs-6">投稿者の名前</legend>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="name-mode" id="board-name-nickname" value="nickname" checked>
                <label class="form-check-label" for="board-name-nickname">ニックネームを入れられる（空欄なら「匿名」）</label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="name-mode" id="board-name-anonymous" value="anonymous">
                <label class="form-check-label" for="board-name-anonymous">完全に匿名（名前の欄を出さない）</label>
            </div>
        </fieldset>

        <div class="mb-3">
            <label class="form-label" for="board-topics">トピック（任意・1 行に 1 つ、20 個まで）</label>
            <textarea class="form-control" id="board-topics" rows="4" placeholder="例:&#10;A スライド&#10;B スライド"></textarea>
            <div class="form-text">発表の順番などで分けておくと、主催者が切り替えたときに投稿がトピックごとにまとまります。あとから追加もできます。空欄なら「全体」の 1 つになります。</div>
        </div>

        <p class="board-error" id="board-create-error" role="alert"></p>
        <button type="submit" class="btn btn-success btn-lg w-100" id="board-create-submit">ルームを作る</button>
    </form>
</div>

@endsection
