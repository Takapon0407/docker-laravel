@extends('layouts.common')
@section('title', '便利ツール')
@section('description', '割り勘の計算や勉強会で使える匿名の質問ボード、JSON 整形・日時の変換・正規表現チェックなど、ブラウザですぐに使える便利ツールの一覧です。一般向け・開発向けと、入力したデータを外に送らない「端末内で完結」・「サーバーに保存」で絞り込めます。')
@section('content')

<div class="container tools-container">
    <h1 class="tools-title font-heading">便利ツール</h1>
    <p class="tools-lead">ブラウザですぐに使える、ちょっとした便利ツールです。ログインは要りません。</p>

    {{-- 絞り込みは CSS だけで行う（選んだラジオボタンに合わせて、_tools.scss でカードを隠す） --}}
    <div class="tools-filters">
        <fieldset class="tools-filter">
            <legend class="tools-filter-label">用途</legend>
            <div class="btn-group">
                <input type="radio" class="btn-check" name="tools-purpose" id="tools-purpose-all" value="all" checked>
                <label class="btn btn-outline-success btn-sm" for="tools-purpose-all">すべて</label>
                <input type="radio" class="btn-check" name="tools-purpose" id="tools-purpose-general" value="general">
                <label class="btn btn-outline-success btn-sm" for="tools-purpose-general">一般向け</label>
                <input type="radio" class="btn-check" name="tools-purpose" id="tools-purpose-dev" value="dev">
                <label class="btn btn-outline-success btn-sm" for="tools-purpose-dev">開発向け</label>
            </div>
        </fieldset>
        <fieldset class="tools-filter">
            <legend class="tools-filter-label">データの扱い</legend>
            <div class="btn-group">
                <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-all" value="all" checked>
                <label class="btn btn-outline-success btn-sm" for="tools-filter-all">すべて</label>
                <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-local" value="local">
                <label class="btn btn-outline-success btn-sm" for="tools-filter-local">端末内で完結</label>
                <input type="radio" class="btn-check" name="tools-filter" id="tools-filter-server" value="server">
                <label class="btn btn-outline-success btn-sm" for="tools-filter-server">サーバーに保存</label>
            </div>
        </fieldset>
    </div>

    @php
        $purposes = ['general' => '一般向け', 'dev' => '開発向け'];
        $storages = ['local' => '端末内で完結', 'server' => 'サーバーに保存'];
    @endphp
    <ul class="tools-list">
        @foreach (config('tools') as $tool)
            @if (! isset($tool['enabled_by']) || config($tool['enabled_by']))
                <li data-purpose="{{ $tool['purpose'] }}" data-storage="{{ $tool['storage'] }}">
                    <a class="tools-card" href="{{ route($tool['route']) }}">
                        <ul class="tools-tags" aria-label="分類">
                            <li class="tools-tag">{{ $purposes[$tool['purpose']] }}</li>
                            <li class="tools-tag is-{{ $tool['storage'] }}">{{ $storages[$tool['storage']] }}</li>
                        </ul>
                        <h2 class="tools-card-title font-heading">{{ $tool['title'] }}</h2>
                        <p class="tools-card-text">{{ $tool['description'] }}</p>
                        <p class="tools-card-note">{{ $tool['storage_note'] }}</p>
                    </a>
                </li>
            @endif
        @endforeach
    </ul>
    <p class="tools-empty">条件に合うツールはありません。</p>
</div>

@endsection
