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
            <details class="board-admin-url mb-2" id="board-qr">
                <summary>QR コードを表示（会場のスクリーンに映す）</summary>
                <div class="board-qr">
                    <svg class="board-qr-image" id="board-qr-image" role="img" aria-label="参加者に配る URL の QR コード"></svg>
                    <button type="button" class="btn btn-outline-success btn-sm" id="board-qr-fullscreen" hidden>全画面で表示</button>
                </div>
            </details>
            <details class="board-admin-url">
                <summary>主催者用の URL（ほかの主催者にだけ共有する）</summary>
                <p class="board-help mt-2">この URL を開いた人は主催者として操作できます。参加者には共有しないでください。</p>
                <div class="input-group">
                    <input type="text" class="form-control" id="board-admin-url" readonly aria-label="主催者用 URL">
                    <button type="button" class="btn btn-outline-success" data-copy="board-admin-url">コピー</button>
                </div>
            </details>

            <div class="board-admin-controls">
                <p class="mb-0"><span id="board-accepting-status"></span></p>
                <button type="button" class="btn btn-outline-success btn-sm" id="board-accepting-toggle"></button>
            </div>
            <details class="board-admin-url mt-2">
                <summary>URL を作り直す（URL が広まってしまったとき）</summary>
                <p class="board-help mt-2 mb-1">共有用 URL を作り直すと、古い URL では新しく入れなくなります。入っている参加者はそのままです。</p>
                <button type="button" class="btn btn-outline-danger btn-sm mb-2" data-rotate="join">共有用 URL を作り直す</button>
                <p class="board-help mb-1">知らない人に参加者の枠を埋められて入れないときは、作り直すのと一緒に今いる参加者を全員退出させます。参加者には新しい共有用 URL から入り直してもらってください。</p>
                <button type="button" class="btn btn-outline-danger btn-sm mb-2" data-rotate="join-remove">共有用 URL を作り直して、参加者を全員退出させる</button>
                <p class="board-help mb-1">主催者用 URL を作り直すと、ほかの主催者はすぐに参加者になります。新しい主催者用 URL を渡し直してください。</p>
                <button type="button" class="btn btn-outline-danger btn-sm" data-rotate="admin">主催者用 URL を作り直す</button>
            </details>
        </section>

        {{-- 主催者だけに表示する --}}
        <section class="board-card" id="board-topic-admin" hidden>
            <h2 class="board-heading">トピックの管理</h2>
            <p class="board-help">「切り替える」と、参加者の画面も切り替わり、そのあとの投稿はそのトピックに入ります。</p>
            <ul class="board-topic-admin-list" id="board-topic-admin-list"></ul>
            <form class="board-topic-add" id="board-topic-add-form" novalidate>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" id="board-topic-add-title" placeholder="新しいトピック" aria-label="新しいトピックの名前">
                    <button type="submit" class="btn btn-success">追加</button>
                </div>
                <div class="form-check mt-1">
                    <input class="form-check-input" type="checkbox" id="board-topic-add-select" checked>
                    <label class="form-check-label board-help" for="board-topic-add-select">追加したら切り替える</label>
                </div>
                <p class="board-error mb-0" id="board-topic-error" role="alert"></p>
            </form>
        </section>

        <section class="board-card" id="board-compose">
            <form id="board-post-form" novalidate>
                <div class="btn-group mb-2" role="group" aria-label="投稿の種類">
                    <input type="radio" class="btn-check" name="kind" id="board-kind-question" value="question" checked>
                    <label class="btn btn-outline-success btn-sm" for="board-kind-question">質問</label>
                    <input type="radio" class="btn-check" name="kind" id="board-kind-comment" value="comment">
                    <label class="btn btn-outline-success btn-sm" for="board-kind-comment">コメント</label>
                </div>
                <div class="mb-2" id="board-nickname-field">
                    <label class="visually-hidden" for="board-nickname">ニックネーム</label>
                    <input type="text" class="form-control form-control-sm" id="board-nickname" placeholder="ニックネーム（空欄なら「匿名」）" autocomplete="nickname">
                </div>
                <label class="visually-hidden" for="board-post-body">本文</label>
                <textarea class="form-control mb-1" id="board-post-body" rows="3" placeholder="質問やコメントを入力"></textarea>
                <div class="board-compose-footer">
                    <span class="board-help" id="board-post-topic"></span>
                    <span class="board-help" id="board-post-count"></span>
                </div>
                <p class="board-error mt-2 mb-0" id="board-post-error" role="alert"></p>
                <button type="submit" class="btn btn-success w-100 mt-2" id="board-post-submit">投稿する</button>
            </form>
            <p class="board-help mb-0" id="board-closed" hidden>今は投稿を受け付けていません。</p>
        </section>

        <div class="board-topics" role="group" aria-label="トピック">
            <ul class="nav nav-pills" id="board-topic-tabs"></ul>
        </div>

        <section id="board-posts" aria-label="投稿">
            <div class="board-sort btn-group mb-2" role="group" aria-label="並び順">
                <input type="radio" class="btn-check" name="sort" id="board-sort-new" value="new" checked>
                <label class="btn btn-outline-success btn-sm" for="board-sort-new">新着順</label>
                <input type="radio" class="btn-check" name="sort" id="board-sort-likes" value="likes">
                <label class="btn btn-outline-success btn-sm" for="board-sort-likes">いいね順</label>
            </div>
            <p class="board-help board-posts-empty" id="board-posts-empty">まだ投稿はありません。</p>
            <ul class="board-post-list" id="board-post-list"></ul>
            {{-- 見えていないところに新しい投稿が届いたとき --}}
            <button type="button" class="btn btn-success btn-sm board-new-posts" id="board-new-posts" hidden></button>
            {{-- ボタンの表示・非表示はスクリーンリーダーに伝わらないことがあるので、件数は常にある領域で読み上げる --}}
            <p class="visually-hidden" id="board-new-posts-announcement" aria-live="polite"></p>
        </section>
    </div>
</div>

@endsection
