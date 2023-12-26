@extends('layouts.common')
@section('content')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap" rel="stylesheet">
<div class="container">
    <div class="content-box">
        <h2 class="font-cherry">やっているげーむ</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <ul>
                    <li class="item-tooltip">
                        <a href="https://genshin.hoyoverse.com/ja/" target="_blank">原神
                            <span class="item-tooltip-text">原神はオープンワールドアクションRPGです。</span>
                        </a>
                    </li>
                    <li class="item-tooltip">
                        <a href="https://hsr.hoyoverse.com/ja-jp/home" target="_blank">崩壊スターレイル
                            <span class="item-tooltip-text">崩壊スターレイルはターン制のRPGです。</span>
                        </a>
                    </li>
                    <li class="item-tooltip">
                        <a href="https://www.arknights.jp/" target="_blank">アークナイツ
                            <span class="item-tooltip-text">アークナイツは戦略的タワーディフェンスゲームです。</span>
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </div>

    <div class="content-box">
        <h2 class="font-cherry">やっていたげーむ</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">PS</h3>
                <ul>
                    <li><a href="https://ja.wikipedia.org/wiki/%E3%81%8C%E3%82%93%E3%81%B0%E3%82%8C%E3%82%B4%E3%82%A8%E3%83%A2%E3%83%B3%E3%80%9C%E5%AE%87%E5%AE%99%E6%B5%B7%E8%B3%8A%E3%82%A2%E3%82%B3%E3%82%AE%E3%83%B3%E3%82%B0%E3%80%9C" target="_blank">がんばれゴエモン〜宇宙海賊アコギング〜</a></li>
                    <li><a href="https://www.gamecity.ne.jp/mf1" target="_blank">モンスターファーム</a></li>
                    <li>
                        チョコボの不思議なダンジョン(
                            <a href="https://ja.wikipedia.org/wiki/%E3%83%81%E3%83%A7%E3%82%B3%E3%83%9C%E3%81%AE%E4%B8%8D%E6%80%9D%E8%AD%B0%E3%81%AA%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B3" target="_blank">1</a>,
                            <a href="https://ja.wikipedia.org/wiki/%E3%83%81%E3%83%A7%E3%82%B3%E3%83%9C%E3%81%AE%E4%B8%8D%E6%80%9D%E8%AD%B0%E3%81%AA%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B32" target="_blank">2</a>
                        )
                    </li>
                    <li><a href="https://ja.wikipedia.org/wiki/%E3%82%AF%E3%83%A9%E3%83%83%E3%82%B7%E3%83%A5%E3%83%BB%E3%83%90%E3%83%B3%E3%83%87%E3%82%A3%E3%82%AF%E3%83%BC_(%E3%82%B2%E3%83%BC%E3%83%A0)" target="_blank">クラッシュ・バンディクー1</a></li>
                    <li><a href="https://ja.wikipedia.org/wiki/ONE_PIECE_%E3%82%B0%E3%83%A9%E3%83%B3%E3%83%89%E3%83%90%E3%83%88%E3%83%AB!" target="_blank">ONE PIECE グランドバトル!</a></li>
                    <li><a href="https://www.amazon.co.jp/NICE-PRICE-%E3%82%B7%E3%83%AA%E3%83%BC%E3%82%BA-Vol-2-%E6%9C%AC%E6%A0%BC%E5%B0%86%E6%A3%8B%E6%8C%87%E5%8D%97/dp/B00005QHMT" target="_brank">PRICEシリーズVol.2 本格将棋指南</a></li>
                    <li><a href="https://www.amazon.co.jp/%E3%82%A8%E3%83%8B%E3%83%83%E3%82%AF%E3%82%B9-%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA1%E3%83%BB2-%E6%98%9F%E9%99%8D%E3%82%8A%E3%81%AE%E5%8B%87%E8%80%85%E3%81%A8%E7%89%A7%E5%A0%B4%E3%81%AE%E4%BB%B2%E9%96%93%E3%81%9F%E3%81%A1/dp/B000063DJK/ref=sr_1_1?__mk_ja_JP=%E3%82%AB%E3%82%BF%E3%82%AB%E3%83%8A&crid=D8U37FNIR2H8&keywords=%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA1%E3%83%BB2+%E6%98%9F%E9%99%8D%E3%82%8A%E3%81%AE%E5%8B%87%E8%80%85%E3%81%A8%E7%89%A7%E5%A0%B4%E3%81%AE%E4%BB%B2%E9%96%93%E3%81%9F%E3%81%A1&qid=1701603876&s=videogames&sprefix=%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA1+2+%E6%98%9F%E9%99%8D%E3%82%8A%E3%81%AE%E5%8B%87%E8%80%85%E3%81%A8%E7%89%A7%E5%A0%B4%E3%81%AE%E4%BB%B2%E9%96%93%E3%81%9F%E3%81%A1%2Cvideogames%2C244&sr=1-1" >ドラゴンクエストモンスターズ1・2 星降りの勇者と牧場の仲間たち</a></li>
                    <li><a href="https://www.youtube.com/watch?v=Q33_nTN4cqU" target="_blank">名探偵コナン</a></li>
                    <li><a href="https://www.konami.com/mg/archive/mgs/" target="_blank">メタルギアソリッド</a></li>
                    <li><a href="https://www.playstation.com/ja-jp/games/ape-escape/" target="_blank">サルゲッチュ</a></li>
                    <li><a href="https://www.gamecity.ne.jp/mf2/" target="_blank">モンスターファーム2</a></li>
                </ul>
            </div>
            <div class="sub-left-content">
                <h3 class="font-cherry">ゲームボーイ(むじるし・カラー・アドバンス)</h3>
                <ul>
                    <li>思い出し中...</li>
                </ul>
            </div>
        </div>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">NINTENDO 64</h3>
                <ul>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nsmj/index.html" target="_blank">スーパーマリオ６４</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nmkj/index.html" target="_blank">マリオカート６４</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nysj/index.html" target="_blank">ヨッシーストーリー</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_ngej/index.html" target="_blank">ゴールデン・アイ 007</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nfxj/index.html" target="_blank">スターフォックス64</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_clbj/index.html" target="_blank">マリオパーティ</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nbkj/index.html" target="_blank">バンジョーとカズーイの大冒険</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/zelda/index.html" target="_blank">ゼルダの伝説 時のオカリナ</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_npsj/index.html" target="_blank">チョロＱ 64</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nmwj/index.html" target="_blank">マリオパーティ２</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_ndoj/index.html" target="_blank">ドンキーコング６４</a></li>
                    <li><a href="https://www.bokumono.com/sub/bokumono2.php" target="_blank">牧場物語２</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nalj/index.html" target="_blank">大乱闘 スマッシュブラザーズ</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nb7j/index.html" target="_blank">バンジョーとカズーイの大冒険 2</a></li>
                    <li><a href="https://www.spike-chunsoft.co.jp/games/shiren2/" target="_blank">風来のシレン2 鬼襲来！シレン城</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_npdj/index.html" target="_blank">パーフェクトダーク</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nk4j/index.html" target="_blank">星のカービィ６４</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_npdj/index.html" target="_blank">パーフェクトダーク</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_npdj/index.html" target="_blank">ポケモンスタジアム金銀</a></li>
                    <li><a href="https://www.nintendo.co.jp/n01/n64/software/nus_p_nmvj/index.html" target="_blank">マリオパーティ3</a></li>
                    <li><a href="https://www.nicovideo.jp/watch/sm4900873" target="_blank">ウッチャンナンチャンの炎のチャレンジャー 電流イライラ棒 64</a></li>
                </ul>
            </div>
            <div class="sub-left-content">
                <h3 class="font-cherry">PS2</h3>
                <ul>
                    <li><a href="https://www.famitsu.com/news/202108/03229085.html" target="_blank">真・三國無双1</a></li>
                    <li><a href="https://www.jp.square-enix.com/kingdom/timeline/index.html" target="_blank">キングダム ハーツ シリーズ</a> (無印・2・ファイナルミックス)</li>
                    <li><a href="https://www.youtube.com/watch?v=sBBH11LDhYE&list=PLDm909D4IX2IBgQcSDxCtWpQwstcW81Gg" target="_blank">ぼくのなつやすみ2 海の冒険篇</a></li>
                    <li><a href="https://www.youtube.com/watch?v=em4Bl46s55Y" target="_blank">ドラゴンクエストキャラクターズ トルネコの大冒険3 不思議のダンジョン</a></li>
                    <li><a href="https://www.youtube.com/watch?v=FB666ctDjGo" target="_blank">ラチェット&クランク1~4</a></li>
                    <li>ファイナルファンタジー (<a href="https://www.jp.square-enix.com/ffx_x-2HD/#introduction" target="_blank">X-2</a>,<a href="https://www.jp.square-enix.com/ff12_tza/" target="_blank">Ⅻ</a>)</li>
                    <li><a href="http://www.tecmo.co.jp/product/mf4/" target="_blank">モンスターファーム4</a></li>
                    <li><a href="https://www.youtube.com/watch?v=kNEBIV-jkiQ&t=96s" target="_blank">NARUTO -ナルト- ナルティメットヒーローシリーズ 1~3</a></li>
                    <li>ドラゴンクエスト<a href="https://www.jp.square-enix.com/game/detail/dq5/" target="_blank">V</a>, <a hter="https://www.jp.square-enix.com/game/detail/dq8/" target="_blank">VIII</a></li>
                    <li><a href="https://www.youtube.com/watch?v=GNGagTajxF0" target="_blank">金色のガッシュベル!! 友情タッグバトル</a></li>
                    <li><a href="http://www.gust.co.jp/products/a6/" target="_blank">イリスのアトリエ エターナルマナ</a></li>
                    <li><a href="https://www.jp.square-enix.com/game/detail/itastsp/" target="_blank">ドラゴンクエスト&ファイナルファンタジー in いただきストリートSpecial</a></li>
                    <li>モンスターハンター <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterg/" target="_blank">G</a>, <a href="https://www.capcom-games.com/product/ja-jp/monsterhunter2/" target="_blank">2</a></li>
                    <li><a href="http://www.tv-toa.jp/" target="_blank">テイルズ オブ ジ アビス</a></li>
                    <li><a href="https://www.jp.square-enix.com/game/detail/yangus/" target="_blank">ドラゴンクエスト 少年ヤンガスと不思議のダンジョン</a></li>
                </ul>
            </div>
        </div>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">PSP</h3>
                <ul>
                    <li>モンスターハンター
                        (
                            <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable/" target="_brank">ポータブル</a>,
                            <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable2nd/" target="_brank">2</a>,
                            <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable2ndg/" target="_brank">2G</a>,
                            <a href="https://www.capcom-games.com/product/ja-jp/monsterhunterportable3rd/" target="_brank">3</a>
                        )
                    </li>
                    <li><a href="https://store.playstation.com/ja-jp/product/JP9000-CUSA37872_00-UCJS100210000000" target="_blank">ブレイドダンサー</a></li>
                    <li><a href="https://www.amazon.co.jp/%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88-%E3%83%95%E3%82%A1%E3%82%A4%E3%83%8A%E3%83%AB%E3%83%95%E3%82%A1%E3%83%B3%E3%82%BF%E3%82%B8%E3%83%BC-%E3%81%84%E3%81%9F%E3%81%A0%E3%81%8D%E3%82%B9%E3%83%88%E3%83%AA%E3%83%BC%E3%83%88-%E3%83%9D%E3%83%BC%E3%82%BF%E3%83%96%E3%83%AB-PSP/dp/B000EP5GAU" target="_blank">ドラゴンクエスト&ファイナルファンタジー in いただきストリートポータブル</a></li>
                    <li><a href="https://www.amazon.co.jp/%E3%82%BD%E3%83%8B%E3%83%BC%E3%83%BB%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%A9%E3%82%AF%E3%83%86%E3%82%A3%E3%83%96%E3%82%A8%E3%83%B3%E3%82%BF%E3%83%86%E3%82%A4%E3%83%B3%E3%83%A1%E3%83%B3%E3%83%88-%E3%83%96%E3%83%AC%E3%82%A4%E3%83%96-%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AA%E3%83%BC-%E6%96%B0%E3%81%9F%E3%81%AA%E3%82%8B%E6%97%85%E4%BA%BA-PSP/dp/B000FGUNHY" target="_blank">ブレイブ ストーリー 新たなる旅人</a></li>
                    <li><a href="https://www.jp.square-enix.com/game/detail/fft_shi/" target="_blank">ファイナルファンタジータクティクス 獅子戦争</a></li>
                    <li><a href="https://www.jp.square-enix.com/game/detail/ccff7/" target="_blank">クライシス コア ファイナルファンタジーVII</a></li>
                    <li><a href="https://www.playstation.com/ja-jp/games/no-heroes-allowed/" target="_blank">勇者のくせになまいきだ。</a></li>
                    <li><a href="https://tales-ch.jp/titles/index.php?series_id=17" target="_blank">テイルズ オブ ザ ワールド レディアント マイソロジー2</a></li>
                    <li><a href="https://www.famitsu.com/sp/110530_blackrockshooter/" target="_blank">ブラック★ロックシューター THE GAME</a></li>
                </ul>
            </div>
            <div class="sub-left-content">
                <h3 class="font-cherry">PC</h3>
                <ul>
                    <li>思い出し中...</li>
                </ul>
            </div>
        </div>
    </div>
    <div class="content-box">
        <h2 class="font-cherry">いんすたんとげーむおきば</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <ul>
                    <li><a href="{{url('/games/tetris')}}" target="_blank">テトリス</a> 参考: <a href="https://qiita.com/ryuichi1208/items/f9e6ac2b99bbe4fc82d3">7行テトリス</a></li>
                    <li><a href="{{url('/games/puyo')}}" target="_blank">ぷよぷよ</a> 参考: <a href="https://qiita.com/yoitomakenouta/items/8b93d0b9dacf365ce0b1">10行ぷよぷよ</a></li>
                </ul>
            </div>
        </div>
    </div>
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
</div>
@endsection
