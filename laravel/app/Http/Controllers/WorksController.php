<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class WorksController extends Controller
{
    public function index(): View
    {
        return view('works.index', ['works' => config()->array('works.list')]);
    }

    public function rainAndRealms(): View
    {
        $album = config()->array('rain-and-realms.album');
        $mediaBase = config()->string('works.media_url').'/'.trim(self::stringOf($album, 'media_path'), '/');

        $tracks = [];
        $totalSeconds = 0;
        foreach ((array) ($album['tracks'] ?? []) as $index => $track) {
            if (! is_array($track)) {
                continue;
            }
            $duration = self::stringOf($track, 'duration');
            $totalSeconds += self::secondsOf($duration);
            $tracks[] = [
                'no' => $index + 1,
                'title_en' => self::stringOf($track, 'title_en'),
                'title_ja' => self::stringOf($track, 'title_ja'),
                'duration' => $duration,
                'src' => $mediaBase.'/'.rawurlencode(self::stringOf($track, 'file')),
            ];
        }

        return view('works.rain-and-realms', [
            'album' => $album,
            'tracks' => $tracks,
            'totalMinutes' => (int) round($totalSeconds / 60),
            'youtubeId' => config()->string('rain-and-realms.youtube_id'),
            'links' => config()->array('rain-and-realms.links'),
        ]);
    }

    /**
     * 「分:秒」を秒にする（形が違うときは 0）
     */
    public static function secondsOf(string $duration): int
    {
        if (preg_match('/^(\d+):([0-5]\d)$/', $duration, $matches) !== 1) {
            return 0;
        }

        return (int) $matches[1] * 60 + (int) $matches[2];
    }

    /**
     * @param  array<mixed>  $values
     */
    private static function stringOf(array $values, string $key): string
    {
        $value = $values[$key] ?? '';

        return is_string($value) ? $value : '';
    }
}
