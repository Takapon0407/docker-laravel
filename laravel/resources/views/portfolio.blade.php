@extends('layouts.common')
@section('content')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap" rel="stylesheet">
<div class="container">
    <div class="content-box">
        <h2 class="font-cherry">だれ？</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <img src="https://tektektech.com/wp-content/uploads/2020/09/48579941.423B85AD1BAF42FC9C624A1F2D8422CE.19080902.jpg"
                    alt="profile img"
                    title="profile img"
                    width="100%"
                    height="100%"
                >
            </div>
            <div class="sub-right-content">
                <div>名前: たかぽん</div>
                <div id="age">年齢: 計算中...</div>
                <div>趣味: カメラ, 将棋, ブログ...等</div>
                <div>TEL: 080-2710-3612</div>
                <div>BLOG: <a href="https://tektektech.com/" target="_blank">てくてくテック</a></div>
            </div>
        </div>
    </div>
    <div class="content-box">
        <h2 class="font-cherry">りゃくれき</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <ul>
                    <li>1994年 4月: 熊本で誕生</li>
                    <li>2001年 4月: <a href="https://es.higo.ed.jp/kikuyoce/" target="_blank">菊陽中部小学校</a> 入学</li>
                    <li>2007年 4月: <a href="https://jh.higo.ed.jp/kikuyojh/" target="_blank">熊本県立菊陽中学校</a> 入学</li>
                    <li>2010年 3月: <a href="https://sh.higo.ed.jp/oozu/" target="_blank">熊本県立大津高等学校</a> 理数科 入学</li>
                    <li>2013年 4月: <a href="https://www.iizuka.kyutech.ac.jp/" target="_blank">九州工業大学 情報工学部 知能情報工学科</a> 入学</li>
                    <li>2013年 4月: <a href="https://www.kyutech.ac.jp/department/joho-kougakuhu.html" target="_blank">九州工業大学 情報工学府 先端情報工学科</a> 入学</li>
                </ul>
            </div>
            <div class="sub-right-content">
                <ul>
                    <li>2019年 4月: <a href="https://sencorp.co.jp/" target="_blank">千株式会社</a> 入社</li>
                    <li>2023年 2月: <a href="https://www.oz-vision.co.jp/" target="_blank">株式会社オズビジョン</a> 入社</li>
                    <li>現在に至る</li>
                </ul>
            </div>
        </div>
    </div>
</div>
@endsection
