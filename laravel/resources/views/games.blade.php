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
                    <li><a href="https://genshin.hoyoverse.com/ja/" target="_blank">原神</a></li>
                    <li><a href="https://www.arknights.jp/" target="_blank">アークナイツ</a></li>
                    <li><a href="https://hsr.hoyoverse.com/ja-jp/home" target="_blank">崩壊スターレイル</a></li>
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
