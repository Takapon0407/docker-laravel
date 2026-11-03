@extends('layouts.common')
@section('title', '寿命の計算')
@section('description', '誕生日を入れると、日本と世界の平均寿命から、平均寿命を迎える日と、そこまでの残りの年・日・時間・分・秒を計算します。入力はブラウザの中だけで処理し、保存もしません。')
@push('head')
    @vite('resources/ts/laravel/tools/lifespan.ts')
@endpush
@section('content')

{{-- 計算はブラウザ内だけで行う（誕生日はサーバーに送らない・保存しない） --}}
<div class="container lifespan-container">
    <h1 class="lifespan-title font-heading">寿命の計算</h1>
    <p class="lifespan-lead">誕生日を入れると、日本と世界の平均寿命まで、あとどれくらいかを計算します。</p>

    <section class="lifespan-card">
        <div class="row g-3">
            {{-- 年・月・日の選択肢はスクリプトで作る（年は今年から 1900 年まで、日はその月の日数まで） --}}
            <fieldset class="col-12">
                <legend class="form-label fs-6">誕生日</legend>
                <div class="lifespan-birthday">
                    <label class="visually-hidden" for="lifespan-year">年</label>
                    <select class="form-select" id="lifespan-year"><option value="">----</option></select>
                    <span>年</span>
                    <label class="visually-hidden" for="lifespan-month">月</label>
                    <select class="form-select" id="lifespan-month"><option value="">--</option></select>
                    <span>月</span>
                    <label class="visually-hidden" for="lifespan-day">日</label>
                    <select class="form-select" id="lifespan-day"><option value="">--</option></select>
                    <span>日</span>
                </div>
                <div class="lifespan-age mt-2">
                    <label class="lifespan-help" for="lifespan-age">年齢から年を選ぶ：今</label>
                    <input type="number" class="form-control form-control-sm" id="lifespan-age" inputmode="numeric" min="0" max="126" step="1">
                    <span class="lifespan-help">歳</span>
                    <span class="lifespan-age-candidates" id="lifespan-age-candidates"></span>
                </div>
            </fieldset>
            <fieldset class="col-12">
                <legend class="form-label fs-6">性別（平均寿命が男女で違うため）</legend>
                <div class="btn-group w-100">
                    <input type="radio" class="btn-check" name="lifespan-sex" id="lifespan-sex-male" value="male">
                    <label class="btn btn-outline-success" for="lifespan-sex-male">男性</label>
                    <input type="radio" class="btn-check" name="lifespan-sex" id="lifespan-sex-female" value="female">
                    <label class="btn btn-outline-success" for="lifespan-sex-female">女性</label>
                    <input type="radio" class="btn-check" name="lifespan-sex" id="lifespan-sex-unspecified" value="unspecified" checked>
                    <label class="btn btn-outline-success" for="lifespan-sex-unspecified">指定しない</label>
                </div>
            </fieldset>
        </div>
        <p class="lifespan-help mt-2 mb-0">入力された誕生日は、ブラウザの中だけで計算に使い、送信も保存もしません。</p>
        <p class="lifespan-error" id="lifespan-error" role="alert" hidden></p>
    </section>

    @foreach (['japan' => '日本', 'world' => '世界'] as $region => $label)
        <section class="lifespan-card" data-lifespan-region="{{ $region }}" hidden>
            <h2 class="lifespan-heading">{{ $label }}の平均寿命から</h2>
            <p class="lifespan-basis" data-lifespan="basis"></p>
            <p class="lifespan-main" data-lifespan="main"></p>
            <div class="lifespan-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" data-lifespan="progress">
                <div class="lifespan-progress-bar" data-lifespan="progress-bar"></div>
            </div>
            <p class="lifespan-help mt-1" data-lifespan="progress-label"></p>
            <dl class="lifespan-totals" data-lifespan="totals"></dl>
        </section>
    @endforeach

    {{-- 押したときの結果で文章を作り、X の投稿画面を開く（X の API は使わない）。
         日まで出すと誕生日を逆算できてしまうため、文章は「あと約 ◯ 年」の年数だけにする --}}
    <div class="lifespan-share" id="lifespan-share" hidden>
        <a class="btn btn-dark" id="lifespan-share-x" href="https://x.com/intent/post" target="_blank" rel="noopener noreferrer">X に投稿する</a>
        <p class="lifespan-help mt-2 mb-0">押したときだけ、「あと約 ◯ 年」という年数だけの文章を X に渡します。誕生日や日数は入れませんが、残りの年数から、おおよその年齢はわかります。</p>
    </div>

    <section class="lifespan-card lifespan-sources">
        <h2 class="lifespan-heading">使っている統計</h2>
        <ul>
            <li>
                日本：男性 81.35 年・女性 87.33 年（厚生労働省「<a href="https://www.mhlw.go.jp/toukei/saikin/hw/life/life25/index.html" target="_blank" rel="noopener noreferrer">令和 7（2025）年簡易生命表の概況</a>」）。
                男女を合わせた値は公表されていないため、「指定しない」では男女の平均（84.34 年）を使います
            </li>
            <li>
                世界：男性 70.5 年・女性 75.9 年・男女合わせて 73.2 年（国連「<a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer">World Population Prospects 2024</a>」の 2023 年の推計値。
                <a href="https://ourworldindata.org/grapher/life-expectancy" target="_blank" rel="noopener noreferrer">Our World in Data</a> の表で確認）
            </li>
        </ul>
        <p class="lifespan-help mb-0">
            平均寿命は「0 歳の人が、あと何年生きるか」の平均です。今の年齢の人があと何年生きるか（平均余命）とは違い、ひとりひとりの寿命を表すものではありません。
            平均寿命を迎える日は、誕生日に平均寿命 × 365.2425 日を足して求めています。<br>
            ※365.2425 日は、うるう年を含めたカレンダー（グレゴリオ暦）の 1 年の平均です。
        </p>
    </section>
</div>

@endsection
