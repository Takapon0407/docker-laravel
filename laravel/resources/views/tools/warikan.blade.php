@extends('layouts.common')
@section('title', '割り勘計算')
@section('description', '合計金額と人数から割り勘の金額を計算するツールです。先輩・後輩などのグループごとの比率や、固定額の人、1人ずつ金額を決める割り方にも対応し、端数は幹事のお釣りにします。')
@push('head')
    @vite('resources/ts/laravel/tools/warikan.ts')
@endpush
@section('content')

<div id="notification" class="notification"></div>

{{-- 計算はブラウザ内だけで行う（入力内容はサーバーに送らない） --}}
<div class="container warikan-container">
    <h1 class="warikan-title font-cherry">割り勘計算</h1>

    <div class="btn-group w-100 warikan-split-mode" role="group" aria-label="割り方の種類">
        <button type="button" class="btn btn-outline-success" data-split-mode="group">グループで割る</button>
        <button type="button" class="btn btn-outline-success" data-split-mode="person">1人ずつ決める</button>
    </div>

    <section class="warikan-card">
        <div class="row g-3">
            <div class="col-sm-7">
                <label class="form-label" for="warikan-total">合計金額（レシートの金額）</label>
                <div class="input-group">
                    <input type="number" class="form-control form-control-lg" id="warikan-total"
                        inputmode="numeric" min="1" step="1" placeholder="例: 30000">
                    <span class="input-group-text">円</span>
                </div>
            </div>
            <div class="col-sm-5">
                <label class="form-label" for="warikan-unit">端数の単位（切り上げ）</label>
                <select class="form-select form-select-lg" id="warikan-unit">
                    <option value="1">1円</option>
                    <option value="10">10円</option>
                    <option value="100" selected>100円</option>
                    <option value="500">500円</option>
                    <option value="1000">1,000円</option>
                </select>
            </div>
        </div>
    </section>

    <section class="warikan-card" data-split-section="group">
        <h2 class="warikan-heading">グループ</h2>
        <p class="warikan-help">
            払い方が同じ人をグループにまとめます（例: 先輩・後輩）。
            <strong>比率</strong>は 1 がふつう、0.5 で半額、0 で払わない人になります。
            決まった金額だけ払う人は<strong>固定額</strong>にします。
        </p>
        <div id="warikan-groups" class="warikan-groups"></div>
        <button type="button" class="btn btn-outline-success w-100" id="warikan-add-group">＋ グループを追加</button>
    </section>

    <section class="warikan-card" data-split-section="person">
        <h2 class="warikan-heading">メンバー</h2>
        <p class="warikan-help">
            払う金額を決めた人はその金額を入れます。<strong>空欄の人は自動</strong>で、残りを均等に割ります。
        </p>
        <div id="warikan-people" class="warikan-people"></div>
        <button type="button" class="btn btn-outline-success w-100" id="warikan-add-person">＋ 人を追加</button>
    </section>

    <section class="warikan-card warikan-result" aria-live="polite">
        <h2 class="warikan-heading">結果</h2>
        <p class="warikan-error" id="warikan-error"></p>
        <div id="warikan-result-body" hidden>
            <ul class="warikan-result-list" id="warikan-result-list"></ul>
            <dl class="warikan-summary">
                <div><dt>集める合計</dt><dd id="warikan-collected"></dd></div>
                <div><dt>幹事のお釣り</dt><dd id="warikan-change"></dd></div>
            </dl>
            <button type="button" class="btn btn-success w-100" id="warikan-copy">結果をコピー</button>
        </div>
    </section>

    <button type="button" class="btn btn-link text-secondary d-block mx-auto" id="warikan-reset">入力をリセット</button>
</div>

<template id="warikan-person-template">
    <div class="warikan-person">
        <input type="text" class="form-control" data-field="name" maxlength="20" aria-label="名前">
        <div class="input-group">
            <input type="number" class="form-control" data-field="amount" inputmode="numeric" min="0" step="1" aria-label="払う金額（空欄で自動）">
            <span class="input-group-text">円</span>
        </div>
        <button type="button" class="btn btn-outline-secondary btn-sm" data-action="remove" aria-label="この人を削除">削除</button>
    </div>
</template>

<template id="warikan-group-template">
    <div class="warikan-group">
        <div class="warikan-group-header">
            <input type="text" class="form-control" data-field="name" maxlength="20" aria-label="グループ名">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="remove" aria-label="このグループを削除">削除</button>
        </div>
        <div class="warikan-group-row">
            <span class="warikan-label">人数</span>
            <div class="warikan-stepper">
                <button type="button" class="btn btn-outline-secondary" data-action="decrement" aria-label="人数を減らす">−</button>
                <input type="number" class="form-control" data-field="count" inputmode="numeric" min="0" step="1" aria-label="人数">
                <button type="button" class="btn btn-outline-secondary" data-action="increment" aria-label="人数を増やす">＋</button>
            </div>
        </div>
        <div class="warikan-group-row">
            <span class="warikan-label">割り方</span>
            <div class="btn-group warikan-mode" role="group" aria-label="割り方">
                <button type="button" class="btn btn-outline-success" data-mode="ratio">比率</button>
                <button type="button" class="btn btn-outline-success" data-mode="fixed">固定額</button>
            </div>
        </div>
        <div class="warikan-group-row" data-show="ratio">
            <span class="warikan-label">比率</span>
            <input type="number" class="form-control" data-field="ratio" inputmode="decimal" min="0" step="0.1" aria-label="比率">
        </div>
        <div class="warikan-group-row" data-show="fixed">
            <span class="warikan-label">固定額</span>
            <div class="input-group">
                <input type="number" class="form-control" data-field="fixed" inputmode="numeric" min="0" step="1" aria-label="1人あたりの固定額">
                <span class="input-group-text">円/人</span>
            </div>
        </div>
    </div>
</template>

@endsection
