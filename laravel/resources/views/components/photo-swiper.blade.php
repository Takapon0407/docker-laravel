@props(['photos'])
<div class="photo-swiper swiper">
    <div class="swiper-wrapper">
        @foreach ($photos as $photo)
            <div class="swiper-slide">
                <img class="slide-photo" src="{{ $photo['url'] }}" alt="{{ $photo['filename'] }}">
            </div>
        @endforeach
    </div>
    <div class="swiper-pagination"></div>
    <div class="swiper-button-prev"></div>
    <div class="swiper-button-next"></div>
</div>
