<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Would you like the install button to appear on all pages?
      Set true/false
    |--------------------------------------------------------------------------
    */

    'install-button' => true,

    /*
    |--------------------------------------------------------------------------
    | PWA Manifest Configuration
    |--------------------------------------------------------------------------
    |  php artisan erag:update-manifest
    */

    'manifest' => [
        'name' => 'てくてくテック ポートフォリオ',
        'short_name' => 'tektektech',
        'background_color' => '#55c501',
        'display' => 'fullscreen',
        'description' => 'A portfolio site for TekTekTech, showcasing projects and skills in web development and technology.',
        'theme_color' => '#55c501',
        'icons' => [
            [
                'src' => 'tektektech.jpg',
                'sizes' => '512x512',
                'type' => 'image/png',
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Debug Configuration
    |--------------------------------------------------------------------------
    | Toggles the application's debug mode based on the environment variable
    */

    'debug' => env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Livewire Integration
    |--------------------------------------------------------------------------
    | Set to true if you're using Livewire in your application to enable
    | Livewire-specific PWA optimizations or features.
    */

    'livewire-app' => false,
];
