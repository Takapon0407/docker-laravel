@extends('layouts.common')
@section('title', '作品')
@section('description', 'Webエンジニア・たかぽんが作ったものの紹介です。AI で作る作業用 BGM のチャンネル「Rain & Realms」などを載せています。')
@section('content')

<div class="container works-container">
    <h1 class="works-title font-heading">作品</h1>
    <p class="works-lead">仕事の外で作ったものです。作り方や、工夫したところも書いています。</p>

    <ul class="works-list">
        @foreach ($works as $work)
            <li>
                <a class="works-card" href="{{ route($work['route']) }}">
                    <img class="works-card-image" src="{{ asset($work['image']) }}" alt="" width="640" height="640" loading="lazy">
                    <div class="works-card-body">
                        <h2 class="works-card-title font-heading">{{ $work['title'] }}</h2>
                        <p class="works-card-subtitle">{{ $work['subtitle'] }}</p>
                        <p class="works-card-text">{{ $work['description'] }}</p>
                        <ul class="works-tags" aria-label="使った技術">
                            @foreach ($work['tags'] as $tag)
                                <li class="works-tag">{{ $tag }}</li>
                            @endforeach
                        </ul>
                    </div>
                </a>
            </li>
        @endforeach
    </ul>
</div>

@endsection
