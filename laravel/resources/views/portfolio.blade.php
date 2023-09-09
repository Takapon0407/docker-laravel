@extends('layouts.common')
@section('content')
@vite('resources/ts/laravel/profile.ts')
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
                <div>趣味: カメラ, 将棋, ブログ, アコギ等</div>
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
                    <li>1994年 4月: 熊本県で誕生!</li>
                    <li>2001年 4月: <a href="https://es.higo.ed.jp/kikuyoce/" target="_blank">菊陽中部小学校</a> 入学</li>
                    <li>2007年 4月: <a href="https://jh.higo.ed.jp/kikuyojh/" target="_blank">熊本県立菊陽中学校</a> 入学</li>
                    <li>2010年 4月: <a href="https://sh.higo.ed.jp/oozu/" target="_blank">熊本県立大津高等学校</a> 理数科 入学</li>
                    <li>2013年 4月: <a href="https://www.iizuka.kyutech.ac.jp/" target="_blank">九工大 情報工学部 知能情報工学科</a> 入学</li>
                    <li>2013年 4月: <a href="https://www.kyutech.ac.jp/department/joho-kougakuhu.html" target="_blank">九工大 情報工学府 先端情報工学科</a> 入学</li>
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
    <div class="content-box">
        <h2 class="font-cherry">そのた</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">しかく</h3>
                <ul>
                    <li>2016年 11月: <a href="https://www.ipa.go.jp/shiken/kubun/fe.html" target="_blank">基本情報技術者試験</a></li>
                    <li>2018年  6月: <a href="https://www.ipa.go.jp/shiken/kubun/ap.html" target="_blank">応用情報技術者試験</a></li>
                    <li>2019年  5月: <a href="https://www.iibc-global.org/toeic/test/lr.html" target="_blank">TOEIC L&R 805点</a></li>
                    <li>2022年  8月: <a href="https://aws.amazon.com/jp/certification/certified-cloud-practitioner/" target="_blank">AWS Cloud Practitioner</a></li>
                    <li>2023年  7月: <a href="https://aws.amazon.com/jp/certification/certified-solutions-architect-associate/" target="_blank">AWS SAA</a></li>
                </ul>
            </div>
            <div class="sub-right-content">
                <h3 class="font-cherry">けいけん</h3>
                <ul>
                    <li>2018年  8月: <a href="https://fptsoftware.com/" target="_blank">FTPソフトウェア</a>にインターンシップ参加のため45日間ベトナムに滞在</li>
                    <li>2018年 12月: <a href="https://www.ccny.cuny.edu/" target="_blank">CCNY</a>にて授業をうけるため一週間アメリカに滞在</li>
                </ul>
            </div>
        </div>
    </div>
    <div class="content-box">
        <h2 class="font-cherry">すきるすたっく</h2>
        <div class="sub-content">
            <div class="sub-left-content">
                <h3 class="font-cherry">げんご</h3>
                <ul>
                    <li>HTML</li>
                    <li>PHP</li>
                    <li>JS, TS</li>
                    <li>Python</li>
                    <li>Go</li>
                    <li>C</li>
                </ul>
                <h3 class="font-cherry">クラウド</h3>
                <ul>
                    <li>AWS</li>
                </ul>
            </div>
            <div class="sub-right-content">
                <h3 class="font-cherry">ふれーむわーく</h3>
                <ul>
                    <li>Laravel</li>
                    <li>Symfony</li>
                    <li>CodeIgniter</li>
                    <li>Zend</li>
                    <li>React</li>
                    <li>Vue</li>
                </ul>
            </div>
        </div>
    </div>
</div>
@endsection
