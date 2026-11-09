@extends('layouts.common')
{{-- 「&」を含むため HtmlString で渡す（文字列のままだと、ここでエスケープされ、レイアウトでもう一度エスケープされる） --}}
@section('title', new \Illuminate\Support\HtmlString('Rain & Realms'))
@section('description')雨の古民家で勉強する女の子の映像と、ケルト音楽の作業用 BGM「Rain & Realms」。AI で生成した曲と映像を選び、後処理・長時間の動画づくり・配信までを 1 人で仕組みにしました。アルバムの全 {{ count($tracks) }} 曲をこのページで聴けます。@endsection
@section('og_image', asset($album['cover']))
@push('head')
    @vite('resources/ts/laravel/works/album.ts')
@endpush
@section('content')

{{-- 「作曲した」とは書かない（曲と映像は AI で生成し、担当したのは企画・選曲・後処理・配信と、それを回す仕組みづくり） --}}
<div class="container works-container">
    <p class="works-breadcrumb"><a href="{{ route('works.index') }}">作品</a></p>

    <header class="album-hero">
        <img class="album-cover" src="{{ asset($album['cover']) }}" alt="アルバムのジャケット：雨の古民家で勉強する女の子" width="640" height="640">
        <div class="album-hero-body">
            <p class="album-artist">{{ $album['artist'] }}</p>
            <h1 class="album-title">{{ $album['title'] }}</h1>
            <p class="album-subtitle">{{ $album['subtitle'] }}</p>
            <p class="album-meta">{{ count($tracks) }} 曲・約 {{ $totalMinutes }} 分・{{ \Illuminate\Support\Carbon::parse($album['released'])->format('Y 年 n 月 j 日') }} 公開</p>
        </div>
    </header>

    <section class="works-section">
        <p>
            雨の日の古民家で勉強する女の子と、ケルト音楽の作業用 BGM のチャンネルです。
            映像はループしながら、ときどき背伸び・お茶・うたた寝などの「小さな出来事」が不規則に起こります。
        </p>
        <p class="mb-0">
            曲と映像は AI（Suno・Google Flow など）で生成しています。
            私が担当したのは、企画・選曲・映像の後処理・配信までのプロデュースと、それを 1 人で回すための仕組みづくりです。
        </p>
    </section>

    <section class="works-section">
        <h2 class="works-heading font-heading">動画</h2>
        {{-- 押すまで YouTube には接続しない（押したら youtube-nocookie.com のプレーヤーに差し替える） --}}
        <div class="video-embed" id="video-embed" data-youtube-id="{{ $youtubeId }}">
            <button type="button" class="video-embed-button" id="video-embed-button">
                <img src="{{ asset('images/works/rain-and-realms/youtube-1h.jpg') }}" alt="" width="960" height="540" loading="lazy">
                <span class="video-embed-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="36" height="36"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                </span>
                <span class="visually-hidden">YouTube の動画（1 時間版）を読み込んで再生する</span>
            </button>
        </div>
        <p class="works-help mt-2 mb-0">押すと YouTube のプレーヤーを読み込みます（YouTube に接続します）。</p>
    </section>

    <section class="works-section" aria-labelledby="album-player-heading">
        <h2 class="works-heading font-heading" id="album-player-heading">曲を聴く</h2>

        <div class="album-player" id="album-player" data-artist="{{ $album['artist'] }}" data-album="{{ $album['title'] }}" data-artwork="{{ asset($album['cover']) }}">
            <div class="album-now">
                <div class="album-controls">
                    <button type="button" class="album-control" id="album-prev" aria-label="前の曲" disabled>
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" fill="currentColor"/></svg>
                    </button>
                    <button type="button" class="album-control is-main" id="album-play" aria-label="再生">
                        <svg class="album-icon-play" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                        <svg class="album-icon-pause" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M6 19h4V5H6zm8-14v14h4V5z" fill="currentColor"/></svg>
                    </button>
                    <button type="button" class="album-control" id="album-next" aria-label="次の曲" disabled>
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 18l8.5-6L6 6zM16 6v12h2V6z" fill="currentColor"/></svg>
                    </button>
                </div>
                <div class="album-now-body">
                    <p class="album-now-title" id="album-now-title" aria-live="polite">曲を選ぶと再生します</p>
                    <div class="album-progress">
                        <span class="album-time" id="album-current">0:00</span>
                        <input type="range" class="form-range album-seek" id="album-seek" min="0" max="0" step="1" value="0" aria-label="再生位置" disabled>
                        <span class="album-time" id="album-duration">0:00</span>
                    </div>
                </div>
            </div>

            {{-- 再生できなかったとき（アクセスが多い月に配信を止めたときなど）に出す --}}
            <div class="album-unavailable" id="album-unavailable" role="alert" hidden>
                今はここで再生できませんでした。通信の状態を確かめて、もう一度押してみてください。
                アクセスが多い月は、費用を抑えるためにここでの再生を止めることがあります。そのときは <a href="#album-links">YouTube や各配信サービス</a>でお楽しみください。
            </div>

            <ol class="album-tracks">
                @foreach ($tracks as $track)
                    <li>
                        <button type="button" class="album-track" data-album-track="{{ $loop->index }}" data-src="{{ $track['src'] }}" data-title="{{ $track['title_en'] }}">
                            <span class="album-track-no">{{ $track['no'] }}</span>
                            <span class="album-track-titles">
                                <span class="album-track-ja">{{ $track['title_ja'] }}</span>
                                <span class="album-track-en" lang="en">{{ $track['title_en'] }}</span>
                            </span>
                            <span class="album-track-duration">{{ $track['duration'] }}</span>
                        </button>
                    </li>
                @endforeach
            </ol>
            {{-- 押すまで読み込まない（ページを開いただけでは音源を取りに行かない） --}}
            <audio id="album-audio" preload="none"></audio>
        </div>
        <p class="works-help mt-2 mb-0">1 曲終わると次の曲を再生します。曲は聴くだけで、ダウンロードはできません。</p>
    </section>

    <section class="works-section">
        <h2 class="works-heading font-heading">作り方</h2>
        <p>企画から配信までを 1 人で回せるよう、手作業を減らす仕組みを作りました。</p>
        <ol class="works-steps">
            <li>
                <h3 class="works-step-title">企画</h3>
                <p>テーマ（雨の古民家 × ケルト音楽）、曲順、英語と古語調の日本語の曲名を決めます。</p>
            </li>
            <li>
                <h3 class="works-step-title">音楽</h3>
                <p>Suno で生成した候補から 19 曲を選び、音量（ラウドネス）をそろえて、曲の間を 3 秒のクロスフェードでつなぎます。</p>
            </li>
            <li>
                <h3 class="works-step-title">映像</h3>
                <p>Adobe Firefly で作った基準の画像 1 枚から、Google Flow で「最初と最後が同じポーズ」の 8 秒のクリップを十数本（基本のループと、出来事ごとのクリップ）作ります。</p>
            </li>
            <li>
                <h3 class="works-step-title">後処理（Python・OpenCV・ffmpeg）</h3>
                <p>AI の映像に出る 0.5〜2 ピクセルのブレを位相相関で打ち消し、家の中は静止画で固定したまま雨粒だけを通して合成します。止まって見えてしまう雨には、3 層の雨のレイヤーを重ねます。</p>
            </li>
            <li>
                <h3 class="works-step-title">動画の組み立て</h3>
                <p>基本のループの間に、出来事を 5〜10 分おきに不規則に挟むルール（同じ出来事を続けない、など）を作り、1〜3 時間の動画を自動で組み立てます。</p>
            </li>
            <li>
                <h3 class="works-step-title">書き出しの自動化</h3>
                <p>アルバムごとの設定ファイル 1 つから、音源のミックス・チャプター・説明文・サムネイル・ジャケット・動画までをまとめて書き出します。</p>
            </li>
            <li>
                <h3 class="works-step-title">公開</h3>
                <p>YouTube（AI を使っていることを申告）と、DistroKid を通じて Spotify・Apple Music など 20 以上のサービスで配信しています。</p>
            </li>
        </ol>
    </section>

    <section class="works-section" id="album-links">
        <h2 class="works-heading font-heading">リンク</h2>
        <ul class="works-links">
            @foreach ($links as $link)
                <li><a class="btn btn-outline-dark" href="{{ $link['url'] }}" target="_blank" rel="noopener noreferrer">{{ $link['label'] }}</a></li>
            @endforeach
        </ul>
    </section>
</div>

@endsection
