@extends('layouts.common')
@section('content')
@vite('resources/ts/laravel/hobbies.ts')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap" rel="stylesheet">

<div class="container hobbies-container">

    {{-- ========== メインタブ ========== --}}
    <ul class="nav nav-tabs hobby-main-tabs mb-4" id="hobbyTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active font-cherry" id="tab-photo-btn"
                data-bs-toggle="tab" data-bs-target="#tab-photo"
                type="button" role="tab"
                aria-controls="tab-photo" aria-selected="true">
                📸 写真
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link font-cherry" id="tab-music-btn"
                data-bs-toggle="tab" data-bs-target="#tab-music"
                type="button" role="tab"
                aria-controls="tab-music" aria-selected="false">
                🎵 音楽
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link font-cherry" id="tab-games-btn"
                data-bs-toggle="tab" data-bs-target="#tab-games"
                type="button" role="tab"
                aria-controls="tab-games" aria-selected="false">
                🎮 ゲーム
            </button>
        </li>
    </ul>

    <div class="tab-content" id="hobbyTabContent">

        {{-- ========== 写真タブ ========== --}}
        <div class="tab-pane fade show active" id="tab-photo" role="tabpanel" aria-labelledby="tab-photo-btn">

            <div class="content-box">
                <h2 class="font-cherry">よこのしゃしん</h2>
                <div class="sub-content">
                    <div class="photo-swiper swiper">
                        <div class="swiper-wrapper">
                            {{-- 正方形の写真も横長のスライダーに収まるため、ここに含める --}}
                            @foreach ($photos as $photo)
                                @if (in_array($photo['orientation'], ['landscape', 'square'], true))
                                    <div class="swiper-slide">
                                        <img class="slide-photo" src="{{ $photo['url'] }}" alt="{{ $photo['filename'] }}">
                                    </div>
                                @endif
                            @endforeach
                        </div>
                        <div class="swiper-pagination"></div>
                        <div class="swiper-button-prev"></div>
                        <div class="swiper-button-next"></div>
                    </div>
                </div>
            </div>

            <div class="content-box">
                <h2 class="font-cherry">たてのしゃしん</h2>
                <div class="sub-content">
                    <div class="photo-swiper swiper">
                        <div class="swiper-wrapper">
                            @foreach ($photos as $photo)
                                @if ($photo['orientation'] === 'portrait')
                                    <div class="swiper-slide">
                                        <img class="slide-photo" src="{{ $photo['url'] }}" alt="{{ $photo['filename'] }}">
                                    </div>
                                @endif
                            @endforeach
                        </div>
                        <div class="swiper-pagination"></div>
                        <div class="swiper-button-prev"></div>
                        <div class="swiper-button-next"></div>
                    </div>
                </div>
            </div>

            <div class="content-box">
                <h2 class="font-cherry">もってるカメラ・レンズ</h2>
                <div class="sub-content">
                    <div class="sub-left-content">
                        <h3 class="font-cherry">カメラ</h3>
                        <ul>
                            <li>Sony α7R3</li>
                        </ul>
                    </div>
                    <div class="sub-right-content">
                        <h3 class="font-cherry">レンズ</h3>
                        <ul>
                            <li>SEL1635Z</li>
                            <li>SEL50F18</li>
                            <li>SEL85F18</li>
                        </ul>
                    </div>
                </div>
            </div>

        </div>{{-- /tab-photo --}}

        {{-- ========== 音楽タブ ========== --}}
        <div class="tab-pane fade" id="tab-music" role="tabpanel" aria-labelledby="tab-music-btn">

            <div class="content-box">
                <h2 class="font-cherry">がっき</h2>
                <div class="sub-content">
                    <ul class="hobby-list">
                        <li>🎹 ピアノ</li>
                        <li>🎸 エレキギター</li>
                        <li>🎸 アコースティックギター</li>
                        <li>🎵 カリンバ</li>
                    </ul>
                </div>
            </div>

            <div class="content-box">
                <h2 class="font-cherry">DAW</h2>
                <div class="sub-content">
                    <ul class="hobby-list">
                        <li>🎛️ Cubase 9</li>
                        <li>🎛️ Logic Pro</li>
                    </ul>
                </div>
            </div>

        </div>{{-- /tab-music --}}

        {{-- ========== ゲームタブ ========== --}}
        <div class="tab-pane fade" id="tab-games" role="tabpanel" aria-labelledby="tab-games-btn">

            {{-- 今やっているゲーム --}}
            <div class="content-box">
                <h2 class="font-cherry">やっているげーむ</h2>
                <div class="sub-content">
                    <div class="sub-left-content">
                        <ul>
                            @foreach ($playingGames as $game)
                                <x-game-item :game="$game" />
                            @endforeach
                        </ul>
                    </div>
                </div>
            </div>

            {{-- 昔やったゲーム（プラットフォームタブ） --}}
            <div class="content-box">
                <h2 class="font-cherry">やっていたげーむ</h2>

                <ul class="nav nav-pills platform-tabs mb-3 flex-wrap" id="platformTabs" role="tablist">
                    @foreach ($pastGames as $id => $platform)
                        <li class="nav-item" role="presentation">
                            <button class="nav-link {{ $loop->first ? 'active' : '' }} font-cherry"
                                id="platform-{{ $id }}-btn"
                                data-bs-toggle="pill" data-bs-target="#platform-{{ $id }}"
                                type="button" role="tab"
                                aria-controls="platform-{{ $id }}"
                                aria-selected="{{ $loop->first ? 'true' : 'false' }}">
                                {{ $platform['label'] }}
                            </button>
                        </li>
                    @endforeach
                </ul>

                <div class="tab-content platform-tab-content">
                    @foreach ($pastGames as $id => $platform)
                        <div class="tab-pane fade {{ $loop->first ? 'show active' : '' }}" id="platform-{{ $id }}" role="tabpanel" aria-labelledby="platform-{{ $id }}-btn">
                            <ul>
                                @foreach ($platform['games'] as $game)
                                    <x-game-item :game="$game" />
                                @endforeach
                            </ul>
                        </div>
                    @endforeach
                </div>{{-- /platform-tab-content --}}
            </div>{{-- /content-box やっていたゲーム --}}

            {{-- ミニゲームコーナー --}}
            <div class="content-box">
                <h2 class="font-cherry">いんすたんとげーむおきば</h2>
                <div class="sub-content">
                    <div class="sub-left-content">
                        <ul>
                            <li><a href="{{ url('/games/tetris') }}" target="_blank" rel="noopener noreferrer">テトリス</a>　参考: <a href="https://qiita.com/ryuichi1208/items/f9e6ac2b99bbe4fc82d3">7行テトリス</a></li>
                            <li><a href="{{ url('/games/puyo') }}" target="_blank" rel="noopener noreferrer">ぷよぷよ</a>　参考: <a href="https://qiita.com/yoitomakenouta/items/8b93d0b9dacf365ce0b1">10行ぷよぷよ</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            {{-- 自作ゲームコーナー --}}
            <div class="content-box">
                <h2 class="font-cherry">じさくげーむおきば</h2>
                <div class="sub-content">
                    <div class="sub-left-content">
                        <ul>
                            <li>今後作成&追加予定!</li>
                        </ul>
                    </div>
                </div>
            </div>

        </div>{{-- /tab-games --}}

    </div>{{-- /tab-content --}}
</div>
@endsection
