@extends('layouts.common')
@section('title', 'カウントダウン')
@section('description', '今年の残り時間と、これから 1 年の祝日・自分で決めた記念日などまで、あと何日かを表示します。自分で足した日は、お使いのブラウザの中にだけ残します。')
{{-- ホーム画面にはカウントダウンのアプリとして追加する（アイコンから開くと、足した日がすぐ見られる） --}}
@section('manifest', asset('manifest-countdown.json'))
@push('head')
    @vite('resources/ts/laravel/tools/countdown.ts')
@endpush
@section('content')

{{-- 計算はブラウザ内だけで行う（自分で足した日はサーバーに送らず、localStorage にだけ残す） --}}
<div class="container countdown-container">
    <h1 class="countdown-title font-heading">カウントダウン</h1>
    <p class="countdown-lead">今年の残りと、祝日や自分で決めた日まで、あとどれくらいかを表示します。</p>

    {{-- 1 秒ごとに書き換える。読み上げが続かないよう aria-live は付けない --}}
    <section class="countdown-card">
        <h2 class="countdown-heading" id="countdown-year-title">今年の残り</h2>
        <p class="countdown-main" id="countdown-year-main"></p>
        <div class="countdown-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="countdown-year-progress">
            <div class="countdown-progress-bar" id="countdown-year-progress-bar"></div>
        </div>
        <p class="countdown-help mt-1 mb-0" id="countdown-year-label"></p>
    </section>

    <section class="countdown-card">
        <h2 class="countdown-heading">次の祝日</h2>
        <p class="countdown-basis" id="countdown-holiday-basis"></p>
        <p class="countdown-main" id="countdown-holiday-main"></p>
        <h3 class="countdown-subheading">これから 1 年の祝日</h3>
        <ul class="countdown-list" id="countdown-holidays"></ul>
        <details class="countdown-more" id="countdown-holidays-more" hidden>
            <summary></summary>
            <ul class="countdown-list" id="countdown-holidays-rest"></ul>
        </details>
        <p class="countdown-help mb-0">
            祝日は「<a href="https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html" target="_blank" rel="noopener noreferrer">国民の祝日について</a>」（内閣府）の決まりで計算しています。振替休日と、祝日にはさまれた休日も入ります。春分の日・秋分の日は計算による予測で、正式には前の年の 2 月に官報で発表されます。
        </p>
    </section>

    <section class="countdown-card">
        <h2 class="countdown-heading">自分で決めた日</h2>
        <ul class="countdown-list" id="countdown-custom"></ul>
        <p class="countdown-help" id="countdown-custom-empty">まだありません。誕生日や記念日など、毎年くる日を足せます。</p>
        <form class="countdown-form" id="countdown-form" novalidate>
            <div class="countdown-form-name">
                <label class="form-label" for="countdown-name">名前</label>
                <input type="text" class="form-control" id="countdown-name" maxlength="30" placeholder="例：結婚記念日" autocomplete="off" required>
            </div>
            <div class="countdown-form-date">
                <span class="form-label d-block" aria-hidden="true">日付</span>
                <label class="visually-hidden" for="countdown-month">月</label>
                <select class="form-select" id="countdown-month" required><option value="">--</option></select>
                <span>月</span>
                <label class="visually-hidden" for="countdown-day">日</label>
                <select class="form-select" id="countdown-day" required><option value="">--</option></select>
                <span>日</span>
            </div>
            <button type="submit" class="btn btn-dark countdown-form-submit">足す</button>
        </form>
        <p class="countdown-error" id="countdown-error" role="alert" hidden></p>
        <p class="countdown-help mt-2 mb-0">足した日は、この端末のブラウザの中にだけ残し、サーバーには送りません（最大 20 件）。</p>
    </section>
</div>

@endsection
