<?php

use App\Http\Controllers\HobbiesController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'profile')->name('profile');
// トップページと同じ内容だった /profile は、重複させないようトップページへ恒久的に転送する
Route::permanentRedirect('/profile', '/');

Route::get('/hobbies', [HobbiesController::class, 'show'])->name('hobbies');

Route::prefix('games')->name('games.')->group(function () {
    Route::view('/tetris', 'games.tetris')->name('tetris');
    Route::view('/puyo', 'games.puyo')->name('puyo');
});

Route::prefix('tools')->name('tools.')->group(function () {
    Route::view('/warikan', 'tools.warikan')->name('warikan');
});
