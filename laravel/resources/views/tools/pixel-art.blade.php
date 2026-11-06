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

        {{-- 結果を見ながら動かせるよう、画像のすぐ下に置く。動かしている間も描き直す
             （上限は、スマホでもすぐ描き直せて、ドット絵らしさが残る大きさ） --}}
        <div class="pixel-slider mt-3">
            <label class="form-label" for="pixel-size">細かさ</label>
            <output class="pixel-slider-value" for="pixel-size" id="pixel-size-value">48 ドット</output>
            {{-- 値は長いほうの辺のドット数（縦長の画像は縦が、この数になる） --}}
            <input type="range" class="form-range" id="pixel-size" min="16" max="128" step="1" value="48">
            <div class="pixel-slider-ends pixel-help" aria-hidden="true"><span>粗い</span><span>細かい</span></div>
            {{-- よく使われる値（ゲームのキャラクターなどのドット絵は 16・32・64 ドット四方が多い）にすぐ合わせる --}}
            <div class="pixel-presets" role="group" aria-label="よく使われる細かさ">
                @foreach ([16, 32, 64, 128] as $size)
                    <button type="button" class="btn btn-outline-success btn-sm" data-pixel-preset="pixel-size" value="{{ $size }}" aria-pressed="false">{{ $size }}</button>
                @endforeach
            </div>
        </div>
        <div class="pixel-slider mt-2">
            <label class="form-label" for="pixel-colors">色数</label>
            <output class="pixel-slider-value" for="pixel-colors" id="pixel-colors-value">16 色</output>
            <input type="range" class="form-range" id="pixel-colors" min="2" max="64" step="1" value="16">
            <div class="pixel-slider-ends pixel-help" aria-hidden="true"><span>少ない</span><span>多い</span></div>
            {{-- よく使われる色数（昔のゲーム機やパソコンが同時に出せた色数の名残で、2 の累乗が多い） --}}
            <div class="pixel-presets" role="group" aria-label="よく使われる色数">
                @foreach ([4, 8, 16, 32] as $count)
                    <button type="button" class="btn btn-outline-success btn-sm" data-pixel-preset="pixel-colors" value="{{ $count }}" aria-pressed="false">{{ $count }} 色</button>
                @endforeach
            </div>
        </div>

        <h2 class="pixel-heading mt-3">使っている色</h2>
        <ul class="pixel-palette" id="pixel-palette" aria-label="使っている色"></ul>
        <button type="button" class="btn btn-dark" id="pixel-save">PNG で保存</button>
        <p class="pixel-help mt-2 mb-0">保存する画像は、ドットがはっきり見えるよう拡大しています。</p>
    </section>
</div>

@endsection
