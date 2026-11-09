<?php

use App\Http\Controllers\BoardController;
use App\Http\Controllers\HobbiesController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

// スキルスタック・略歴などは、就活用のクエリが付いたときだけ出す（config/profile.php）
Route::get('/', [ProfileController::class, 'show'])->name('profile');
// トップページと同じ内容だった /profile は、重複させないようトップページへ恒久的に転送する
Route::permanentRedirect('/profile', '/');

Route::get('/hobbies', [HobbiesController::class, 'show'])->name('hobbies');

Route::view('/privacy', 'privacy')->name('privacy');

Route::prefix('games')->name('games.')->group(function () {
    Route::view('/tetris', 'games.tetris')->name('tetris');
    Route::view('/puyo', 'games.puyo')->name('puyo');
});

Route::prefix('tools')->name('tools.')->group(function () {
    Route::view('/', 'tools.index')->name('index');
    Route::view('/warikan', 'tools.warikan')->name('warikan');
    Route::view('/json', 'tools.json')->name('json');
    Route::view('/datetime', 'tools.datetime')->name('datetime');
    Route::view('/regex', 'tools.regex')->name('regex');
    Route::view('/lifespan', 'tools.lifespan')->name('lifespan');
    Route::view('/countdown', 'tools.countdown')->name('countdown');
    Route::view('/pixel-art', 'tools.pixel-art')->name('pixel-art');
    Route::view('/chord-player', 'tools.chord-player')->name('chord-player');
    Route::get('/board', [BoardController::class, 'create'])->name('board');
    Route::get('/board/room', [BoardController::class, 'room'])->name('board.room');
});
