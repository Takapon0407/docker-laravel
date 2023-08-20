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
            </div>
        </div>
    </div>
    <div class="content-box">
        <h2 class="font-cherry">どんなことができる？</h2>
    </div>
</div>
@endsection
