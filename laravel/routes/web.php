<?php

use App\Http\Controllers\HobbiesController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'profile');
Route::view('/profile', 'profile');

Route::get('/hobbies', [HobbiesController::class, 'show']);

Route::prefix('games')->group(function () {
    Route::view('/tetris', 'games.tetris');
    Route::view('/puyo', 'games.puyo');
});

Route::view('/hello-world', 'top');
