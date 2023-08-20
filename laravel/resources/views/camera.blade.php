@extends('layouts.common')
@vite('resources/ts/laravel/camera.ts')
@section('content')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap" rel="stylesheet">

<link
  rel="stylesheet"
  href="https://unpkg.com/swiper@7/swiper-bundle.min.css"
/>
<script src="https://unpkg.com/swiper@7/swiper-bundle.min.js"></script>

<div class="container">
    <div class="content-box">
        <h2 class="font-cherry">とったやつ</h2>
        <div class="sub-content">
            <div class="swiper">
                <div class="swiper-wrapper">
                    <div class="swiper-slide">
                        <img class="slide-photo" src="https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC08950.jpg" alt="Slide 3">
                    </div>
                    <div class="swiper-slide">
                        <img class="slide-photo" src="https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC00348.jpg" alt="Slide 2">
                    </div>
                    <div class="swiper-slide">
                        <img class="slide-photo" src="https://photographs-qa.s3.ap-northeast-1.amazonaws.com/DSC00909.jpg" alt="Slide 1">
                    </div>
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
</div>
@endsection
