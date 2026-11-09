@extends('layouts.common')
@section('title', '雨音コードプレイヤー')
@section('description', '始まりのコードを選ぶと、相性のよい次のコードを候補に出し、ループで鳴らしながらコード進行を組み立てられます。王道進行などの定番も、雨音・レコードノイズ・ゆるいビートを重ねて lofi の雰囲気で聴けます。')
@push('head')
    @vite('resources/ts/laravel/tools/chord-player.ts')
@endpush
@section('content')

{{-- 音はブラウザの中で合成して鳴らす（音のファイルも入力もサーバーに送らない）。入力と設定は localStorage（chord-player:v1）に残す --}}
<div class="container chord-container">
    <header class="chord-window">
        <h1 class="chord-title font-heading">雨音コードプレイヤー</h1>
        <p class="chord-lead mb-0">
            始まりのコードを選ぶと、相性のよい次のコードを候補に出します。選んだところまでをエレピの音でくり返し鳴らすので、聴きくらべながらコード進行を組み立てられます。雨音・レコードノイズ・ゆるいビートも重ねられます。
        </p>
    </header>

    {{-- 候補は lib/chord-suggest.ts（よく使われる流れの表から、確からしいキーを考えて出す） --}}
    <section class="chord-card-panel" aria-labelledby="chord-builder-heading">
        <h2 class="chord-heading" id="chord-builder-heading">1 つずつ選んで組み立てる</h2>

        <div class="chord-builder-options">
            <div>
                <label class="form-label" for="chord-start-root">始まりのコード</label>
                <div class="chord-start">
                    <select class="form-select" id="chord-start-root">
                        @foreach (['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as $pitch => $name)
                            <option value="{{ $pitch }}" @selected($name === 'A')>{{ $name }}</option>
                        @endforeach
                    </select>
                    <div class="btn-group" role="group" aria-label="始まりのコードの種類">
                        <input type="radio" class="btn-check" name="chord-start-kind" id="chord-start-maj" value="maj">
                        <label class="btn btn-outline-success" for="chord-start-maj">メジャー</label>
                        <input type="radio" class="btn-check" name="chord-start-kind" id="chord-start-min" value="min" checked>
                        <label class="btn btn-outline-success" for="chord-start-min">マイナー</label>
                    </div>
                </div>
            </div>
            <fieldset>
                <legend class="form-label fs-6">いくつでくり返すか</legend>
                <div class="btn-group">
                    @foreach ([2, 4] as $length)
                        <input type="radio" class="btn-check" name="chord-length" id="chord-length-{{ $length }}" value="{{ $length }}" @checked($length === 4)>
                        <label class="btn btn-outline-success" for="chord-length-{{ $length }}">{{ $length }} つ</label>
                    @endforeach
                </div>
            </fieldset>
            <fieldset>
                <legend class="form-label fs-6">響き</legend>
                <div class="btn-group">
                    @foreach (['triad' => 'シンプル', 'seventh' => 'おしゃれ', 'ninth' => 'もっと'] as $style => $label)
                        <input type="radio" class="btn-check" name="chord-style" id="chord-style-{{ $style }}" value="{{ $style }}" @checked($style === 'seventh')>
                        <label class="btn btn-outline-success" for="chord-style-{{ $style }}">{{ $label }}</label>
                    @endforeach
                </div>
            </fieldset>
        </div>
        <p class="chord-help mt-1 mb-0">響きは、シンプル＝C・Am、おしゃれ＝Cmaj7・Am7（lofi 向き）、もっと＝Cmaj9・Am9 のような書き方です。</p>

        <div class="chord-slots mt-3" id="chord-slots"></div>

        <h3 class="chord-subheading mt-3" id="chord-suggestions-heading" aria-live="polite"></h3>
        <div class="chord-suggestions" id="chord-suggestions"></div>

        <div class="chord-builder-actions mt-3">
            <button type="button" class="btn chord-play" data-chord-play aria-pressed="false">▶ 鳴らす</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="chord-undo">1 つ戻す</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="chord-reset">最初から</button>
        </div>
        <p class="chord-help mt-2 mb-0">選んだところまでをくり返し鳴らします。鳴らしたまま候補を押して、聴きくらべられます。</p>
    </section>

    <section class="chord-card-panel" aria-labelledby="chord-progression-label">
        <label class="form-label fw-bold" id="chord-progression-label" for="chord-progression">コード進行（直接入力・定番から選ぶ）</label>
        <input type="text" class="form-control chord-input" id="chord-progression" maxlength="300" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="chord-progression-help">
        <p class="chord-help mt-1 mb-0" id="chord-progression-help">上で組み立てた進行もここに入ります。空白・カンマ・矢印（→）で区切ります。分数コード（C/E）や、M7・Δ・-7・ø などの書き方にも対応しています。</p>
        <p class="chord-error" id="chord-error" role="status" hidden></p>

        <h2 class="chord-heading mt-3">定番の進行</h2>
        <div id="chord-presets"></div>
    </section>

    <section class="chord-card-panel" aria-label="鳴らし方">
        <div class="chord-controls">
            <button type="button" class="btn chord-play" data-chord-play aria-pressed="false">▶ 鳴らす</button>
            <div class="chord-slider">
                <label class="form-label" for="chord-bpm">テンポ（BPM）</label>
                <output class="chord-slider-value" for="chord-bpm" id="chord-bpm-value">72</output>
                <input type="range" class="form-range" id="chord-bpm" min="50" max="140" step="1" value="72">
            </div>
        </div>

        <div class="chord-settings mt-3">
            <div>
                <label class="form-label" for="chord-bars">1 つのコードの長さ</label>
                <select class="form-select" id="chord-bars">
                    <option value="1">1 小節</option>
                    <option value="2" selected>2 小節</option>
                </select>
            </div>
            <div>
                <label class="form-label" for="chord-pattern">弾き方</label>
                <select class="form-select" id="chord-pattern">
                    <option value="hold">のばす</option>
                    <option value="comp" selected>lofi っぽく刻む</option>
                </select>
            </div>
            <div>
                <label class="form-label" for="chord-transpose">キー（移調）</label>
                <select class="form-select" id="chord-transpose">
                    @for ($i = -6; $i <= 6; $i++)
                        <option value="{{ $i }}" @selected($i === 0)>{{ $i === 0 ? '元のキー' : sprintf('%+d 半音', $i) }}</option>
                    @endfor
                </select>
            </div>
        </div>

        <fieldset class="mt-3">
            <legend class="form-label fs-6">重ねる音</legend>
            <div class="chord-toggles">
                @foreach (['rain' => ['雨音', true], 'crackle' => ['レコードノイズ', true], 'beat' => ['ビート（ブラシ）', false], 'bass' => ['ベース', true]] as $key => [$label, $checked])
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" id="chord-{{ $key }}" @checked($checked)>
                        <label class="form-check-label" for="chord-{{ $key }}">{{ $label }}</label>
                    </div>
                @endforeach
            </div>
        </fieldset>
        <p class="chord-help mt-2 mb-0">iPhone・iPad は、消音モードにしていると音が出ないことがあります。</p>
    </section>

    <section class="chord-card-panel" aria-label="コードと鍵盤">
        <div class="chord-cards" id="chord-cards"></div>
        <div class="chord-keyboard-scroll mt-3">
            <div class="chord-keyboard" id="chord-keyboard" aria-hidden="true"></div>
        </div>
        <p class="chord-help mt-2 mb-0">
            止めているときは、カードを押すとそのコードだけを鳴らせます。鍵盤の<span class="chord-legend is-on">緑</span>がコードの音、<span class="chord-legend is-bass">青</span>がベースの音です。
        </p>
    </section>

    <section class="chord-card-panel" aria-labelledby="chord-copy-heading">
        <h2 class="chord-heading" id="chord-copy-heading">コード進行をコピー</h2>
        <div class="chord-copy">
            <code class="chord-copy-text" id="chord-copy-plain"></code>
            <button type="button" class="btn btn-success btn-sm" data-copy-target="chord-copy-plain">コピー</button>
        </div>
        <h3 class="chord-subheading mt-3">AI 作曲サービスの歌詞欄に書く形</h3>
        <div class="chord-copy">
            <code class="chord-copy-text" id="chord-copy-hint"></code>
            <button type="button" class="btn btn-success btn-sm" data-copy-target="chord-copy-hint">コピー</button>
        </div>
        <p class="chord-help mt-2 mb-0">
            移調したときは、移調したあとのコードで書き出します。AI 作曲サービスはコード進行を「ヒント」として受け取るため、そのとおりになるとは限りません。
        </p>
    </section>

    <p class="chord-help text-center">
        音はお使いのブラウザの中で作って鳴らし、入力した内容はサーバーに送りません。<br>
        コード進行と設定は、次に開いたときのために、お使いのブラウザにだけ残します。
    </p>
</div>

@endsection
