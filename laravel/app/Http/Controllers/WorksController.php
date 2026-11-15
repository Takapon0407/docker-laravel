<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class WorksController extends Controller
{
    // ダウンロードできる形式（拡張子 => ボタンの表示）。ファイルは infra/media/README.md の手順で S3 に置く
    private const DOWNLOAD_FORMATS = ['mp3' => 'MP3', 'wav' => 'WAV'];

    public function index(): View
    {
        return view('works.index', ['works' => config()->array('works.list')]);
    }

    public function rainAndRealms(): View
    {
        $album = config()->array('rain-and-realms.album');
        $mediaBase = config()->string('works.media_url').'/'.trim(self::stringOf($album, 'media_path'), '/');
        $artist = self::stringOf($album, 'artist');

        $tracks = [];
        $totalSeconds = 0;
        foreach ((array) ($album['tracks'] ?? []) as $index => $track) {
            if (! is_array($track)) {
                continue;
            }
            $duration = self::stringOf($track, 'duration');
            $totalSeconds += self::secondsOf($duration) ?? 0;
            $file = self::stringOf($track, 'file');
            $titleEn = self::stringOf($track, 'title_en');
            // ダウンロード用のファイルは、再生用（.m4a）と同じ名前で拡張子だけ違う。保存するときの名前は曲名にする
            $basename = pathinfo($file, PATHINFO_FILENAME);
            $saveAs = sprintf('%s - %02d %s', $artist, $index + 1, $titleEn);
            $downloads = [];
            foreach (self::DOWNLOAD_FORMATS as $extension => $label) {
                $downloads[] = [
                    'label' => $label,
                    'href' => $mediaBase.'/'.rawurlencode($basename.'.'.$extension),
                    'filename' => $saveAs.'.'.$extension,
                ];
            }
            $tracks[] = [
                'no' => $index + 1,
                'title_en' => $titleEn,
                'title_ja' => self::stringOf($track, 'title_ja'),
                'duration' => $duration,
                'src' => $mediaBase.'/'.rawurlencode($file),
                'downloads' => $downloads,
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
     * 「分:秒」か「時:分:秒」を秒にする（形が違うときは null。設定のすべての曲が読めることは WorksPageTest で確かめる）
     */
    public static function secondsOf(string $duration): ?int
    {
        if (preg_match('/^(?:(\d+):([0-5]\d)|(\d+):([0-5]\d):([0-5]\d))$/', $duration, $matches) !== 1) {
            return null;
        }
        if (($matches[3] ?? '') !== '') {
            return (int) $matches[3] * 3600 + (int) $matches[4] * 60 + (int) $matches[5];
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
