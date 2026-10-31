@extends('layouts.common')
@section('title', '匿名質問ボード')
@section('description', '勉強会などで使える、ログインなし・匿名の質問／コメントボードです。')
@push('head')
    @include('tools.board._websocket')
    @vite('resources/ts/laravel/tools/board/room.ts')
@endpush
@section('content')

<div id="notification" class="notification"></div>

<div class="container board-container">
    <p class="board-status" id="board-status" aria-live="polite">接続しています…</p>

    {{-- ルームに入れなかったとき --}}
    <section class="board-card" id="board-room-error" hidden>
        <p class="board-error mb-3" id="board-room-error-message"></p>
        <a class="btn btn-outline-success" href="{{ route('tools.board') }}">新しくルームを作る</a>
    </section>

    <div id="board-room" hidden>
        <header class="board-room-header">
            <h1 class="board-room-title" id="board-room-title"></h1>
            <p class="board-room-meta">
                <span class="badge text-bg-success" id="board-role-badge" hidden>主催者</span>
                <span id="board-room-expires"></span>
            </p>
        </header>

        {{-- 主催者だけに表示する --}}
        <section class="board-card board-admin" id="board-admin" hidden>
            <h2 class="board-heading">参加者に配る URL</h2>
            <div class="input-group mb-2">
                <input type="text" class="form-control" id="board-share-url" readonly aria-label="共有用 URL">
                <button type="button" class="btn btn-success" data-copy="board-share-url">コピー</button>
            </div>
            <details class="board-admin-url">
                <summary>主催者用の URL（ほかの主催者にだけ共有する）</summary>
                <p class="board-help mt-2">この URL を開いた人は主催者として操作できます。参加者には共有しないでください。</p>
                <div class="input-group">
                    <input type="text" class="form-control" id="board-admin-url" readonly aria-label="主催者用 URL">
                    <button type="button" class="btn btn-outline-success" data-copy="board-admin-url">コピー</button>
                </div>
            </details>
        </section>

        <nav class="board-topics" aria-label="トピック">
            <ul class="nav nav-pills" id="board-topic-tabs"></ul>
        </nav>

        <section class="board-card" id="board-posts">
            <p class="board-help mb-0">投稿の機能は準備中です。</p>
        </section>
    </div>
</div>

@endsection
