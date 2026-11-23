@extends('layouts.common')
@section('title', 'ガチャ天井計算機')
@section('description', '確率・すり抜け・天井（ソフト天井）・交換までの回数を入れると、ガチャで狙いが手に入るまでの平均の回数と金額、運が悪いときの回数、予算で手に入る確率を計算します。入力はブラウザの中だけで処理し、サーバーには送りません。')
@push('head')
    @vite('resources/ts/laravel/tools/gacha.ts')
@endpush
@section('content')

{{-- 計算はブラウザ内だけで行う（入力はサーバーに送らず、どこにも保存しない） --}}
<div class="container devtool-container gacha-container">
    <h1 class="devtool-title font-heading">ガチャ天井計算機</h1>
    <p class="devtool-lead">確率・すり抜け・天井を入れると、狙いの 1 体が手に入るまでの回数と金額、予算で手に入る確率を計算します。</p>

    <noscript>
        <p class="devtool-card gacha-noscript">このツールは JavaScript を使います。ブラウザの設定で JavaScript を有効にしてください。</p>
    </noscript>

    <section class="devtool-card gacha-form" aria-label="入力">
        @include('tools._gacha-field', ['id' => 'p', 'label' => '最高レアの確率', 'unit' => '%', 'decimal' => true, 'value' => '1', 'help' => 'ゲームのお知らせ（提供割合）に書いてある、最高レアが出る確率です。'])

        <fieldset class="gacha-fieldset">
            <legend class="gacha-legend">すり抜け</legend>
            @include('tools._gacha-field', ['id' => 'q', 'label' => 'すり抜けの確率', 'unit' => '%', 'decimal' => true, 'value' => '50', 'placeholder' => '0', 'help' => '最高レアが出たときに、狙いではないものが出る確率です。ピックアップの確率しか書いていないときは「1 − ピックアップの確率 ÷ 最高レアの確率」（例：最高レア 1%・ピックアップ 0.5% なら 50%）。空欄は 0% です。'])
            <div class="gacha-field">
                <label class="form-label" for="gacha-k">すり抜けが続いたら確定</label>
                <select class="form-select form-select-lg" id="gacha-k" autocomplete="off" aria-describedby="gacha-k-help">
                    <option value="">なし</option>
                    @foreach (range(1, 5) as $times)
                        <option value="{{ $times }}" @selected($times === 1)>{{ $times }} 回</option>
                    @endforeach
                </select>
                <p class="devtool-help mt-1 mb-0" id="gacha-k-help">すり抜けがこの回数だけ続くと、次の最高レアは必ず狙いになる仕組みです。</p>
            </div>
            <div class="gacha-field" id="gacha-s0-field">
                <label class="form-label" for="gacha-s0">いま続いているすり抜け</label>
                <select class="form-select form-select-lg" id="gacha-s0" autocomplete="off">
                    <option value="0" selected>0 回</option>
                    <option value="1">1 回（次は確定）</option>
                </select>
            </div>
        </fieldset>

        <fieldset class="gacha-fieldset">
            <legend class="gacha-legend">天井</legend>
            @include('tools._gacha-field', ['id' => 'n', 'label' => '天井（最高レアが必ず出る回数）', 'unit' => '回', 'decimal' => false, 'value' => '100', 'placeholder' => 'なし', 'help' => 'この回数までに最高レアが出なければ、この回数目で必ず出ます。出たら数え直しです。空欄は天井なしです。'])
            @include('tools._gacha-field', ['id' => 'c0', 'label' => '今のカウント（前の最高レアから引いた回数）', 'unit' => '回', 'decimal' => false, 'placeholder' => '0', 'help' => 'ガチャをまたいで天井のカウントを持ち越すゲームなら、いまの数を入れます。'])
            @include('tools._gacha-field', ['id' => 'softStart', 'label' => 'ソフト天井の開始', 'unit' => '回目', 'decimal' => false, 'placeholder' => 'なし', 'help' => '天井の手前から、1 回ごとに確率が上がっていくゲームのときだけ入れます。'])
            @include('tools._gacha-field', ['id' => 'softStep', 'label' => 'ソフト天井で 1 回ごとに上がる確率', 'unit' => '%', 'decimal' => true, 'placeholder' => 'なし'])
            @include('tools._gacha-field', ['id' => 'm', 'label' => '狙いが確定するまであと何回', 'unit' => '回', 'decimal' => false, 'placeholder' => 'なし', 'help' => '交換（ポイントがたまると狙いと交換できる）や、期間ごとの天井があるときに、あと何回で必ず狙いが手に入るかを入れます。空欄はなしです。'])
        </fieldset>

        <fieldset class="gacha-fieldset">
            <legend class="gacha-legend">石とお金</legend>
            @include('tools._gacha-field', ['id' => 'stones', 'label' => '1 回に使う石の数', 'unit' => '個', 'decimal' => true, 'value' => '100', 'help' => '10 連で割引があるときは、10 連の石の数 ÷ 10 を入れます。'])
            @include('tools._gacha-field', ['id' => 'price', 'label' => '石 1 個の値段', 'unit' => '円', 'decimal' => true, 'value' => '1', 'help' => 'まとめ買いの値段 ÷ 石の数です（例：10,000 円で 8,400 個なら 1.19）。'])
            @include('tools._gacha-field', ['id' => 'owned', 'label' => '持っている石', 'unit' => '個', 'decimal' => false, 'placeholder' => '0', 'help' => '金額から差し引きます（石の列は、必要な石の合計のままです）。'])
            @include('tools._gacha-field', ['id' => 'budget', 'label' => '予算', 'unit' => '円', 'decimal' => false, 'placeholder' => 'なし', 'help' => '入れると、この予算で狙いが手に入る確率を出します。'])
        </fieldset>

        <p class="devtool-help mt-3 mb-0">入力した内容はサーバーに送らず、お使いのブラウザの中だけで計算します。保存もしません。</p>
    </section>

    <section class="devtool-card gacha-result-card" aria-labelledby="gacha-result-heading">
        <h2 class="devtool-heading" id="gacha-result-heading">結果</h2>
        <p class="gacha-message" id="gacha-message" hidden></p>
        <div id="gacha-result" hidden>
            <div class="gacha-table-wrap">
                <table class="table gacha-table">
                    <caption>狙いが手に入るまでの回数と金額</caption>
                    <thead>
                        <tr>
                            <td></td>
                            <th scope="col">回数</th>
                            <th scope="col">石</th>
                            <th scope="col">金額</th>
                        </tr>
                    </thead>
                    <tbody id="gacha-rows">
                        @foreach (['平均', '50%', '90%', '99%', '最大'] as $rowLabel)
                            <tr>
                                <th scope="row">{{ $rowLabel }}</th>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            <p class="devtool-help">50%・90%・99% は「この回数までに、その確率で手に入る」回数です（運が悪いときの目安）。最大は、天井や確定の仕組みで必ず手に入る回数です。</p>
            <p class="gacha-budget" id="gacha-budget-text" hidden></p>
            {{-- 回数ごとの、狙いが手に入る確率（中身は TS で描く。style 属性は使わずクラスで色を付ける） --}}
            <svg class="gacha-chart" id="gacha-chart" role="img" viewBox="0 0 400 220" aria-label="回数ごとの、狙いが手に入る確率のグラフ"></svg>
        </div>
    </section>

    <section class="devtool-card gacha-notes" aria-label="注意">
        <p>狙い 1 体が手に入るまでを計算します。2 体以上ほしいときの平均は、おおよそ体数倍です。ただし 90% などの回数は体数倍にはなりません。交換型の天井（当たっても交換のポイントが減らないもの）では、2 体目以降はこの計算より少なく済むことがあります。</p>
        <p class="mb-0">確率や天井は、ゲームのお知らせ（提供割合）で確かめてください。結果は目安です。</p>
    </section>
</div>
@endsection
