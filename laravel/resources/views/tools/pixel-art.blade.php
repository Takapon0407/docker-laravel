@extends('layouts.common')
@section('title', 'ドット絵メーカー')
@section('description', '画像を選ぶか貼り付けると、ドット絵に変換します。細かさと色数を選んで、PNG で保存できます。画像はブラウザの中だけで変換し、サーバーには送りません。')
@push('head')
    @vite('resources/ts/laravel/tools/pixel-art.ts')
@endpush
@section('content')

{{-- 変換はブラウザ内だけで行う（画像はサーバーに送らず、どこにも残さない） --}}
<div class="container pixel-container">
    <h1 class="pixel-title font-heading">ドット絵メーカー</h1>
    <p class="pixel-lead">画像を選ぶか貼り付けると、ドット絵に変換します。</p>

    <section class="pixel-card">
        {{-- ラベルごと押せるようにして、ファイルの選択を開く。ドラッグ＆ドロップと貼り付け（Ctrl + V）はスクリプトで受け取る --}}
        <label class="pixel-drop" id="pixel-drop" for="pixel-file">
            <span class="pixel-drop-main">画像を選ぶ</span>
            <span class="pixel-help">ここに画像をドラッグするか、コピーした画像を貼り付けて（Ctrl + V / ⌘ + V）も使えます</span>
        </label>
        <input type="file" class="visually-hidden" id="pixel-file" accept="image/*">
        <p class="pixel-error" id="pixel-error" role="alert" hidden></p>

        <fieldset class="mt-3">
            <legend class="form-label fs-6">細かさ（長いほうの辺のドット数）</legend>
            <div class="btn-group w-100">
                @foreach ([32, 48, 64, 96] as $size)
                    <input type="radio" class="btn-check" name="pixel-size" id="pixel-size-{{ $size }}" value="{{ $size }}" @checked($size === 48)>
                    <label class="btn btn-outline-success" for="pixel-size-{{ $size }}">{{ $size }}</label>
                @endforeach
            </div>
        </fieldset>
        <fieldset class="mt-3">
            <legend class="form-label fs-6">色数</legend>
            <div class="btn-group w-100">
                @foreach ([8, 16, 32] as $count)
                    <input type="radio" class="btn-check" name="pixel-colors" id="pixel-colors-{{ $count }}" value="{{ $count }}" @checked($count === 16)>
                    <label class="btn btn-outline-success" for="pixel-colors-{{ $count }}">{{ $count }} 色</label>
                @endforeach
            </div>
        </fieldset>

        <p class="pixel-help mt-3 mb-0">
            画像はサーバーに送らず、お使いのブラウザの中だけで変換します。<br>
            どこにも保存しないため、ページを閉じると消えます。
        </p>
    </section>

    {{-- 画像を読み込んだら出す --}}
    <section class="pixel-card" id="pixel-result" hidden>
        <div class="pixel-compare">
            <figure class="pixel-figure">
                <canvas class="pixel-canvas" id="pixel-before"></canvas>
                <figcaption class="pixel-help">元の画像</figcaption>
            </figure>
            <figure class="pixel-figure">
                <canvas class="pixel-canvas is-dot" id="pixel-after"></canvas>
                <figcaption class="pixel-help" id="pixel-after-caption"></figcaption>
            </figure>
        </div>
        <h2 class="pixel-heading mt-3">使っている色</h2>
        <ul class="pixel-palette" id="pixel-palette" aria-label="使っている色"></ul>
        <button type="button" class="btn btn-dark" id="pixel-save">PNG で保存</button>
        <p class="pixel-help mt-2 mb-0">保存する画像は、ドットがはっきり見えるよう拡大しています。</p>
    </section>
</div>

@endsection
