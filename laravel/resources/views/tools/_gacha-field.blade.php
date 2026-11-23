{{-- ガチャ天井計算機の入力欄 1 つ（ラベル・単位・説明・エラーの文）。type="number" は不正な文字が空になり空欄と区別できないため text --}}
@php
    $describedBy = trim(($help ?? null ? "gacha-{$id}-help " : '')."gacha-{$id}-error");
@endphp
<div class="gacha-field" id="gacha-{{ $id }}-field" @if ($hidden ?? false) hidden @endif>
    <label class="form-label" for="gacha-{{ $id }}">{{ $label }}</label>
    <div class="input-group input-group-lg">
        <input type="text" class="form-control" id="gacha-{{ $id }}" inputmode="{{ $decimal ? 'decimal' : 'numeric' }}" autocomplete="off" value="{{ $value ?? '' }}" placeholder="{{ $placeholder ?? '' }}" aria-describedby="{{ $describedBy }}" data-gacha-field="{{ $id }}">
        <span class="input-group-text">{{ $unit }}</span>
    </div>
    @if ($help ?? null)
        <p class="devtool-help mt-1 mb-0" id="gacha-{{ $id }}-help">{{ $help }}</p>
    @endif
    <p class="gacha-error" id="gacha-{{ $id }}-error" hidden></p>
</div>
