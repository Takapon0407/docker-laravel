{{-- ブラウザがつなぐ WebSocket の URL（空なら、ページと同じドメインの /tools/board/ws） --}}
<meta name="board-websocket-url" content="{{ config('board.websocket_url') ?? '' }}">
{{-- URL を知っている人だけが使うページなので、検索結果に出さない --}}
<meta name="robots" content="noindex">
