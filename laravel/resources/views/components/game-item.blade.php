@props(['game'])
{{-- links があるときは「タイトル (1, 2)」のように、シリーズの各作品へ個別にリンクする --}}
@if (isset($game['links']))
    <li>{{ $game['title'] }} (@foreach ($game['links'] as [$label, $url])<a href="{{ $url }}" target="_blank" rel="noopener noreferrer">{{ $label }}</a>{{ $loop->last ? '' : ', ' }}@endforeach)</li>
@else
    <li><a href="{{ $game['url'] }}" target="_blank" rel="noopener noreferrer">{{ $game['title'] }}</a></li>
@endif
