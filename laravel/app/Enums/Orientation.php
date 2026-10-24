<?php

namespace App\Enums;

enum Orientation: string
{
    case Landscape = 'landscape';
    case Portrait = 'portrait';
    case Square = 'square';

    public static function fromSize(int $width, int $height): self
    {
        return match ($width <=> $height) {
            1 => self::Landscape,
            -1 => self::Portrait,
            0 => self::Square,
        };
    }
}
