<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

/**
 * 匿名質問ボード（/tools/board）のページ
 *
 * ページは HTML を返すだけで、ルームの作成・参加・投稿はブラウザから WebSocket（infra/board）で行う。
 * 公開するまで（config('board.enabled') が false の間）は 404 にする。
 */
class BoardController extends Controller
{
    public function create(): View
    {
        abort_unless(config()->boolean('board.enabled'), 404);

        return view('tools.board.create');
    }

    public function room(): View
    {
        abort_unless(config()->boolean('board.enabled'), 404);

        return view('tools.board.room');
    }
}
