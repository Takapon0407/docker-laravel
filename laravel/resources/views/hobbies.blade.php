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
                            @foreach ($photos as $photo)
                                @if ($photo['orientation'] === 'landscape')
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
                            <li class="item-tooltip">
                                <a href="https://genshin.hoyoverse.com/ja/" target="_blank" rel="noopener noreferrer">原神
                                    <span class="item-tooltip-text">オープンワールドアクションRPG!</span>
                                </a>
                            </li>
                            <li class="item-tooltip">
                                <a href="https://hsr.hoyoverse.com/ja-jp/home" target="_blank" rel="noopener noreferrer">崩壊スターレイル
                                    <span class="item-tooltip-text">ターン制のRPG!</span>
                                </a>
                            </li>
                            <li class="item-tooltip">
                                <a href="https://www.arknights.jp/" target="_blank" rel="noopener noreferrer">アークナイツ
                                    <span class="item-tooltip-text">戦略的タワーディフェンスゲーム!</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {{-- 昔やったゲーム（プラットフォームタブ） --}}
            <div class="content-box">
                <h2 class="font-cherry">やっていたげーむ</h2>

                <ul class="nav nav-pills platform-tabs mb-3 flex-wrap" id="platformTabs" role="tablist">
                    @foreach ([
                        'ps'  => 'PS',
                        'gb'  => 'GB',
                        'gbc' => 'GBC',
                        'gba' => 'GBA',
                        'n64' => 'N64',
                        'ps2' => 'PS2',
                        'psp' => 'PSP',
                        'pc'  => 'PC',
                    ] as $id => $label)
                        <li class="nav-item" role="presentation">
                            <button class="nav-link {{ $id === 'ps' ? 'active' : '' }} font-cherry"
                                id="platform-{{ $id }}-btn"
                                data-bs-toggle="pill" data-bs-target="#platform-{{ $id }}"
                                type="button" role="tab"
                                aria-controls="platform-{{ $id }}"
                                aria-selected="{{ $id === 'ps' ? 'true' : 'false' }}">
                                {{ $label }}
                            </button>
                        </li>
                    @endforeach
                </ul>

                <div class="tab-content platform-tab-content">

                    <div class="tab-pane fade show active" id="platform-ps" role="tabpanel" aria-labelledby="platform-ps-btn">
                        <ul>
                            <li><a href="https://ja.wikipedia.org/wiki/%E3%81%8C%E3%82%93%E3%81%B0%E3%82%8C%E3%82%B4%E3%82%A8%E3%83%A2%E3%83%B3%E3%80%9C%E5%AE%87%E5%AE%99%E6%B5%B7%E8%B3%8A%E3%82%A2%E3%82%B3%E3%82%AE%E3%83%B3%E3%82%B0%E3%80%9C" target="_blank" rel="noopener noreferrer">がんばれゴエモン〜宇宙海賊アコギング〜</a></li>
                            <li><a href="https://www.gamecity.ne.jp/mf1" target="_blank" rel="noopener noreferrer">モンスターファーム</a></li>
                            <li>チョコボの不思議なダンジョン(<a href="https://ja.wikipedia.org/wiki/%E3%83%81%E3%83%A7%E3%82%B3%E3%83%9C%E3%81%AE%E4%B8%8D%E6%80%9D%E8%AD%B0%E3%81%AA%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B3" target="_blank" rel="noopener noreferrer">1</a>, <a href="https://ja.wikipedia.org/wiki/%E3%83%81%E3%83%A7%E3%82%B3%E3%83%9C%E3%81%AE%E4%B8%8D%E6%80%9D%E8%AD%B0%E3%81%AA%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B32" target="_blank" rel="noopener noreferrer">2</a>)</li>
                            <li><a href="https://ja.wikipedia.org/wiki/%E3%82%AF%E3%83%A9%E3%83%83%E3%82%B7%E3%83%A5%E3%83%BB%E3%83%90%E3%83%B3%E3%83%87%E3%82%A3%E3%82%AF%E3%83%BC_(%E3%82%B2%E3%83%BC%E3%83%A0)" target="_blank" rel="noopener noreferrer">クラッシュ・バンディクー1</a></li>
                            <li><a href="https://ja.wikipedia.org/wiki/ONE_PIECE_%E3%82%B0%E3%83%A9%E3%83%B3%E3%83%89%E3%83%90%E3%83%88%E3%83%AB!" target="_blank" rel="noopener noreferrer">ONE PIECE グランドバトル!</a></li>
                            <li><a href="https://www.youtube.com/watch?v=GlAQyzbC7WI" target="_blank" rel="noopener noreferrer">THE 将棋 SIMPLE 1500シリーズ</a></li>
                            <li><a href="https://www.jp.square-enix.com/dragonquest/psdqm12/top.html">ドラゴンクエストモンスターズ1・2 星降りの勇者と牧場の仲間たち</a></li>
                            <li><a href="https://www.youtube.com/watch?v=Q33_nTN4cqU" target="_blank" rel="noopener noreferrer">名探偵コナン</a></li>
                            <li><a href="https://www.konami.com/mg/archive/mgs/" target="_blank" rel="noopener noreferrer">メタルギアソリッド</a></li>
                            <li><a href="https://www.playstation.com/ja-jp/games/ape-escape/" target="_blank" rel="noopener noreferrer">サルゲッチュ</a></li>
                            <li><a href="https://www.gamecity.ne.jp/mf2/" target="_blank" rel="noopener noreferrer">モンスターファーム2</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-gb" role="tabpanel" aria-labelledby="platform-gb-btn">
                        <ul>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/tra/index.html" target="_blank" rel="noopener noreferrer">テトリス</a></li>
                            <li><a href="https://www.youtube.com/watch?v=XFldh_i8dG0" target="_blank" rel="noopener noreferrer">らんま1/2</a></li>
                            <li><a href="https://kirby.fandom.com/ja/wiki/%E6%98%9F%E3%81%AE%E3%82%AB%E3%83%BC%E3%83%93%E3%82%A3" target="_blank" rel="noopener noreferrer">星のカービィ</a></li>
                            <li><a href="https://www.nintendo.co.jp/character/mario/history/land2/index.html" target="_blank" rel="noopener noreferrer">スーパーマリオランド2 6つの金貨</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/k9j/index.html" target="_blank" rel="noopener noreferrer">カービィのピンボール</a></li>
                            <li><a href="https://www.youtube.com/watch?v=pKcKz9IY6rU" target="_blank" rel="noopener noreferrer">ドンキーコング</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/akbj/index.html" target="_blank" rel="noopener noreferrer">星のカービィ2</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/ytj/index.html" target="_blank" rel="noopener noreferrer">ドンキーコングGB</a></li>
                            <li><a href="https://www.youtube.com/watch?v=srGVWjGZVAo" target="_blank" rel="noopener noreferrer">ミニ四駆GB レッツ&ゴー!!</a></li>
                            <li><a href="https://www.youtube.com/watch?v=12jNWH2RaBw" target="_blank" rel="noopener noreferrer">もんすたあ★レース</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/apsj/index.html" target="_blank" rel="noopener noreferrer">ポケットモンスター ピカチュウ</a></li>
                            <li><a href="https://store-jp.nintendo.com/list/software/70010000019662.html" target="_blank" rel="noopener noreferrer">DQM テリーのワンダーランド</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/acxj/index.html" target="_blank" rel="noopener noreferrer">ポケモンカードGB</a></li>
                            <li><a href="https://www.pokemon.co.jp/game/other/gbc-pp/?inc=other" target="_blank" rel="noopener noreferrer">ポケモンピンボール</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-gbc" role="tabpanel" aria-labelledby="platform-gbc-btn">
                        <ul>
                            <li><a href="https://www.pokemon.co.jp/game/other/gbc-gs/" target="_blank" rel="noopener noreferrer">ポケットモンスター 金・銀</a></li>
                            <li><a href="https://www.youtube.com/watch?v=1cldsE1PSTE" target="_blank" rel="noopener noreferrer">真・女神転生デビルチルドレン 〜黒の書〜</a></li>
                            <li><a href="https://store-jp.nintendo.com/list/software/70010000016287.html" target="_blank" rel="noopener noreferrer">ぷよぷよ通</a></li>
                            <li><a href="https://www.youtube.com/watch?v=pUJCqTo-Ea8&list=PL9FpUm5FSLluWho4HkfEtdM_Aaq9tOFqV&index=7" target="_blank" rel="noopener noreferrer">大工の源さん カチカチのトンカチがカチ</a></li>
                            <li><a href="https://www.youtube.com/watch?v=ymfXj4Fesko&list=PLPZxDfhvP5jbgoZFLZ_fHNy3cKi4YsYVH" target="_blank" rel="noopener noreferrer">DQM2 イルとルカの大冒険</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/kkkj/index.html" target="_blank" rel="noopener noreferrer">コロコロカービィ</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/bm8j/index.html" target="_blank" rel="noopener noreferrer">マリオテニスGB</a></li>
                            <li><a href="https://www.pokemon.co.jp/game/other/gbc-crystal/" target="_blank" rel="noopener noreferrer">ポケットモンスター クリスタルバージョン</a></li>
                            <li><a href="https://www.youtube.com/watch?v=ebXI4ckhEpE&list=PLO_RLBK_tVgo0xOn8Z83qZEkQZowYpiV9&index=1" target="_blank" rel="noopener noreferrer">シルバニアファミリー2 〜色づく森のファンタジー〜</a></li>
                            <li><a href="https://www.nintendo.co.jp/n02/dmg/b86j/index.html" target="_blank" rel="noopener noreferrer">とっとこハム太郎2 ハムちゃんず大集合でちゅ</a></li>
                            <li><a href="https://www.youtube.com/watch?v=0Jt3B70ufaI" target="_blank" rel="noopener noreferrer">ハムスター倶楽部</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-gba" role="tabpanel" aria-labelledby="platform-gba-btn">
                        <ul>
                            <li><a href="https://www.nintendo.co.jp/n08/amaj/index.html" target="_blank" rel="noopener noreferrer">スーパーマリオアドバンスシリーズ</a></li>
                            <li><a href="https://www.youtube.com/watch?v=szJHizb6FT0&list=PLV_adm-nIk-eixejlsyQJmjr7IM0bI58G&index=2" target="_blank" rel="noopener noreferrer">ハリーポッターと賢者の石 GBA</a></li>
                            <li><a href="https://www.pokemon.co.jp/game/gba/rs/" target="_blank" rel="noopener noreferrer">ポケットモンスター ルビー・サファイア・エメラルド</a></li>
                            <li><a href="https://www.jp.square-enix.com/game/detail/chocoboland/" target="_blank" rel="noopener noreferrer">チョコボランド</a></li>
                            <li><a href="https://www.youtube.com/watch?v=TB-D0VE8fCo" target="_blank" rel="noopener noreferrer">ことばのパズル もじぴったん アドバンス</a></li>
                            <li><a href="https://www.nintendo.co.jp/n08/kirby/index.html" target="_blank" rel="noopener noreferrer">星のカービィ 夢の泉デラックス</a></li>
                            <li><a href="https://www.jp.square-enix.com/dragonquest/ch/top.html" target="_blank" rel="noopener noreferrer">ドラゴンクエストモンスターズ キャラバンハート</a></li>
                            <li><a href="https://www.youtube.com/watch?v=ixx4zdVog6M" target="_blank" rel="noopener noreferrer">デュエル・マスターズ</a></li>
                            <li><a href="https://www.jp.square-enix.com/game/detail/smdq/" target="_blank" rel="noopener noreferrer">スライムもりもりドラゴンクエスト 衝撃のしっぽ団</a></li>
                            <li><a href="https://www.nintendo.co.jp/character/mario/history/mr_rpg/index.html" target="_blank" rel="noopener noreferrer">マリオ&ルイージRPG</a></li>
                            <li><a href="https://www.nintendo.co.jp/n08/rzwj/index.html" target="_blank" rel="noopener noreferrer">まわるメイドインワリオ</a></li>
                            <li><a href="https://www.nintendo.co.jp/n08/bk8j/index.html" target="_blank" rel="noopener noreferrer">星のカービィ 鏡の大迷宮</a></li>
                            <li><a href="https://www.pokemon.co.jp/game/ds/dungeon/" target="_blank" rel="noopener noreferrer">ポケモン不思議のダンジョン 赤の救助隊</a></li>
                            <li><a href="https://www.nintendo.co.jp/n08/brij/index.html" target="_blank" rel="noopener noreferrer">リズム天国</a></li>
                            <li><a href="https://onepiece-yume.gorillawiki.jp/" target="_blank" rel="noopener noreferrer">ONE PIECE 夢のルフィ海賊段誕生</a></li>
                            <li><a href="https://www.youtube.com/watch?v=1OWwUx46mZQ" target="_blank" rel="noopener noreferrer">ONE PIECE 幻のグランドライン冒険紀</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-n64" role="tabpanel" aria-labelledby="platform-n64-btn">
                        <ul>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nsmj/index.html" target="_blank" rel="noopener noreferrer">スーパーマリオ６４</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nmkj/index.html" target="_blank" rel="noopener noreferrer">マリオカート６４</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nysj/index.html" target="_blank" rel="noopener noreferrer">ヨッシーストーリー</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_ngej/index.html" target="_blank" rel="noopener noreferrer">ゴールデン・アイ 007</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nfxj/index.html" target="_blank" rel="noopener noreferrer">スターフォックス64</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_clbj/index.html" target="_blank" rel="noopener noreferrer">マリオパーティ</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nbkj/index.html" target="_blank" rel="noopener noreferrer">バンジョーとカズーイの大冒険</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/zelda/index.html" target="_blank" rel="noopener noreferrer">ゼルダの伝説 時のオカリナ</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_npsj/index.html" target="_blank" rel="noopener noreferrer">チョロＱ 64</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nmwj/index.html" target="_blank" rel="noopener noreferrer">マリオパーティ２</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_ndoj/index.html" target="_blank" rel="noopener noreferrer">ドンキーコング６４</a></li>
                            <li><a href="https://www.bokumono.com/sub/bokumono2.php" target="_blank" rel="noopener noreferrer">牧場物語２</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nalj/index.html" target="_blank" rel="noopener noreferrer">大乱闘 スマッシュブラザーズ</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nb7j/index.html" target="_blank" rel="noopener noreferrer">バンジョーとカズーイの大冒険 2</a></li>
                            <li><a href="https://www.spike-chunsoft.co.jp/games/shiren2/" target="_blank" rel="noopener noreferrer">風来のシレン2 鬼襲来！シレン城</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_npdj/index.html" target="_blank" rel="noopener noreferrer">パーフェクトダーク</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nk4j/index.html" target="_blank" rel="noopener noreferrer">星のカービィ６４</a></li>
                            <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nmvj/index.html" target="_blank" rel="noopener noreferrer">マリオパーティ3</a></li>
                            <li><a href="https://www.nicovideo.jp/watch/sm4900873" target="_blank" rel="noopener noreferrer">ウッチャンナンチャンの炎のチャレンジャー 電流イライラ棒 64</a></li>
                            <li><a href="https://www.youtube.com/watch?v=COAsmgc7PoE" target="_blank" rel="noopener noreferrer">ハムスター物語64</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-ps2" role="tabpanel" aria-labelledby="platform-ps2-btn">
                        <ul>
                            <li><a href="https://www.famitsu.com/news/202108/03229085.html" target="_blank" rel="noopener noreferrer">真・三國無双1</a></li>
                            <li><a href="https://www.jp.square-enix.com/kingdom/timeline/index.html" target="_blank" rel="noopener noreferrer">キングダム ハーツ シリーズ</a></li>
                            <li><a href="https://www.youtube.com/watch?v=sBBH11LDhYE&list=PLDm909D4IX2IBgQcSDxCtWpQwstcW81Gg" target="_blank" rel="noopener noreferrer">ぼくのなつやすみ2 海の冒険篇</a></li>
                            <li><a href="https://www.youtube.com/watch?v=em4Bl46s55Y" target="_blank" rel="noopener noreferrer">ドラゴンクエストキャラクターズ トルネコの大冒険3</a></li>
                            <li><a href="https://www.youtube.com/watch?v=FB666ctDjGo" target="_blank" rel="noopener noreferrer">ラチェット&クランク1~4</a></li>
                            <li>ファイナルファンタジー (<a href="https://www.jp.square-enix.com/ffx_x-2HD/#introduction" target="_blank" rel="noopener noreferrer">X-2</a>, <a href="https://www.jp.square-enix.com/ff12_tza/" target="_blank" rel="noopener noreferrer">Ⅻ</a>)</li>
                            <li><a href="http://www.tecmo.co.jp/product/mf4/" target="_blank" rel="noopener noreferrer">モンスターファーム4</a></li>
                            <li><a href="https://www.youtube.com/watch?v=kNEBIV-jkiQ&t=96s" target="_blank" rel="noopener noreferrer">NARUTO ナルティメットヒーローシリーズ 1~3</a></li>
                            <li>ドラゴンクエスト <a href="https://www.jp.square-enix.com/game/detail/dq5/" target="_blank" rel="noopener noreferrer">V</a>, <a href="https://www.jp.square-enix.com/game/detail/dq8/" target="_blank" rel="noopener noreferrer">VIII</a></li>
                            <li><a href="https://www.youtube.com/watch?v=GNGagTajxF0" target="_blank" rel="noopener noreferrer">金色のガッシュベル!! 友情タッグバトル</a></li>
                            <li><a href="http://www.gust.co.jp/products/a6/" target="_blank" rel="noopener noreferrer">イリスのアトリエ エターナルマナ</a></li>
                            <li><a href="https://www.jp.square-enix.com/game/detail/itastsp/" target="_blank" rel="noopener noreferrer">ドラクエ&FF in いただきストリートSpecial</a></li>
                            <li>モンスターハンター <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterg/" target="_blank" rel="noopener noreferrer">G</a>, <a href="https://www.capcom-games.com/product/ja-jp/monsterhunter2/" target="_blank" rel="noopener noreferrer">2</a></li>
                            <li><a href="http://www.tv-toa.jp/" target="_blank" rel="noopener noreferrer">テイルズ オブ ジ アビス</a></li>
                            <li><a href="https://www.jp.square-enix.com/game/detail/yangus/" target="_blank" rel="noopener noreferrer">ドラゴンクエスト 少年ヤンガスと不思議のダンジョン</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-psp" role="tabpanel" aria-labelledby="platform-psp-btn">
                        <ul>
                            <li>モンスターハンター (<a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable/" target="_blank" rel="noopener noreferrer">P</a>, <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable2nd/" target="_blank" rel="noopener noreferrer">2</a>, <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable2ndg/" target="_blank" rel="noopener noreferrer">2G</a>, <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable3rd/" target="_blank" rel="noopener noreferrer">3</a>)</li>
                            <li><a href="https://store.playstation.com/ja-jp/product/JP9000-CUSA37872_00-UCJS100210000000" target="_blank" rel="noopener noreferrer">ブレイドダンサー</a></li>
                            <li><a href="https://www.amazon.co.jp/dp/B000EP5GAU" target="_blank" rel="noopener noreferrer">ドラクエ&FF in いただきストリートポータブル</a></li>
                            <li><a href="https://www.amazon.co.jp/dp/B000FGUNHY" target="_blank" rel="noopener noreferrer">ブレイブ ストーリー 新たなる旅人</a></li>
                            <li><a href="https://www.jp.square-enix.com/game/detail/fft_shi/" target="_blank" rel="noopener noreferrer">ファイナルファンタジータクティクス 獅子戦争</a></li>
                            <li><a href="https://www.jp.square-enix.com/game/detail/ccff7/" target="_blank" rel="noopener noreferrer">クライシス コア ファイナルファンタジーVII</a></li>
                            <li><a href="https://www.playstation.com/ja-jp/games/no-heroes-allowed/" target="_blank" rel="noopener noreferrer">勇者のくせになまいきだ。</a></li>
                            <li><a href="https://tales-ch.jp/titles/index.php?series_id=17" target="_blank" rel="noopener noreferrer">テイルズ オブ ザ ワールド レディアント マイソロジー2</a></li>
                            <li><a href="https://www.famitsu.com/sp/110530_blackrockshooter/" target="_blank" rel="noopener noreferrer">ブラック★ロックシューター THE GAME</a></li>
                        </ul>
                    </div>

                    <div class="tab-pane fade" id="platform-pc" role="tabpanel" aria-labelledby="platform-pc-btn">
                        <ul>
                            <li><a href="https://maplestory.nexon.co.jp/" target="_blank" rel="noopener noreferrer">メイプルストーリー（ビッグバン前まで）</a></li>
                            <li><a href="https://talesweaver.nexon.co.jp/" target="_blank" rel="noopener noreferrer">テイルズウィーバー</a></li>
                            <li><a href="https://genshin.moonrabi.jp/" target="_blank" rel="noopener noreferrer">幻想神域</a></li>
                            <li><a href="https://www.x-legend.com/jp/ashtale/" target="_blank" rel="noopener noreferrer">Ash Tale</a></li>
                            <li><a href="https://phantasystar.sega.jp/history/" target="_blank" rel="noopener noreferrer">ファンタシースターオンライン2</a></li>
                            <li><a href="https://store.steampowered.com/app/571740/Golf_It/?l=japanese" target="_blank" rel="noopener noreferrer">Golf It!</a></li>
                        </ul>
                    </div>

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
