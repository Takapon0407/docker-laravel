<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});


Route::prefix('games')->group(function () {
    Route::get('/tetris', function () {
        return view('games.tetris');
    });
    Route::get('/puyo', function () {
        return view('games.puyo');
    });

});

Route::get('/react/{any}', function () {
    return view('index');
})->where('any', '.*');